import axios from 'axios';
import { db } from '../database.js';
import { retryRequest } from './retry.js';

function getGitLabClient() {
  const settings = db.getSettings();
  const { gitlabUrl, gitlabToken } = settings;

  if (!gitlabUrl) {
    throw new Error('GitLab URL is not configured.');
  }
  if (!gitlabToken) {
    throw new Error('GitLab Token is not configured.');
  }

  const baseURL = gitlabUrl.endsWith('/') ? gitlabUrl.slice(0, -1) : gitlabUrl;

  return axios.create({
    baseURL: `${baseURL}`,
    headers: {
      'PRIVATE-TOKEN': gitlabToken,
      'Content-Type': 'application/json'
    },
    timeout: 12000
  });
}

export const gitlabService = {
  // Проверка соединения
  async testConnection() {
    try {
      const client = getGitLabClient();
      const response = await client.get('/api/v4/user');
      return { success: true, user: response.data };
    } catch (error) {
      console.error('GitLab connection failed:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.message || error.response?.statusText || error.message 
      };
    }
  },

  // Получить проекты (репозитории) пользователя
  async getProjects() {
    return retryRequest(async () => {
      const client = getGitLabClient();
      const response = await client.get('/api/v4/projects', {
        params: { min_access_level: 20, simple: true, per_page: 80, order_by: 'last_activity_at' }
      });
      return response.data.map(p => ({
        id: p.id,
        name: p.name,
        pathWithNamespace: p.path_with_namespace,
        webUrl: p.web_url,
        defaultBranch: p.default_branch
      }));
    });
  },

  // Получить ветки проекта
  async getBranches(projectId) {
    return retryRequest(async () => {
      const client = getGitLabClient();
      const response = await client.get(`/api/v4/projects/${projectId}/repository/branches`);
      return response.data.map(b => ({
        name: b.name,
        default: b.default,
        merged: b.merged
      }));
    });
  },

  // Получить коммиты проекта
  async getCommits(projectId, branch = 'main') {
    return retryRequest(async () => {
      const client = getGitLabClient();
      const response = await client.get(`/api/v4/projects/${projectId}/repository/commits`, {
        params: { ref_name: branch, per_page: 15 }
      });
      return response.data.map(c => ({
        id: c.short_id,
        title: c.title,
        authorName: c.author_name,
        createdAt: c.created_at,
        message: c.message
      }));
    });
  },

  // Получить дерево файлов репозитория
  async getFileTree(projectId, branch = 'main', path = '') {
    return retryRequest(async () => {
      const client = getGitLabClient();
      const response = await client.get(`/api/v4/projects/${projectId}/repository/tree`, {
        params: { ref: branch, path: path, per_page: 250, recursive: true }
      });
      return response.data.map(f => ({
        id: f.id,
        name: f.name,
        type: f.type, // 'tree' или 'blob'
        path: f.path
      }));
    });
  },

  // Получить содержимое файла
  async getFileContent(projectId, filePath, branch = 'main') {
    return retryRequest(async () => {
      const client = getGitLabClient();
      const encodedPath = encodeURIComponent(filePath);
      const response = await client.get(`/api/v4/projects/${projectId}/repository/files/${encodedPath}/raw`, {
        params: { ref: branch }
      });
      return response.data;
    });
  },

  // Получить Merge Requests проекта
  async getMergeRequests(projectId, state = 'opened') {
    return retryRequest(async () => {
      const client = getGitLabClient();
      const response = await client.get(`/api/v4/projects/${projectId}/merge_requests`, {
        params: { state, per_page: 20 }
      });
      return response.data.map(mr => ({
        id: mr.id,
        iid: mr.iid,
        title: mr.title,
        author: mr.author.name,
        state: mr.state,
        createdAt: mr.created_at,
        sourceBranch: mr.source_branch,
        targetBranch: mr.target_branch,
        webUrl: mr.web_url
      }));
    }).catch(e => {
      console.error(`Failed to fetch GitLab MRs for project ${projectId}:`, e.message);
      return [];
    });
  }
};
