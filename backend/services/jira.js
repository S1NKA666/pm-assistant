import axios from 'axios';
import { db } from '../database.js';
import { retryRequest } from './retry.js';

// Вспомогательная функция для создания axios-клиента к локальной JIRA
function getJiraClient() {
  const settings = db.getSettings();
  const { jiraUrl, jiraEmail, jiraToken } = settings;

  if (!jiraUrl) {
    throw new Error('JIRA URL is not configured.');
  }

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  // Проверяем тип авторизации
  if (jiraEmail && jiraToken) {
    const authString = Buffer.from(`${jiraEmail}:${jiraToken}`).toString('base64');
    headers['Authorization'] = `Basic ${authString}`;
  } else if (jiraToken) {
    const token = jiraToken.startsWith('Bearer ') ? jiraToken : `Bearer ${jiraToken}`;
    headers['Authorization'] = token;
  } else {
    throw new Error('JIRA credentials (Email + Token or PAT) are not configured.');
  }

  const baseURL = jiraUrl.endsWith('/') ? jiraUrl.slice(0, -1) : jiraUrl;

  return axios.create({
    baseURL,
    headers,
    timeout: 12000
  });
}

export const jiraService = {
  // Проверка соединения
  async testConnection() {
    try {
      const client = getJiraClient();
      const response = await client.get('/rest/api/2/myself');
      return { success: true, user: response.data };
    } catch (error) {
      console.error('Jira connection failed:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.errorMessages?.[0] || error.response?.statusText || error.message 
      };
    }
  },

  // Поиск пользователей в Jira для назначения (assignee)
  async searchUsers(query) {
    try {
      const client = getJiraClient();
      const response = await client.get(`/rest/api/2/user/search`, {
        params: { username: query, query: query, maxResults: 10 }
      });
      return response.data.map(u => ({
        key: u.key || u.name,
        name: u.name,
        displayName: u.displayName,
        emailAddress: u.emailAddress,
        accountId: u.accountId
      }));
    } catch (error) {
      console.error('Error searching Jira users:', error.message);
      return [];
    }
  },

  // Получить проекты
  async getProjects() {
    return retryRequest(async () => {
      const client = getJiraClient();
      const response = await client.get('/rest/api/2/project');
      return response.data.map(p => ({
        id: p.id,
        key: p.key,
        name: p.name
      }));
    });
  },

  // Создание задачи
  async createIssue(issueData) {
    return retryRequest(async () => {
      const client = getJiraClient();
      const settings = db.getSettings();
      const projectKey = issueData.projectKey || settings.jiraProjectKey;

      if (!projectKey) {
        throw new Error('JIRA Project Key is not specified.');
      }

      const fields = {
        project: {
          key: projectKey
        },
        summary: issueData.summary,
        description: issueData.description || '',
        issuetype: {
          name: issueData.issueType || 'Task'
        }
      };

      let jiraPriority = 'Medium';
      if (issueData.priority === 'High') jiraPriority = 'High';
      if (issueData.priority === 'Low') jiraPriority = 'Low';
      
      fields.priority = { name: jiraPriority };

      if (issueData.assignee) {
        fields.assignee = { name: issueData.assignee };
      }

      if (issueData.storyPoints && settings.storyPointsFieldId) {
        fields[settings.storyPointsFieldId] = Number(issueData.storyPoints);
      } else if (issueData.storyPoints) {
        fields.description = `[Story Points: ${issueData.storyPoints}]\n\n` + fields.description;
      }

      const payload = { fields };
      const response = await client.post('/rest/api/2/issue', payload);
      const createdIssue = response.data;
      
      if (issueData.sprintId) {
        await this.addIssuesToSprint(issueData.sprintId, [createdIssue.key]);
      }

      return createdIssue;
    });
  },

  // Перевод статуса задачи в JIRA
  async transitionIssue(issueKey, transitionName) {
    return retryRequest(async () => {
      const client = getJiraClient();
      
      // 1. Получаем доступные переходы для задачи
      const transRes = await client.get(`/rest/api/2/issue/${issueKey}/transitions`);
      const transitions = transRes.data.transitions || [];
      
      // Находим переход по имени (без учета регистра)
      const target = transitions.find(t => 
        t.name?.toLowerCase().includes(transitionName.toLowerCase())
      );
      
      if (!target) {
        throw new Error(`В JIRA не найден переход "${transitionName}". Доступные переходы: ${transitions.map(t => t.name).join(', ')}`);
      }
      
      // 2. Выполняем переход
      await client.post(`/rest/api/2/issue/${issueKey}/transitions`, {
        transition: { id: target.id }
      });
      
      return { success: true, transitionName: target.name };
    });
  },

  // Получить доски (Boards)
  async getBoards() {
    return retryRequest(async () => {
      const client = getJiraClient();
      const response = await client.get('/rest/agile/1.0/board');
      return response.data.values || [];
    });
  },

  // Получить спринты для доски
  async getSprints(boardId) {
    return retryRequest(async () => {
      const client = getJiraClient();
      const bId = boardId || db.getSettings().jiraBoardId;
      if (!bId) return [];
      const response = await client.get(`/rest/agile/1.0/board/${bId}/sprint`);
      return response.data.values || [];
    });
  },

  // Получить задачи спринта
  async getSprintIssues(sprintId) {
    return retryRequest(async () => {
      const client = getJiraClient();
      const response = await client.get(`/rest/agile/1.0/sprint/${sprintId}/issue`);
      return response.data.issues || [];
    });
  },

  // Получить бэклог доски (задачи без спринта)
  async getBacklog(boardId) {
    return retryRequest(async () => {
      const client = getJiraClient();
      const bId = boardId || db.getSettings().jiraBoardId;
      if (!bId) {
        throw new Error('JIRA Board ID is not configured.');
      }
      try {
        const response = await client.get(`/rest/agile/1.0/board/${bId}/backlog`);
        return response.data.issues || [];
      } catch (error) {
        console.error('Failed to fetch backlog:', error.message);
        const settings = db.getSettings();
        const jql = `project = "${settings.jiraProjectKey}" AND sprint is EMPTY AND status category != Done`;
        const fallback = await client.post('/rest/api/2/search', { jql, maxResults: 50 });
        return fallback.data.issues || [];
      }
    });
  },

  // Получить бэклог по ключу проекта JIRA
  async getProjectBacklog(projectKey) {
    const client = getJiraClient();
    const pKey = projectKey || db.getSettings().jiraProjectKey;
    if (!pKey) {
      throw new Error('JIRA Project Key is not configured.');
    }

    const jqlVariants = [
      `project = "${pKey}" AND спринт not in openSprints() AND спринт not in futureSprints() AND statusCategory != Done`,
      `project = "${pKey}" AND спринт is EMPTY AND statusCategory != Done`,
      `project = "${pKey}" AND sprint not in openSprints() AND sprint not in futureSprints() AND statusCategory != Done`,
      `project = "${pKey}" AND sprint is EMPTY AND statusCategory != Done`,
      `project = "${pKey}" AND statusCategory != Done ORDER BY created DESC`,
    ];

    for (const jql of jqlVariants) {
      try {
        const response = await client.post('/rest/api/2/search', {
          jql,
          maxResults: 100,
          fields: ['summary', 'status', 'priority', 'assignee', 'customfield_10026', 'customfield_10016']
        });
        console.log(`[Backlog] Success with JQL: ${jql.substring(0, 60)}...`);
        return response.data.issues || [];
      } catch (error) {
        const status = error.response?.status;
        const detail = JSON.stringify(error.response?.data?.errorMessages || error.response?.data?.errors || error.message);
        console.warn(`[Backlog] JQL failed (${status}): ${jql.substring(0, 60)}... => ${detail}`);
        if (status !== 400) break;
      }
    }

    console.error(`[Backlog] All JQL variants failed for project ${pKey}`);
    return [];
  },

  // Добавить задачи в спринт
  async addIssuesToSprint(sprintId, issueKeys) {
    return retryRequest(async () => {
      const client = getJiraClient();
      await client.post(`/rest/agile/1.0/sprint/${sprintId}/issue`, {
        issues: issueKeys
      });
      return true;
    });
  },

  // Создать новый спринт
  async createSprint(name, boardId) {
    return retryRequest(async () => {
      const client = getJiraClient();
      const bId = boardId || db.getSettings().jiraBoardId;
      if (!bId) {
        throw new Error('Board ID is required to create a sprint.');
      }
      const response = await client.post('/rest/agile/1.0/sprint', {
        name,
        originBoardId: Number(bId)
      });
      return response.data;
    });
  },

  // Запустить спринт
  async startSprint(sprintId, startDate, endDate) {
    return retryRequest(async () => {
      const client = getJiraClient();
      const response = await client.post(`/rest/agile/1.0/sprint/${sprintId}`, {
        state: 'active',
        startDate: startDate || new Date().toISOString(),
        endDate: endDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      });
      return response.data;
    });
  },

  // Завершить спринт
  async completeSprint(sprintId) {
    return retryRequest(async () => {
      const client = getJiraClient();
      const response = await client.post(`/rest/agile/1.0/sprint/${sprintId}`, {
        state: 'closed'
      });
      return response.data;
    });
  },

  // Получить закрытые спринты и выполненные задачи для анализа скорости команды
  async getClosedSprintsAndIssues(boardId) {
    try {
      const sprintsResponse = await this.getSprints(boardId);
      const closedSprints = sprintsResponse.filter(s => s.state === 'closed') || [];
      const recentSprints = closedSprints.slice(-3);
      
      const history = [];
      const settings = db.getSettings();

      for (const sprint of recentSprints) {
        const issuesResponse = await this.getSprintIssues(sprint.id);
        const issues = issuesResponse || [];
        
        for (const issue of issues) {
          const spField = settings.storyPointsFieldId || 'customfield_10026';
          const storyPoints = issue.fields?.[spField] || null;
          
          history.push({
            sprintId: sprint.id,
            sprintName: sprint.name,
            key: issue.key,
            summary: issue.fields?.summary || '',
            description: issue.fields?.description || '',
            status: issue.fields?.status?.name || '',
            storyPoints: storyPoints ? Number(storyPoints) : null,
            priority: issue.fields?.priority?.name || '',
            assignee: issue.fields?.assignee?.displayName || issue.fields?.assignee?.name || ''
          });
        }
      }
      return history;
    } catch (error) {
      console.error('Failed to get closed sprints data:', error.message);
      return [];
    }
  }
};
