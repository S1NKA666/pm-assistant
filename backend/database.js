import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'db.json');

const DEFAULT_DB = {
  settings: {
    jiraUrl: '',
    jiraEmail: '',
    jiraToken: '',
    jiraProjectKey: '',
    jiraBoardId: '',
    storyPointsFieldId: '',
    geminiApiKey: '',
    geminiModel: 'gemini-1.5-flash',
    gitlabUrl: 'https://gitlab.com',
    gitlabToken: ''
  },
  spaces: [],
  activeSpaceId: '',
  inbox: [],
  tasks: []
};

// Инициализация БД
function initDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
  } else {
    // Миграция: убедимся, что новые поля существуют
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      let modified = false;
      if (!data.spaces) {
        data.spaces = [];
        modified = true;
      }
      if (data.activeSpaceId === undefined) {
        data.activeSpaceId = '';
        modified = true;
      }
      if (!data.settings) {
        data.settings = DEFAULT_DB.settings;
        modified = true;
      }
      if (data.settings.geminiModel === undefined) {
        data.settings.geminiModel = 'gemini-1.5-flash';
        modified = true;
      }
      // Миграция пространств: одиночный gitlabProjectId -> массив gitlabProjectIds
      data.spaces.forEach(s => {
        if (s.gitlabProjectId && !s.gitlabProjectIds) {
          s.gitlabProjectIds = [String(s.gitlabProjectId)];
          delete s.gitlabProjectId;
          modified = true;
        }
        if (!s.gitlabProjectIds) {
          s.gitlabProjectIds = [];
          modified = true;
        }
        if (!s.documents) {
          s.documents = [];
          modified = true;
        }
      });
      if (modified) {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
      }
    } catch (e) {
      console.error('Migration failed:', e);
    }
  }
}

let inMemoryCache = null;

// Чтение всей БД
function readDb() {
  if (inMemoryCache) {
    return inMemoryCache;
  }
  initDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    inMemoryCache = JSON.parse(data);
    return inMemoryCache;
  } catch (error) {
    console.error('Error reading database file, returning default state:', error);
    return DEFAULT_DB;
  }
}

// Запись в БД
function writeDb(data) {
  inMemoryCache = data;
  try {
    // Пишем асинхронно на диск, чтобы не блокировать event loop
    fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf-8', (err) => {
      if (err) console.error('Error writing database file asynchronously:', err);
    });
    return true;
  } catch (error) {
    console.error('Error writing database file:', error);
    return false;
  }
}

