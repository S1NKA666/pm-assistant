import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { db } from './database.js';
import { extractTasksFromText, extractTasksFromAudio, analyzeProjectContext, generateSprintProposal, generateSprintHealthReport } from './services/ai.js';
import { jiraService } from './services/jira.js';
import { gitlabService } from './services/gitlab.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 5000;

// Убедимся, что папка uploads существует
const UPLOADS_DIR = './uploads';
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Настройка multer для загрузки файлов в память
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // Лимит 100MB для длинных аудиозаписей
});

// --- INGEST ENDPOINTS ---

// Входящие сообщения (текст/чаты из Chrome Extension)
app.post('/api/ingest', async (req, res) => {
  const { source, title, messages, content } = req.body;
  
  try {
    const existingInbox = db.getInbox();
    const allImportedIds = new Set();
    existingInbox.forEach(item => {
      if (item.messageIds) {
        item.messageIds.forEach(id => allImportedIds.add(id));
      }
    });

    let newMessages = [];
    let addedCount = 0;
    let messageIdsToSave = [];

    if (messages && Array.isArray(messages)) {
      newMessages = messages.filter(m => m.id && !allImportedIds.has(m.id));
      addedCount = newMessages.length;

      if (addedCount === 0) {
        return res.json({ message: 'No new messages found.', addedCount: 0 });
      }

      const MEDIA_DIR = './uploads/media';
      if (!fs.existsSync(MEDIA_DIR)) {
        fs.mkdirSync(MEDIA_DIR, { recursive: true });
      }

      let formattedTextLines = [];
      newMessages.forEach(msg => {
        let text = msg.text || "";
        messageIdsToSave.push(msg.id);

        if (msg.media && msg.media.length > 0) {
          const savedUrls = [];
          msg.media.forEach(base64 => {
            try {
              const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
              const filename = `media_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.png`;
              const mediaPath = path.join(MEDIA_DIR, filename);
              fs.writeFileSync(mediaPath, base64Data, 'base64');
              savedUrls.push(`http://localhost:5000/uploads/media/${filename}`);
            } catch (mediaErr) {
              console.error('Failed to save base64 media:', mediaErr);
            }
          });
          if (savedUrls.length > 0) {
            text += `\n[Прикрепленные файлы/скриншоты: ${savedUrls.join(', ')}]`;
          }
        }
        formattedTextLines.push(text);
      });

      const finalContent = formattedTextLines.join('\n');
      const activeSpaceId = db.getActiveSpaceId();

      const item = db.addInboxItem({
        source,
        content: finalContent,
        title: title || `Chat Import (${addedCount})`,
        spaceId: activeSpaceId,
        messageIds: messageIdsToSave
      });

      return res.status(201).json({ ...item, addedCount });
    } else {
      if (!source || !content) {
        return res.status(400).json({ error: 'Source and content or messages are required.' });
      }
      const activeSpaceId = db.getActiveSpaceId();
      const item = db.addInboxItem({ source, content, title, spaceId: activeSpaceId });
      return res.status(201).json({ ...item, addedCount: 1 });
    }
  } catch (error) {
    console.error('Ingest error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Входящие файлы (аудиозаписи встреч)
app.post('/api/ingest/file', upload.single('file'), async (req, res) => {
  const { source, title } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const src = source || 'audio';
  const fileTitle = title || file.originalname;

  try {
    console.log(`Processing audio file: ${fileTitle}, size: ${file.size} bytes`);
    
    // Получаем контекст активного пространства
    const activeSpaceId = db.getActiveSpaceId();
    const spaces = db.getSpaces();
    const space = spaces.find(s => s.id === activeSpaceId);
    const contextProfile = space?.contextProfile || null;

    // Загружаем дерево файлов репозиториев пространства
    let codebaseTree = [];
    if (space && space.gitlabProjectIds && space.gitlabProjectIds.length > 0) {
      for (const repoId of space.gitlabProjectIds) {
        try {
          const repoFiles = await gitlabService.getFileTree(repoId, undefined, '').catch(() => []);
          codebaseTree = codebaseTree.concat(repoFiles.map(f => ({ ...f, repoId })));
        } catch (err) {
          console.error(`Failed to load file tree for repo ${repoId} during audio ingest:`, err);
        }
      }
    }

    // Вызываем Gemini для извлечения задач из аудио
    const tasks = await extractTasksFromAudio(file.buffer, file.mimetype, contextProfile, codebaseTree);
    
    // Создаем запись в Inbox с привязкой к пространству
    const inboxItem = db.addInboxItem({
      source: src,
      content: `Audio file "${fileTitle}" uploaded (${(file.size / (1024 * 1024)).toFixed(2)} MB). AI processed tasks directly from audio.`,
      title: fileTitle,
      spaceId: activeSpaceId
    });

    // Привязываем задачи к inbox и пространству
    const tasksWithRef = tasks.map(t => ({ ...t, inboxId: inboxItem.id, spaceId: activeSpaceId }));
    const createdTasks = db.addTasks(tasksWithRef);

    db.markInboxProcessed(inboxItem.id);

    res.status(201).json({
      message: 'Audio processed successfully',
      inboxItem,
      tasks: createdTasks
    });
  } catch (error) {
    console.error('Audio ingest error:', error);
    res.status(500).json({ error: `Audio processing failed: ${error.message}` });
  }
});

// Получить список Inbox
app.get('/api/inbox', (req, res) => {
  res.json(db.getInbox());
});

// Удалить элемент Inbox
app.delete('/api/inbox/:id', (req, res) => {
  db.deleteInboxItem(req.params.id);
  res.json({ success: true });
});

// Запустить анализ ИИ для текстового Inbox-элемента
app.post('/api/inbox/:id/analyze', async (req, res) => {
  const { id } = req.params;
  const inbox = db.getInbox();
  const item = inbox.find(i => i.id === id);

  if (!item) {
    return res.status(404).json({ error: 'Inbox item not found.' });
  }

  try {
    console.log(`Analyzing text for inbox item: ${item.title}`);
    
    // Находим контекст пространства для этого лога
    const spaces = db.getSpaces();
    const space = spaces.find(s => s.id === item.spaceId);
    const contextProfile = space?.contextProfile || null;

    // Загружаем дерево файлов репозиториев пространства
    let codebaseTree = [];
    if (space && space.gitlabProjectIds && space.gitlabProjectIds.length > 0) {
      for (const repoId of space.gitlabProjectIds) {
        try {
          const repoFiles = await gitlabService.getFileTree(repoId, undefined, '').catch(() => []);
          codebaseTree = codebaseTree.concat(repoFiles.map(f => ({ ...f, repoId })));
        } catch (err) {
          console.error(`Failed to load file tree for repo ${repoId} during inbox analysis:`, err);
        }
      }
    }

    const tasks = await extractTasksFromText(item.content, contextProfile, codebaseTree);
    
    // Привязываем к источнику и пространству
    const tasksWithRef = tasks.map(t => ({ 
      ...t, 
      inboxId: item.id, 
      spaceId: item.spaceId || null 
    }));
    const createdTasks = db.addTasks(tasksWithRef);
    
    db.markInboxProcessed(id);

    res.json({ success: true, tasks: createdTasks });
  } catch (error) {
    console.error('Text analysis error:', error);
    res.status(500).json({ error: `Analysis failed: ${error.message}` });
  }
});

// --- TASKS (DRAFTS) ENDPOINTS ---

// Получить все черновики задач
app.get('/api/tasks', (req, res) => {
  res.json(db.getTasks());
});

// Создать черновик вручную
app.post('/api/tasks', (req, res) => {
  const created = db.addTasks([req.body]);
  res.status(201).json(created[0]);
});

// Обновить черновик
app.put('/api/tasks/:id', (req, res) => {
  const updated = db.updateTask(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Task not found.' });
  }
  res.json(updated);
});

// Удалить черновик
app.delete('/api/tasks/:id', (req, res) => {
  db.deleteTask(req.params.id);
  res.json({ success: true });
});

// Пуш задачи в JIRA
app.post('/api/tasks/:id/push', async (req, res) => {
  const { id } = req.params;
  const tasks = db.getTasks();
  const task = tasks.find(t => t.id === id);

  if (!task) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  try {
    console.log(`Pushing task to JIRA: ${task.summary}`);
    // Передаем также ID спринта, если он прислан с фронтенда
    const jiraIssue = await jiraService.createIssue({
      summary: task.summary,
      description: task.description,
      priority: task.priority,
      assignee: task.assignee || null,
      storyPoints: task.storyPoints || null,
      sprintId: req.body.sprintId || null,
      projectKey: req.body.projectKey || null
    });

    // Обновляем статус в нашей базе
    const updated = db.updateTask(id, {
      status: 'pushed',
      jiraKey: jiraIssue.key
    });

    res.json({ success: true, task: updated });
  } catch (error) {
    console.error('Push to JIRA failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- SPACES ENDPOINTS ---

app.get('/api/spaces', (req, res) => {
  res.json(db.getSpaces());
});

app.post('/api/spaces', (req, res) => {
  const { name, jiraProjectKey, jiraBoardId, gitlabProjectIds } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const created = db.addSpace({ name, jiraProjectKey, jiraBoardId, gitlabProjectIds });
  res.status(201).json(created);
});

app.put('/api/spaces/:id', (req, res) => {
  const updated = db.updateSpace(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Space not found' });
  res.json(updated);
});

app.delete('/api/spaces/:id', (req, res) => {
  db.deleteSpace(req.params.id);
  res.json({ success: true });
});

// Загрузка локального файла для пространства
app.post('/api/spaces/:id/documents/file', upload.single('file'), async (req, res) => {
  const { id } = req.params;
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  try {
    const originalName = Buffer.from(file.originalname, 'binary').toString('utf8');
    const filename = `${Date.now()}_${originalName}`;
    const filePath = path.join(UPLOADS_DIR, filename);
    
    fs.writeFileSync(filePath, file.buffer);

    const doc = {
      type: 'file',
      name: originalName,
      path: filePath,
      size: file.size,
      mimeType: file.mimetype
    };

    const newDoc = db.addSpaceDocument(id, doc);
    res.status(201).json(newDoc);
  } catch (err) {
    console.error('Failed to upload space document:', err);
    res.status(500).json({ error: err.message });
  }
});

// Добавление ссылки (Google Drive / Web) для пространства
app.post('/api/spaces/:id/documents/link', (req, res) => {
  const { id } = req.params;
  const { name, url } = req.body;
  if (!name || !url) {
    return res.status(400).json({ error: 'Name and URL are required.' });
  }
  try {
    const doc = {
      type: 'link',
      name,
      url
    };
    const newDoc = db.addSpaceDocument(id, doc);
    res.status(201).json(newDoc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Удаление документа пространства
app.delete('/api/spaces/:id/documents/:docId', (req, res) => {
  const { id, docId } = req.params;
  try {
    const deleted = db.deleteSpaceDocument(id, docId);
    if (deleted && deleted.type === 'file' && deleted.path) {
      if (fs.existsSync(deleted.path)) {
        fs.unlinkSync(deleted.path);
      }
    }
    res.json({ success: true, deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/spaces/active', (req, res) => {
  res.json({ activeSpaceId: db.getActiveSpaceId() });
});

app.post('/api/spaces/active', (req, res) => {
  const { id } = req.body;
  const activeId = db.setActiveSpaceId(id);
  res.json({ activeSpaceId: activeId });
});

// --- AI PLANNED AGILITY ENDPOINTS ---

app.post('/api/spaces/:id/analyze-context', async (req, res) => {
  const { id } = req.params;
  const spaces = db.getSpaces();
  const space = spaces.find(s => s.id === id);
  if (!space) return res.status(404).json({ error: 'Space not found' });

  try {
    console.log(`Analyzing project context for Space: ${space.name}`);
    
    // 0. Защита от лимитов (Rate Limit Guard): делаем динамический запрос к Google API
    const settings = db.getSettings();
    const apiKey = settings.geminiApiKey;
    const modelName = settings.geminiModel || 'gemini-1.5-flash';
    
    let tokenLimit = 900000;
    let inputTokenLimit = 1048576;
    
    try {
      if (apiKey) {
        console.log(`[Rate Limit Guard] Querying live Google API models specifications...`);
        const modelsRes = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const modelsList = modelsRes.data.models || [];
        
        const cleanName = modelName.replace(/^models\//, '');
        const selectedModel = modelsList.find(m => m.name.replace(/^models\//, '') === cleanName);
        
        if (selectedModel) {
          inputTokenLimit = selectedModel.inputTokenLimit || inputTokenLimit;
          console.log(`[Rate Limit Guard] Found model: ${selectedModel.displayName}. Input Token Limit: ${inputTokenLimit}`);
          
          const lowerName = cleanName.toLowerCase();
          if (lowerName.includes('gemma')) {
            tokenLimit = 15000;
          } else if (lowerName.includes('pro')) {
            tokenLimit = 30000;
          } else if (lowerName.includes('flash')) {
            tokenLimit = 900000;
          } else {
            tokenLimit = Math.min(80000, inputTokenLimit * 0.8);
          }
        }
      }
    } catch (apiErr) {
      console.error('[Rate Limit Guard] Failed to query live models specifications, using fallback.', apiErr.message);
      const lower = modelName.toLowerCase();
      if (lower.includes('gemma')) tokenLimit = 15000;
      else if (lower.includes('pro')) tokenLimit = 30000;
      else if (lower.includes('flash')) tokenLimit = 900000;
    }
    
    let maxFiles = 55;
    let maxBytesPerFile = 8000;
    let maxJiraIssues = 60;
    let maxDocBytes = 15000;
    
    if (tokenLimit < 20000) { // Gemma (15K TPM)
      maxFiles = 2;
      maxBytesPerFile = 1500;
      maxJiraIssues = 4;
      maxDocBytes = 1500;
      console.log(`[Rate Limit Guard] Restricting context size for Gemma (TPM limit: ${tokenLimit})`);
    } else if (tokenLimit < 50000) { // Gemini 1.5 Pro (32K TPM)
      maxFiles = 6;
      maxBytesPerFile = 2500;
      maxJiraIssues = 12;
      maxDocBytes = 3500;
      console.log(`[Rate Limit Guard] Restricting context size for Gemini Pro (TPM limit: ${tokenLimit})`);
    }

    // 1. Загружаем историю закрытых задач
    const rawHistory = await jiraService.getClosedSprintsAndIssues(space.jiraBoardId).catch(() => []);
    const history = rawHistory.slice(0, maxJiraIssues);
    
    // 2. Загружаем текущий бэклог по ключу проекта JIRA
    const backlog = await jiraService.getProjectBacklog(space.jiraProjectKey).catch(() => []);
    
    // 3. Загружаем файловые деревья для всех привязанных репозиториев GitLab
    let files = [];
    const repoIds = space.gitlabProjectIds || [];
    for (const repoId of repoIds) {
      try {
        const repoFiles = await gitlabService.getFileTree(repoId, undefined, '').catch(() => []);
        files = files.concat(repoFiles.map(f => ({ ...f, repoId })));
      } catch (err) {
        console.error(`Failed to load file tree for repo ${repoId}:`, err);
      }
    }

    // 3.5 Ищем и загружаем контент ключевых файлов исходного кода
    let codebaseSnippets = [];
    const sourceCodeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.go', '.java', '.php', '.html', '.sql', '.css'];
    
    const isSourceCodeFile = (path) => {
      const lower = path.toLowerCase();
      const hasSrcExt = sourceCodeExtensions.some(ext => lower.endsWith(ext));
      const isTestOrAsset = lower.includes('test') || 
                            lower.includes('spec') || 
                            lower.includes('mocks') || 
                            lower.includes('assets/') || 
                            lower.includes('images/') || 
                            lower.includes('.min.') ||
                            lower.includes('package-lock.json') ||
                            lower.includes('yarn.lock');
      return hasSrcExt && !isTestOrAsset;
    };

    const sourceFiles = files.filter(f => f.type === 'blob' && isSourceCodeFile(f.path));
    
    // Ограничиваемся на основе квот выбранной модели
    const filesToLoad = sourceFiles.slice(0, maxFiles);
    console.log(`Downloading ${filesToLoad.length} source code files for deep semantic analysis...`);

    const loadFileContent = async (f) => {
      try {
        const content = await gitlabService.getFileContent(f.repoId, f.path).catch(() => null);
        if (content) {
          return {
            path: f.path,
            content: content.substring(0, maxBytesPerFile)
          };
        }
      } catch (err) {
        console.error(`Failed to load contents for file ${f.path}:`, err);
      }
      return null;
    };

    const loadedSnippets = await Promise.all(filesToLoad.map(loadFileContent));
    codebaseSnippets = loadedSnippets.filter(Boolean);

    // 3.8 Загружаем документы пространства (ТЗ, файлы, ссылки)
    let spaceDocuments = [];
    const spaceDocs = space.documents || [];
    for (const doc of spaceDocs) {
      if (doc.type === 'file') {
        const ext = path.extname(doc.name).toLowerCase();
        if (['.txt', '.md', '.json', '.csv', '.xml'].includes(ext)) {
          try {
            if (fs.existsSync(doc.path)) {
              const content = fs.readFileSync(doc.path, 'utf-8');
              spaceDocuments.push({
                type: 'file',
                name: doc.name,
                content: content.substring(0, maxDocBytes)
              });
            }
          } catch (docErr) {
            console.error(`Failed to read space document file ${doc.name}:`, docErr);
          }
        } else {
          spaceDocuments.push({
            type: 'file',
            name: doc.name,
            mimeType: doc.mimeType,
            size: doc.size
          });
        }
      } else if (doc.type === 'link') {
        spaceDocuments.push({
          type: 'link',
          name: doc.name,
          url: doc.url
        });
      }
    }

    // 4. Просим Gemini проанализировать (передаем историю, бэклог, структуру, код файлов и документы ТЗ)
    const contextProfile = await analyzeProjectContext(history, backlog, files, codebaseSnippets, spaceDocuments);
    
    // 5. Записываем профиль в пространство
    const updated = db.updateSpace(id, { contextProfile });
    res.json(updated);
  } catch (error) {
    console.error('Failed to analyze project context:', error);
    res.status(500).json({ error: `Context analysis failed: ${error.message}` });
  }
});

app.post('/api/spaces/:id/sprint-proposal', async (req, res) => {
  const { id } = req.params;
  const spaces = db.getSpaces();
  const space = spaces.find(s => s.id === id);
  if (!space) return res.status(404).json({ error: 'Space not found' });

  try {
    console.log(`Generating AI sprint proposal for Space: ${space.name}`);
    
    // 1. Загружаем текущие спринты и бэклог по ключу проекта JIRA
    const sprints = await jiraService.getSprints(space.jiraBoardId).catch(() => []);
    const backlog = await jiraService.getProjectBacklog(space.jiraProjectKey).catch(() => []);
    const completedSprintsCount = sprints.filter(s => s.state === 'closed').length;

    // 2. Получаем невыполненные задачи активного спринта
    const activeSprint = sprints.find(s => s.state === 'active');
    const activeSprintIssues = activeSprint ? await jiraService.getSprintIssues(activeSprint.id).catch(() => []) : [];
    
    const unfinishedIssues = activeSprintIssues.filter(issue => {
      const statusCategory = issue.fields?.status?.statusCategory?.key || '';
      return statusCategory.toLowerCase() !== 'done';
    }).map(issue => ({
      key: issue.key,
      summary: issue.fields?.summary,
      priority: issue.fields?.priority?.name,
      storyPoints: issue.fields?.[space.contextProfile?.storyPointsFieldId || 'customfield_10026'] || null,
      status: issue.fields?.status?.name
    }));

    // 3. Загружаем документы пространства — читаем содержимое Google Drive файлов
    let spaceDocuments = [];
    const spaceDocs = space.documents || [];

    // Вспомогательная функция: скачать содержимое по URL
    const fetchUrlContent = async (url, label) => {
      try {
        const { default: fetch } = await import('node-fetch');
        const resp = await fetch(url, {
          timeout: 20000,
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; PM-Assistant/1.0)',
            'Accept': 'text/csv,text/plain,*/*'
          }
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await resp.text();
        // Определяем, получили ли мы страницу входа Google вместо данных
        if (text.includes('<html') && (text.includes('accounts.google.com') || text.includes('Sign in') || text.includes('ServiceLogin'))) {
          throw new Error('Требуется авторизация Google');
        }
        // Если это HTML но не страница логина — тоже не то
        if (text.trimStart().startsWith('<!DOCTYPE html') || text.trimStart().startsWith('<html')) {
          throw new Error('Получен HTML вместо данных (возможно, требуется авторизация)');
        }
        return text.substring(0, 40000); // Лимит: 40 КБ на файл
      } catch (e) {
        console.warn(`[SprintPlanner] Не удалось скачать "${label}" (${url.substring(0, 60)}): ${e.message}`);
        return null;
      }
    };

    // Конвертировать Google Drive ссылку в список кандидатов URL для скачивания
    const getGoogleDriveExportCandidates = (url) => {
      // Google Sheets: /spreadsheets/d/{ID}/...
      const sheetsMatch = url.match(/\/spreadsheets\/d\/([-\w]+)/);
      if (sheetsMatch) {
        const id = sheetsMatch[1];
        // Извлечь gid из URL если есть
        const gidMatch = url.match(/[?&]gid=(\d+)/);
        const gid = gidMatch ? gidMatch[1] : null;
        const candidates = [];
        if (gid) candidates.push(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`);
        candidates.push(
          `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`,          // без gid
          `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv`,        // gviz API
          `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=0`,    // gid=0
          `https://docs.google.com/spreadsheets/d/${id}/export?format=tsv`,          // TSV fallback
        );
        return { candidates, type: 'Google Sheets (CSV)' };
      }
      // Google Docs: /document/d/{ID}/...
      const docsMatch = url.match(/\/document\/d\/([-\w]+)/);
      if (docsMatch) {
        const id = docsMatch[1];
        return {
          candidates: [
            `https://docs.google.com/document/d/${id}/export?format=txt`,
            `https://docs.google.com/document/d/${id}/export?format=md`,
          ],
          type: 'Google Docs (text)'
        };
      }
      // /file/d/{ID} → прямая загрузка
      const fileMatch = url.match(/\/file\/d\/([-\w]+)/);
      if (fileMatch) {
        const id = fileMatch[1];
        return {
          candidates: [
            `https://drive.google.com/uc?export=download&id=${id}`,
            `https://drive.google.com/uc?id=${id}&export=download`,
          ],
          type: 'Google Drive file'
        };
      }
      return null;
    };

    for (const doc of spaceDocs) {
      if (doc.type === 'file') {
        // Локально загруженный файл
        const ext = path.extname(doc.name).toLowerCase();
        if (['.txt', '.md', '.json', '.csv', '.xml'].includes(ext)) {
          try {
            if (fs.existsSync(doc.path)) {
              const content = fs.readFileSync(doc.path, 'utf-8');
              spaceDocuments.push({
                type: 'file',
                name: doc.name,
                content: content.substring(0, 25000)
              });
            }
          } catch (docErr) {
            console.error(`Failed to read doc for sprint planner:`, docErr);
          }
        } else {
          spaceDocuments.push({ type: 'file', name: doc.name, mimeType: doc.mimeType, size: doc.size });
        }
      } else if (doc.type === 'link') {
        // Ссылка — пробуем получить содержимое перебирая варианты URL
        const gdInfo = getGoogleDriveExportCandidates(doc.url);
        if (gdInfo) {
          console.log(`[SprintPlanner] Скачиваем "${doc.name}" как ${gdInfo.type} (${gdInfo.candidates.length} вариантов)...`);
          let content = null;
          for (const candidateUrl of gdInfo.candidates) {
            content = await fetchUrlContent(candidateUrl, doc.name);
            if (content) break;
          }
          if (content) {
            spaceDocuments.push({
              type: gdInfo.type,
              name: doc.name,
              url: doc.url,
              content  // ← РЕАЛЬНОЕ СОДЕРЖИМОЕ ТАБЛИЦЫ/ДОКУМЕНТА
            });
            console.log(`[SprintPlanner] ✓ "${doc.name}" загружен (${content.length} символов)`);
          } else {
            console.warn(`[SprintPlanner] ✗ Все варианты загрузки "${doc.name}" не сработали. Таблица должна быть открыта для просмотра без авторизации.`);
            spaceDocuments.push({ type: 'link', name: doc.name, url: doc.url, note: 'Не удалось загрузить — проверьте что файл открыт по ссылке без авторизации' });
          }
        } else {
          // Не Google Drive — просто URL
          spaceDocuments.push({ type: 'link', name: doc.name, url: doc.url });
        }
      }
    }

    console.log(`[SprintPlanner] Документов с содержимым: ${spaceDocuments.filter(d => d.content).length}/${spaceDocuments.length}`);

    const nextSprintNumber = completedSprintsCount + 1;

    // Даты активного спринта для планировщика
    const sprintDates = activeSprint ? {
      startDate: activeSprint.startDate || null,
      endDate: activeSprint.endDate || null,
      name: activeSprint.name || `Sprint ${nextSprintNumber}`
    } : null;

    // 4. Запускаем ИИ-Планировщик
    const proposal = await generateSprintProposal(
      backlog.map(issue => ({
        key: issue.key,
        summary: issue.fields?.summary,
        priority: issue.fields?.priority?.name,
        storyPoints: issue.fields?.[space.contextProfile?.storyPointsFieldId || 'customfield_10026'] || null,
        dueDate: issue.fields?.duedate || null,
        assignee: issue.fields?.assignee?.displayName || ''
      })),
      unfinishedIssues,
      spaceDocuments,
      sprintDates,
      nextSprintNumber
    );

    // 5. Автоматически создаем новые обнаруженные требования в качестве черновиков локальных задач
    if (proposal.newDraftTasksToCreate && Array.isArray(proposal.newDraftTasksToCreate)) {
      proposal.newDraftTasksToCreate.forEach(draft => {
        // Создаем лог во входящих
        db.addInboxItem({
          source: 'sprint_planner',
          title: draft.summary,
          content: `[Авто-черновик из ТЗ/Google Sheets при планировании Спринта #${nextSprintNumber}]\n\nОписание: ${draft.description}\nПриоритет: ${draft.priority}\nОценка: ${draft.storyPoints || ''} SP`,
          spaceId: id
        });
        
        // Создаем черновик задачи с полными метаданными от ИИ
        db.addTask({
          summary: draft.summary,
          description: draft.description || '',
          priority: draft.priority || 'Medium',
          assignee: draft.assignee || '',
          storyPoints: draft.storyPoints ? Number(draft.storyPoints) : null,
          status: 'draft',
          spaceId: id,
          taskType: draft.taskType || null,          // frontend/backend/fullstack/etc
          dueDate: draft.dueDate || null,             // Срок из таблицы
          sourceDocument: draft.sourceDocument || null // Источник (название Google Sheet)
        });
      });
    }

    res.json(proposal);
  } catch (error) {
    console.error('Failed to generate sprint proposal:', error);
    res.status(500).json({ error: `Sprint proposal failed: ${error.message}` });
  }
});

// Отчет о здоровье спринта ИИ
app.get('/api/spaces/:id/sprint-health', async (req, res) => {
  const { id } = req.params;
  const spaces = db.getSpaces();
  const space = spaces.find(s => s.id === id);
  if (!space) return res.status(404).json({ error: 'Space not found' });

  try {
    console.log(`Analyzing Sprint Health for Space: ${space.name}`);
    
    // 1. Получаем активный спринт JIRA
    const sprints = await jiraService.getSprints(space.jiraBoardId).catch(() => []);
    const activeSprint = sprints.find(s => s.state === 'active');
    
    if (!activeSprint) {
      return res.json({
        healthStatus: 'Green',
        healthScore: 100,
        sprintSummary: 'Нет активного спринта в JIRA для анализа.',
        discrepancies: [],
        risks: [],
        recommendations: ['Создайте и запустите спринт в JIRA, чтобы начать автоматический трекинг рисков.']
      });
    }

    // 2. Получаем задачи активного спринта
    const rawSprintIssues = await jiraService.getSprintIssues(activeSprint.id).catch(() => []);
    const sprintIssues = rawSprintIssues.map(issue => ({
      key: issue.key,
      summary: issue.fields?.summary,
      status: issue.fields?.status?.name,
      assignee: issue.fields?.assignee?.displayName || 'Не назначен',
      priority: issue.fields?.priority?.name,
      storyPoints: issue.fields?.[space.contextProfile?.storyPointsFieldId || 'customfield_10026'] || null,
      dueDate: issue.fields?.duedate || null
    }));

    // 3. Получаем последние коммиты и Merge Requests из GitLab репозиториев пространства
    let gitlabCommits = [];
    let gitlabMergeRequests = [];
    const repoIds = space.gitlabProjectIds || [];
    for (const repoId of repoIds) {
      try {
        const commits = await gitlabService.getCommits(repoId).catch(() => []);
        gitlabCommits = gitlabCommits.concat(commits.map(c => ({ ...c, repoId })));
        
        const openMRs = await gitlabService.getMergeRequests(repoId, 'opened').catch(() => []);
        const closedMRs = await gitlabService.getMergeRequests(repoId, 'closed').catch(() => []);
        gitlabMergeRequests = gitlabMergeRequests.concat(openMRs).concat(closedMRs);
      } catch (err) {
        console.error(`Failed to load GitLab data for repo ${repoId} during health check:`, err);
      }
    }

    // 4. Запускаем ИИ-генератор отчета о здоровье
    const healthReport = await generateSprintHealthReport(
      {
        id: activeSprint.id,
        name: activeSprint.name,
        startDate: activeSprint.startDate,
        endDate: activeSprint.endDate
      },
      sprintIssues,
      gitlabCommits,
      gitlabMergeRequests
    );

    res.json(healthReport);
  } catch (error) {
    console.error('Failed to generate sprint health report:', error);
    res.status(500).json({ error: `Sprint health report failed: ${error.message}` });
  }
});

// Авто-транзит задачи из отчета здоровья
app.post('/api/spaces/:id/transition-issue', async (req, res) => {
  const { id } = req.params;
  const { issueKey, transitionName } = req.body;
  if (!issueKey || !transitionName) {
    return res.status(400).json({ error: 'issueKey and transitionName are required' });
  }

  try {
    console.log(`Transitioning issue ${issueKey} to state: ${transitionName}`);
    const result = await jiraService.transitionIssue(issueKey, transitionName);
    res.json(result);
  } catch (error) {
    console.error('Failed to transition issue:', error);
    res.status(500).json({ error: `Transition failed: ${error.message}` });
  }
});

// --- SETTINGS ENDPOINTS ---

app.get('/api/settings', (req, res) => {
  res.json(db.getSettings());
});

app.post('/api/settings', (req, res) => {
  const updated = db.saveSettings(req.body);
  res.json(updated);
});

// --- JIRA DIRECT INTEGRATION ENDPOINTS ---

// Проверить связь
app.get('/api/jira/test', async (req, res) => {
  const result = await jiraService.testConnection();
  res.json(result);
});

// Получить проекты
app.get('/api/jira/projects', async (req, res) => {
  try {
    const projects = await jiraService.getProjects();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить доски
app.get('/api/jira/boards', async (req, res) => {
  try {
    const boards = await jiraService.getBoards();
    res.json(boards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить спринты доски
app.get('/api/jira/sprints', async (req, res) => {
  const { boardId } = req.query;
  try {
    const sprints = await jiraService.getSprints(boardId);
    res.json(sprints);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить задачи спринта
app.get('/api/jira/sprint/:id/issues', async (req, res) => {
  try {
    const issues = await jiraService.getSprintIssues(req.params.id);
    res.json(issues);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить бэклог
app.get('/api/jira/backlog', async (req, res) => {
  const { boardId, projectKey } = req.query;
  try {
    if (projectKey) {
      const backlog = await jiraService.getProjectBacklog(projectKey);
      return res.json(backlog);
    }
    const backlog = await jiraService.getBacklog(boardId);
    res.json(backlog);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Создать спринт
app.post('/api/jira/sprint', async (req, res) => {
  const { name, boardId } = req.body;
  try {
    const sprint = await jiraService.createSprint(name, boardId);
    res.json(sprint);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Запустить спринт
app.post('/api/jira/sprint/:id/start', async (req, res) => {
  const { startDate, endDate } = req.body;
  try {
    const sprint = await jiraService.startSprint(req.params.id, startDate, endDate);
    res.json(sprint);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Завершить спринт
app.post('/api/jira/sprint/:id/complete', async (req, res) => {
  try {
    const sprint = await jiraService.completeSprint(req.params.id);
    res.json(sprint);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Добавить задачи в спринт
app.post('/api/jira/sprint/:id/add-issues', async (req, res) => {
  const { issueKeys } = req.body;
  try {
    await jiraService.addIssuesToSprint(req.params.id, issueKeys);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Поиск пользователей Jira
app.get('/api/jira/users', async (req, res) => {
  const { query } = req.query;
  try {
    const users = await jiraService.searchUsers(query || '');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- GITLAB INTEGRATION ENDPOINTS ---

app.get('/api/gitlab/test', async (req, res) => {
  const result = await gitlabService.testConnection();
  res.json(result);
});

app.get('/api/gitlab/projects', async (req, res) => {
  try {
    const projects = await gitlabService.getProjects();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/gitlab/projects/:id/branches', async (req, res) => {
  try {
    const branches = await gitlabService.getBranches(req.params.id);
    res.json(branches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/gitlab/projects/:id/commits', async (req, res) => {
  const { branch } = req.query;
  try {
    const commits = await gitlabService.getCommits(req.params.id, branch || undefined);
    res.json(commits);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/gitlab/projects/:id/tree', async (req, res) => {
  const { branch, path } = req.query;
  try {
    const tree = await gitlabService.getFileTree(req.params.id, branch || undefined, path || '');
    res.json(tree);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/gitlab/projects/:id/file', async (req, res) => {
  const { branch, filePath } = req.query;
  if (!filePath) {
    return res.status(400).json({ error: 'filePath is required' });
  }
  try {
    const content = await gitlabService.getFileContent(req.params.id, filePath, branch || undefined);
    res.send(content);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить доступные модели Gemini с серверов Google
app.get('/api/gemini/models', async (req, res) => {
  const settings = db.getSettings();
  const apiKey = settings.geminiApiKey;
  if (!apiKey) {
    return res.json([]);
  }
  try {
    const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models`, {
      params: { key: apiKey }
    });
    
    // Фильтруем модели, поддерживающие генерацию текста (generateContent)
    const models = (response.data.models || [])
      .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
      .map(m => {
        const cleanName = m.name.startsWith('models/') ? m.name.substring(7) : m.name;
        return {
          name: cleanName,
          displayName: m.displayName || cleanName,
          description: m.description || '',
          inputTokenLimit: m.inputTokenLimit || 0,
          outputTokenLimit: m.outputTokenLimit || 0
        };
      });
      
    res.json(models);
  } catch (error) {
    console.error('Error fetching Gemini models:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error?.message || error.message });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`PM Assistant Backend running locally on http://localhost:${PORT}`);
});
