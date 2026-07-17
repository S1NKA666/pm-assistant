const API_BASE = 'http://localhost:5000/api';

async function request(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errMsg = `Request failed with status ${response.status}`;
    try {
      const errBody = await response.json();
      errMsg = errBody.error || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  return response.json();
}

export const api = {
  // Settings
  getSettings() {
    return request('/settings');
  },
  saveSettings(settings) {
    return request('/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },

  // Inbox
  getInbox() {
    return request('/inbox');
  },
  deleteInboxItem(id) {
    return request(`/inbox/${id}`, {
      method: 'DELETE',
    });
  },
  ingestText({ source, content, title }) {
    return request('/ingest', {
      method: 'POST',
      body: JSON.stringify({ source, content, title }),
    });
  },
  ingestAudioFile(formData) {
    // Для FormData мы не должны ставить Content-Type: application/json
    return fetch(`${API_BASE}/ingest/file`, {
      method: 'POST',
      body: formData,
    }).then(async res => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Audio processing failed');
      }
      return res.json();
    });
  },
  analyzeInboxItem(id) {
    return request(`/inbox/${id}/analyze`, {
      method: 'POST',
    });
  },

  // Tasks (Drafts)
  getTasks() {
    return request('/tasks');
  },
  createTask(task) {
    return request('/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
  },
  updateTask(id, fields) {
    return request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(fields),
    });
  },
  deleteTask(id) {
    return request(`/tasks/${id}`, {
      method: 'DELETE',
    });
  },
  pushTaskToJira(id, sprintId = null, projectKey = null) {
    return request(`/tasks/${id}/push`, {
      method: 'POST',
      body: JSON.stringify({ sprintId, projectKey }),
    });
  },

  // Jira Integration Proxy
  testJira() {
    return request('/jira/test');
  },
  getJiraProjects() {
    return request('/jira/projects');
  },
  getJiraBoards() {
    return request('/jira/boards');
  },
  getJiraSprints(boardId) {
    return request(`/jira/sprints?boardId=${boardId || ''}`);
  },
  getSprintIssues(sprintId) {
    return request(`/jira/sprint/${sprintId}/issues`);
  },
  getJiraBacklog(boardId, projectKey = '') {
    return request(`/jira/backlog?boardId=${boardId || ''}&projectKey=${projectKey || ''}`);
  },
  createSprint(name, boardId) {
    return request('/jira/sprint', {
      method: 'POST',
      body: JSON.stringify({ name, boardId }),
    });
  },
  startSprint(sprintId, startDate, endDate) {
    return request(`/jira/sprint/${sprintId}/start`, {
      method: 'POST',
      body: JSON.stringify({ startDate, endDate }),
    });
  },
  completeSprint(sprintId) {
    return request(`/jira/sprint/${sprintId}/complete`, {
      method: 'POST',
    });
  },
  addIssuesToSprint(sprintId, issueKeys) {
    return request(`/jira/sprint/${sprintId}/add-issues`, {
      method: 'POST',
      body: JSON.stringify({ issueKeys }),
    });
  },
  searchJiraUsers(query) {
    return request(`/jira/users?query=${encodeURIComponent(query)}`);
  },

  // Spaces Integration
  getSpaces() {
    return request('/spaces');
  },
  createSpace(space) {
    return request('/spaces', {
      method: 'POST',
      body: JSON.stringify(space),
    });
  },
  updateSpace(id, fields) {
    return request(`/spaces/${id}`, {
      method: 'PUT',
      body: JSON.stringify(fields),
    });
  },
  deleteSpace(id) {
    return request(`/spaces/${id}`, {
      method: 'DELETE',
    });
  },
  getActiveSpaceId() {
    return request('/spaces/active');
  },
  setActiveSpaceId(id) {
    return request('/spaces/active', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
  },
  analyzeSpaceContext(id) {
    return request(`/spaces/${id}/analyze-context`, {
      method: 'POST',
    });
  },
  getSprintHealth(id) {
    // Force Vite reload comment
    return request(`/spaces/${id}/sprint-health`);
  },
  transitionJiraIssue(spaceId, issueKey, transitionName) {
    return request(`/spaces/${spaceId}/transition-issue`, {
      method: 'POST',
      body: JSON.stringify({ issueKey, transitionName })
    });
  },
  uploadSpaceFile(spaceId, formData) {
    return fetch(`http://localhost:5000/api/spaces/${spaceId}/documents/file`, {
      method: 'POST',
      body: formData,
    }).then(async res => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to upload space file');
      }
      return res.json();
    });
  },
  addSpaceLink(spaceId, name, url) {
    return request(`/spaces/${spaceId}/documents/link`, {
      method: 'POST',
      body: JSON.stringify({ name, url }),
    });
  },
  deleteSpaceDocument(spaceId, docId) {
    return request(`/spaces/${spaceId}/documents/${docId}`, {
      method: 'DELETE',
    });
  },
  getSprintProposal(id) {
    return request(`/spaces/${id}/sprint-proposal`, {
      method: 'POST',
    });
  },
  getGeminiModels() {
    return request('/gemini/models');
  },

  // GitLab Integration
  testGitLab() {
    return request('/gitlab/test');
  },
  getGitLabProjects() {
    return request('/gitlab/projects');
  },
  getGitLabBranches(projectId) {
    return request(`/gitlab/projects/${projectId}/branches`);
  },
  getGitLabCommits(projectId, branch) {
    return request(`/gitlab/projects/${projectId}/commits?branch=${branch || ''}`);
  },
  getGitLabTree(projectId, branch, path) {
    return request(`/gitlab/projects/${projectId}/tree?branch=${branch || ''}&path=${encodeURIComponent(path || '')}`);
  },
  getGitLabFileContent(projectId, filePath, branch) {
    // Возвращает текст файла напрямую, поэтому не используем общую функцию request, которая парсит JSON
    const url = `http://localhost:5000/api/gitlab/projects/${projectId}/file?branch=${branch || ''}&filePath=${encodeURIComponent(filePath)}`;
    return fetch(url).then(res => {
      if (!res.ok) throw new Error('Failed to fetch file content');
      return res.text();
    });
  }
};