export const db = {
  // Получить настройки
  getSettings() {
    const data = readDb();
    return data.settings || DEFAULT_DB.settings;
  },

  // Сохранить настройки
  saveSettings(newSettings) {
    const data = readDb();
    data.settings = { ...data.settings, ...newSettings };
    writeDb(data);
    return data.settings;
  },

  // --- SPACES METHODS ---
  getSpaces() {
    const data = readDb();
    return data.spaces || [];
  },

  addSpace({ name, jiraProjectKey, jiraBoardId, gitlabProjectIds }) {
    const data = readDb();
    const newSpace = {
      id: 'space_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      name,
      jiraProjectKey: jiraProjectKey || '',
      jiraBoardId: jiraBoardId || '',
      gitlabProjectIds: gitlabProjectIds || [],
      documents: []
    };
    data.spaces.push(newSpace);
    
    // Если активного пространства нет, сделаем это активным
    if (!data.activeSpaceId) {
      data.activeSpaceId = newSpace.id;
    }
    
    writeDb(data);
    return newSpace;
  },

  updateSpace(id, fields) {
    const data = readDb();
    const idx = data.spaces.findIndex(s => s.id === id);
    if (idx !== -1) {
      data.spaces[idx] = { ...data.spaces[idx], ...fields };
      writeDb(data);
      return data.spaces[idx];
    }
    return null;
  },

  addSpaceDocument(spaceId, doc) {
    const data = readDb();
    const idx = data.spaces.findIndex(s => s.id === spaceId);
    if (idx !== -1) {
      if (!data.spaces[idx].documents) {
        data.spaces[idx].documents = [];
      }
      const newDoc = {
        id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        ...doc,
        createdAt: new Date().toISOString()
      };
      data.spaces[idx].documents.push(newDoc);
      writeDb(data);
      return newDoc;
    }
    throw new Error('Space not found');
  },

  deleteSpaceDocument(spaceId, docId) {
    const data = readDb();
    const idx = data.spaces.findIndex(s => s.id === spaceId);
    if (idx !== -1) {
      if (data.spaces[idx].documents) {
        const docIdx = data.spaces[idx].documents.findIndex(d => d.id === docId);
        if (docIdx !== -1) {
          const deleted = data.spaces[idx].documents.splice(docIdx, 1)[0];
          writeDb(data);
          return deleted;
        }
      }
      return null;
    }
    throw new Error('Space not found');
  },

  deleteSpace(id) {
    const data = readDb();
    data.spaces = data.spaces.filter(s => s.id !== id);
    
    // Если удалили активное пространство, переключим на другое или очистим
    if (data.activeSpaceId === id) {
      data.activeSpaceId = data.spaces[0]?.id || '';
    }
    
    writeDb(data);
  },

  getActiveSpaceId() {
    const data = readDb();
    return data.activeSpaceId || '';
  },

  setActiveSpaceId(id) {
    const data = readDb();
    data.activeSpaceId = id;
    writeDb(data);
    return id;
  },

  // --- INBOX METHODS ---
  getInbox() {
    const data = readDb();
    return data.inbox || [];
  },

  // Добавить запись в Inbox
  addInboxItem({ source, content, title = '', spaceId = null }) {
    const data = readDb();
    const newItem = {
      id: 'inbox_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      source,
      title: title || `${source.toUpperCase()} Ingest - ${new Date().toLocaleString()}`,
      content,
      spaceId: spaceId || data.activeSpaceId || null,
      timestamp: new Date().toISOString(),
      status: 'unprocessed'
    };
    data.inbox.unshift(newItem);
    writeDb(data);
    return newItem;
  },

  // Удалить запись из Inbox
  deleteInboxItem(id) {
    const data = readDb();
    data.inbox = data.inbox.filter(item => item.id !== id);
    data.tasks = data.tasks.filter(task => task.inboxId !== id);
    writeDb(data);
  },

  // --- TASKS (DRAFTS) METHODS ---
  getTasks() {
    const data = readDb();
    return data.tasks || [];
  },

  // Добавить задачи
  addTasks(tasksList) {
    const data = readDb();
    const createdTasks = [];
    for (const t of tasksList) {
      const newTask = {
        id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        inboxId: t.inboxId || null,
        spaceId: t.spaceId || data.activeSpaceId || null,
        summary: t.summary || 'New Task',
        description: t.description || '',
        priority: t.priority || 'Medium',
        assignee: t.assignee || '',
        storyPoints: t.storyPoints || null,
        status: 'draft',
        jiraKey: null,
        timestamp: new Date().toISOString()
      };
      data.tasks.unshift(newTask);
      createdTasks.push(newTask);
    }
    writeDb(data);
    return createdTasks;
  },

  // Обновить задачу (черновик)
  updateTask(id, fields) {
    const data = readDb();
    const idx = data.tasks.findIndex(t => t.id === id);
    if (idx !== -1) {
      data.tasks[idx] = { ...data.tasks[idx], ...fields };
      writeDb(data);
      return data.tasks[idx];
    }
    return null;
  },

  // Удалить задачу
  deleteTask(id) {
    const data = readDb();
    data.tasks = data.tasks.filter(t => t.id !== id);
    writeDb(data);
  },

  // Добавить одну задачу
  addTask(t) {
    const data = readDb();
    const newTask = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      inboxId: t.inboxId || null,
      spaceId: t.spaceId || data.activeSpaceId || null,
      summary: t.summary || 'New Task',
      description: t.description || '',
      priority: t.priority || 'Medium',
      assignee: t.assignee || '',
      storyPoints: t.storyPoints || null,
      taskType: t.taskType || null,
      dueDate: t.dueDate || null,
      sourceDocument: t.sourceDocument || null,
      status: 'draft',
      jiraKey: null,
      timestamp: new Date().toISOString()
    };
    data.tasks.unshift(newTask);
    writeDb(data);
    return newTask;
  },

  // Пометить элемент Inbox как обработанный
  markInboxProcessed(id) {
    const data = readDb();
    const idx = data.inbox.findIndex(item => item.id === id);
    if (idx !== -1) {
      data.inbox[idx].status = 'processed';
      writeDb(data);
    }
  }
};
