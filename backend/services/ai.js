import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../database.js';

// Хелпер для предотвращения переполнения контекста модели
function truncateContext(text, maxLength = 35000) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  console.warn(`[AI Context] Текст превышает лимит в ${maxLength} символов. Усекаем...`);
  return text.substring(0, maxLength) + '\n... [Контент усечен ИИ-защитником лимитов токенов]';
}

// Вспомогательный метод для получения конфига Gemini
function getGeminiConfig() {
  const settings = db.getSettings();
  const apiKey = settings.geminiApiKey;
  if (!apiKey) {
    throw new Error('Ключ API Gemini не настроен в Настройках системы.');
  }
  return {
    apiKey,
    modelName: settings.geminiModel || 'gemini-1.5-flash'
  };
}

// Генерация задач из текстового контекста (Inbox лог) с интеграцией кодовой базы и PM методологий
export async function extractTasksFromText(textContext, contextProfile = null, codebaseTree = []) {
  const { apiKey, modelName } = getGeminiConfig();
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
    }
  });

  let formattingRules = "";
  if (contextProfile) {
    let projectIntelText = "";
    if (contextProfile.projectIntelligence) {
      projectIntelText = `
ДЕТАЛЬНЫЙ КОНТЕКСТ ПРОЕКТА (ЧТО УЖЕ СДЕЛАНО И АРХИТЕКТУРА):
• Уже существующие фичи/функционал: ${JSON.stringify(contextProfile.projectIntelligence.existingFeatures || [])}
• Технический стек: ${contextProfile.projectIntelligence.technicalStack || 'не указан'}
• Детали архитектуры: ${contextProfile.projectIntelligence.architectureDetails || 'не указаны'}
• Недавние выполненные работы: ${contextProfile.projectIntelligence.recentCompletedWork || 'нет данных'}
• Интерактивная карта UI кнопок: ${JSON.stringify(contextProfile.projectIntelligence.uiFeaturesMap || [])}

ПРАВИЛО ИНТЕГРАЦИИ ЗАДАЧ В СИСТЕМУ:
- Опирайтесь на уже созданный функционал и архитектуру. Не создавайте задачи на разработку того, что уже реализовано.
- Если в логах обсуждений/ТЗ есть требования к тому, что уже реализовано в коде или существующей UI карте — пропустите их.
`;
    }
    
    formattingRules = `
ВАЖНЫЕ ПРАВИЛА ОФОРМЛЕНИЯ ЗАДАЧ:
1. Шаблон названий (summary): Пишите названия строго в стиле: "${contextProfile.taskFormat?.namingPattern || 'любой понятный формат на русском'}"
2. Шаблон описания (description): Оформляйте описание, ориентируясь на данный пример/структуру:
"${contextProfile.taskFormat?.descriptionTemplate || 'стандартное подробное описание'}"
3. Распределение Story Points: Ориентируйтесь на шкалу Фибоначчи (1, 2, 3, 5, 8, 13) на основе исторических оценок: "${contextProfile.taskFormat?.storyPointsDistribution || '1, 2, 3, 5, 8 SP'}"
${projectIntelText}
`;
  }

  const codebaseTreeText = codebaseTree && codebaseTree.length > 0
    ? `Дерево файлов проекта (сопоставь требования с файлами кода): \n${JSON.stringify(codebaseTree.slice(0, 120), null, 2)}`
    : "";

  const prompt = `
Ты — Senior Project Manager, Системный аналитик и Agile Scrum-мастер с огромным опытом.
Твоя задача — проанализировать сырые логи обсуждений/чат/ТЗ и извлечь из них четкие, профессионально оформленные задачи JIRA.

ИСПОЛЬЗУЙ ЛУЧШИЕ МЕТОДИКИ УПРАВЛЕНИЯ ПРОЕКТАМИ:
1. Декомпозиция: разделяй сложные задачи на фронтенд и бэкенд, добавляя к названию:
   - [FRONT] — UI-компоненты, стили, формы, интеграция API на клиенте
   - [BACK] — API эндпоинты, модели БД, бизнес-логика, интеграция сервисов
   - [FULL] — если изменения неделимы
2. Формат описания: Описание каждой задачи должно быть оформлено в Markdown и содержать разделы:
   - ## Контекст (какую проблему бизнеса или пользователя решает задача)
   - ## Что нужно сделать (четкие пошаговые инструкции по реализации)
   - ## Критерии приемки (DoD — Definition of Done, чек-лист для проверки)
   - ## Задействованные файлы (укажи конкретные файлы из дерева файлов проекта, которые нужно изменить)
3. Story Points по Фибоначчи: (1, 2, 3, 5, 8, 13) на основе сложности задачи.
4. Автоопределение типа задачи ("taskType"): "frontend", "backend", "fullstack", "testing", "design", "devops".
5. Автоопределение предлагаемых файлов ("suggestedFiles"): найди в присланном дереве файлов файлы, которые больше всего подходят под изменения.

Срок и исполнитель: если упомянуты даты или имена/логины — пропиши их.
Язык: все названия, описания и тексты — СТРОГО на русском языке.

${formattingRules}
${codebaseTreeText}

ТЕКСТ ДЛЯ АНАЛИЗА:
${truncateContext(textContext, 30000)}

Отвечай ТОЛЬКО валидным JSON в формате:
{
  "tasks": [
    {
      "summary": "[FRONT/BACK/FULL] Четкое название задачи",
      "description": "Строка с подробным описанием в формате Markdown (с разделами Контекст, Что нужно сделать, Критерии приемки, Задействованные файлы)",
      "priority": "High" | "Medium" | "Low",
      "assignee": "Имя или пусто",
      "storyPoints": число или null,
      "taskType": "frontend" | "backend" | "fullstack" | "testing" | "design" | "devops",
      "suggestedFiles": ["путь/к/файлу1", "путь/к/файлу2"],
      "dueDate": "YYYY-MM-DD или null"
    }
  ]
}
`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  try {
    const parsed = JSON.parse(responseText);
    return parsed.tasks || [];
  } catch (e) {
    console.error('Failed to parse Gemini JSON response:', responseText);
    throw new Error('AI response was not valid JSON: ' + e.message);
  }
}

// Генерация задач из аудиозаписи встречи
export async function extractTasksFromAudio(audioBuffer, mimeType, contextProfile = null, codebaseTree = []) {
  const { apiKey, modelName } = getGeminiConfig();
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
    }
  });

  const audioPart = {
    inlineData: {
      data: audioBuffer.toString('base64'),
      mimeType: mimeType
    }
  };

  let formattingRules = "";
  if (contextProfile) {
    let projectIntelText = "";
    if (contextProfile.projectIntelligence) {
      projectIntelText = `
ДЕТАЛЬНЫЙ КОНТЕКСТ ПРОЕКТА (ЧТО УЖЕ СДЕЛАНО И АРХИТЕКТУРА):
• Уже существующие фичи: ${JSON.stringify(contextProfile.projectIntelligence.existingFeatures || [])}
• Технический стек: ${contextProfile.projectIntelligence.technicalStack || 'не указан'}
• Детали архитектуры: ${contextProfile.projectIntelligence.architectureDetails || 'не указаны'}
• Интерактивная карта UI кнопок: ${JSON.stringify(contextProfile.projectIntelligence.uiFeaturesMap || [])}

ПРАВИЛО ИНТЕГРАЦИИ ЗАДАЧ В СИСТЕМУ:
- Опирайтесь на уже созданный функционал и архитектуру. Не создавайте задачи на разработку того, что уже реализовано.
- Если на встрече обсуждается функционал, который УЖЕ есть в существующем коде — пропустите его.
`;
    }
    
    formattingRules = `
ВАЖНЫЕ ПРАВИЛА ОФОРМЛЕНИЯ ЗАДАЧ:
1. Шаблон названий (summary): Пишите названия строго в стиле: "${contextProfile.taskFormat?.namingPattern || 'любой понятный формат на русском'}"
2. Шаблон описания (description): Оформляйте описание, ориентируясь на данный пример/структуру:
"${contextProfile.taskFormat?.descriptionTemplate || 'стандартное подробное описание'}"
3. Распределение Story Points: Ориентируйтесь на шкалу Фибоначчи (1, 2, 3, 5, 8, 13) на основе исторических оценок: "${contextProfile.taskFormat?.storyPointsDistribution || '1, 2, 3, 5, 8 SP'}"
${projectIntelText}
`;
  }

  const codebaseTreeText = codebaseTree && codebaseTree.length > 0
    ? `Дерево файлов проекта (сопоставь требования с файлами кода): \n${JSON.stringify(codebaseTree.slice(0, 100), null, 2)}`
    : "";

  const promptPart = `
Ты — Senior Project Manager, Системный аналитик и Agile Scrum-мастер с огромным опытом.
Твоя задача — внимательно прослушать аудиозапись встречи и извлечь из нее четкие, профессионально оформленные задачи JIRA.

ИСПОЛЬЗУЙ ЛУЧШИЕ МЕТОДИКИ УПРАВЛЕНИЯ ПРОЕКТАМИ:
1. Декомпозиция: разделяй сложные задачи на фронтенд и бэкенд, добавляя к названию:
   - [FRONT] — UI-компоненты, формы, интеграция API на клиенте
   - [BACK] — API эндпоинты, модели БД, бизнес-логика, интеграция сервисов
   - [FULL] — если изменения неделимы
2. Формат описания: Описание каждой задачи должно быть оформлено в Markdown и содержать разделы:
   - ## Контекст (какую проблему бизнеса или пользователя решает задача)
   - ## Что нужно сделать (четкие пошаговые инструкции по реализации)
   - ## Критерии приемки (DoD — Definition of Done, чек-лист для проверки)
   - ## Задействованные файлы (укажи конкретные файлы из дерева файлов проекта, которые нужно изменить)
3. Story Points по Фибоначчи: (1, 2, 3, 5, 8, 13) на основе сложности задачи.
4. Автоопределение типа задачи ("taskType"): "frontend", "backend", "fullstack", "testing", "design", "devops".
5. Автоопределение предлагаемых файлов ("suggestedFiles"): найди в присланном дереве файлов файлы, которые больше всего подходят под изменения.
6. В качестве последней задачи добавь "Итоги встречи/Summary" (в таске с типом "fullstack"), в которой подробно опиши на русском языке ключевые решения встречи, участников и следующие шаги.

Срок и исполнитель: если упомянуты даты или имена/логины — пропиши их.
Язык: все названия, описания и тексты — СТРОГО на русском языке.

${formattingRules}
${codebaseTreeText}

Respond ONLY with a JSON object in this format:
{
  "tasks": [
    {
      "summary": "[FRONT/BACK/FULL] Четкое название задачи",
      "description": "Строка с подробным описанием в формате Markdown (с разделами Контекст, Что нужно сделать, Критерии приемки, Задействованные файлы)",
      "priority": "High" | "Medium" | "Low",
      "assignee": "Имя или пусто",
      "storyPoints": число или null,
      "taskType": "frontend" | "backend" | "fullstack" | "testing" | "design" | "devops",
      "suggestedFiles": ["путь/к/файлу1", "путь/к/файлу2"],
      "dueDate": "YYYY-MM-DD или null"
    }
  ]
}
`;

  const result = await model.generateContent([audioPart, promptPart]);
  const responseText = result.response.text();
  
  try {
    const parsed = JSON.parse(responseText);
    return parsed.tasks || [];
  } catch (e) {
    console.error('Failed to parse Gemini JSON response from audio:', responseText);
    throw new Error('AI audio response was not valid JSON: ' + e.message);
  }
}

// Анализирует историю JIRA, репозиторий GitLab и бизнес-документы ТЗ
export async function analyzeProjectContext(historicalIssues, backlog, codebaseTree, codebaseSnippets = [], spaceDocuments = []) {
  const { apiKey, modelName } = getGeminiConfig();
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
    }
  });

  const prompt = `
You are an expert Agile Consultant, Software Architect, and Systems Analyst. 
Your task is to analyze JIRA history (past completed issues), current backlog meta, codebase file tree, and the ACTUAL CONTENTS of key codebase files, to build a deep, comprehensive "Project Context Profile" with maximum detail.

You must analyze the files line by line, button by button, route by route, to understand the system completely.

You must understand and extract:
1. "velocity": Calculate average Story Points completed in past sprints (sum SPs in recent sprints and divide by count of sprints). Assume standard sprint length is 2 weeks unless specified.
2. "taskFormat":
   - "namingPattern": Identify how tasks are named. Do they use verbs in infinitive? E.g., "Реализовать...", "Исправить...", "Интегрировать...". Describe this pattern in Russian.
   - "descriptionTemplate": Analyze past task descriptions and generate a markdown template that represents their common structure (e.g. Acceptance Criteria, Steps, Expected behavior).
   - "storyPointsDistribution": Describe how Story Points are usually assigned (e.g. Bug is 1-2 SP, Feature is 3-5 SP, Refactoring is 5-8 SP).
3. "projectIntelligence":
   - "existingFeatures": Provide a very detailed list of completed and currently functioning system capabilities (features) deduced from JIRA tickets and the actual source code contents. For each feature, write 1-2 sentences on what it does, how it behaves, and specify where in the code (which components on Frontend React, and which paths/controllers/models on Backend Node/Express/etc.) it is implemented based on the provided file snippets.
   - "technicalStack": Describe the libraries, programming languages, databases, framework versions, and development tools discovered in JIRA issues and the codebase file tree.
   - "architectureDetails": Outline the architectural layers (e.g., frontend React components, backend REST controllers, database schema) and how they communicate, explaining how frontend routes map to backend REST controllers based on the provided code contents.
   - "recentCompletedWork": Summarize recent sprint outcomes (what was done in the last 2-3 sprints).
   - "uiFeaturesMap": Analyze the provided JSX/TSX/HTML code snippets to map every UI page/component, list ALL interactive elements (buttons, forms, input fields) present on them, and describe what action they perform when clicked/submitted, including the specific backend API endpoints or functions they trigger.
4. "codebaseMapping": Briefly describe the main modules/components based on the provided file tree structure.

Respond ONLY with a JSON object in this format:
{
  "velocity": {
    "averageStoryPoints": Number,
    "sprintLengthWeeks": Number
  },
  "taskFormat": {
    "namingPattern": "String (in Russian)",
    "descriptionTemplate": "String (Markdown template in Russian)",
    "storyPointsDistribution": "String (in Russian)"
  },
  "projectIntelligence": {
    "existingFeatures": ["String (Feature 1 detailed description in Russian, mentioning its UI pages and API paths)", "String (Feature 2...)"],
    "technicalStack": "String (Tech stack overview in Russian)",
    "architectureDetails": "String (Architecture overview in Russian)",
    "recentCompletedWork": "String (Recent completed work overview in Russian)",
    "uiFeaturesMap": [
      {
        "pageName": "String (e.g., Страница авторизации / LoginForm)",
        "elements": [
          {
            "elementName": "String (e.g., Кнопка Войти / Поле ввода пароля)",
            "actionDescription": "String (e.g., Отправляет POST запрос на /api/auth/login, валидирует длину пароля)"
          }
        ]
      }
    ]
  },
  "codebaseMapping": {
    "mainComponents": "String (in Russian)"
  }
}

DATA FOR ANALYSIS:
1. Past Completed Issues:
${JSON.stringify(historicalIssues.slice(0, 60), null, 2)}

2. Current Backlog Meta:
Total Backlog count: ${backlog.length}

3. Codebase File Tree:
${JSON.stringify(codebaseTree.slice(0, 150), null, 2)}

4. Contents of Key Architecture Code Files (Frontend and Backend):
${JSON.stringify(codebaseSnippets, null, 2)}

5. Business Specifications and Project Documents (ТЗ, требования, ссылки на Google Диск):
${JSON.stringify(spaceDocuments, null, 2)}
`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  try {
    return JSON.parse(responseText);
  } catch (e) {
    console.error('Failed to parse Project Context JSON:', responseText);
    throw new Error('AI context analysis was not valid JSON: ' + e.message);
  }
}

// ИИ-Планирование спринта (дата-ориентированный режим)
export async function generateSprintProposal(backlog, activeSprintIssues = [], spaceDocuments = [], sprintDates = null, currentSprintNumber = 1) {
  const { apiKey, modelName } = getGeminiConfig();
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
    }
  });

  const today = new Date().toISOString().split('T')[0];
  const sprintPeriodText = sprintDates
    ? `Текущий спринт: "${sprintDates.name}", начало: ${sprintDates.startDate || 'не указано'}, конец: ${sprintDates.endDate || 'не указано'}`
    : `Следующий спринт: #${currentSprintNumber}, даты не указаны (ориентируйся на задачи с ближайшими сроками)`;

  const prompt = `
Ты — Senior Project Manager и System Analyst в IT-компании с 10+ годами опыта.

Твоя задача: спланировать следующий Спринт #${currentSprintNumber}.
Сегодня: ${today}.
${sprintPeriodText}

═══════════════════════════════════════════
ПРАВИЛА ПЛАНИРОВАНИЯ:
═══════════════════════════════════════════

1. НЕ ограничивай набор задач по Story Points — команда динамическая.
2. Главный критерий отбора: ДАТЫ из таблиц и бизнес-задач. Включай ВСЕ задачи с датами в периоде спринта.
3. Незавершённые задачи активного спринта — переносятся обязательно.
4. Из прикреплённых документов (Google Sheets, ТЗ) — это ВАЖНЕЙШИЙ источник. Парси каждую строку.

═══════════════════════════════════════════
КАК ПРЕВРАЩАТЬ БИЗНЕС-ТРЕБОВАНИЯ В ЗАДАЧИ:
═══════════════════════════════════════════

Каждую бизнес-задачу из таблиц/ТЗ превращай в ПРОФЕССИОНАЛЬНО описанную техническую задачу по правилам:

A) РАЗБИВКА: если задача затрагивает и UI и сервер — создай отдельные подзадачи:
   - [FRONT] — всё что связано с UI/UX, React/Vue компонентами, формами, отображением
   - [BACK] — API эндпоинты, бизнес-логика, БД, сервисы
   - [FULL] — только если неделимо (например, конфиг, DevOps, маленькая правка)

B) ОПИСАНИЕ каждой задачи должно содержать:
   - Контекст: зачем это нужно бизнесу (1-2 предложения)
   - Что нужно сделать: конкретные технические шаги
   - Критерии приёмки (минимум 3-5 пунктов в формате "[ ] Условие")
   - Ссылка на источник: из какой строки таблицы/раздела ТЗ

C) STORY POINTS — оценка по шкале Фибоначчи (1, 2, 3, 5, 8, 13):
   - 1 SP: мелкое исправление, текст, стиль (< 2 ч)
   - 2 SP: небольшая доработка одного компонента (2-4 ч)
   - 3 SP: новый компонент или новый эндпоинт (0.5-1 день)
   - 5 SP: новая фича с несколькими компонентами (1-2 дня)
   - 8 SP: сложная фича, интеграция, рефакторинг (2-4 дня)
   - 13 SP: большой модуль, нужна декомпозиция (> 4 дней)

D) ПРИОРИТЕТ задавай на основе: срока из таблицы, слов «срочно/критично/блокер» в требовании, бизнес-влияния.

Все тексты — СТРОГО на русском языке.

═══════════════════════════════════════════
ФОРМАТ ОТВЕТА (только валидный JSON):
═══════════════════════════════════════════

{
  "sprintNumber": ${currentSprintNumber},
  "sprintPeriod": "${sprintDates?.startDate || today} — ${sprintDates?.endDate || ''}",
  "carriedOverIssues": [
    {
      "key": "JIRA-ключ",
      "summary": "Название задачи",
      "priority": "High" | "Medium" | "Low",
      "storyPoints": число или null,
      "assignee": "Исполнитель или пусто",
      "reason": "Причина переноса"
    }
  ],
  "selectedBacklogIssues": [
    {
      "key": "JIRA-ключ",
      "summary": "Название задачи",
      "priority": "High" | "Medium" | "Low",
      "storyPoints": число или null,
      "assignee": "Исполнитель или пусто",
      "dueDate": "Дата или null",
      "reason": "Почему в этом спринте"
    }
  ],
  "newDraftTasksToCreate": [
    {
      "summary": "[FRONT/BACK/FULL] Краткое чёткое название задачи",
      "description": "## Контекст\\n{Зачем это нужно бизнесу, из какой строки таблицы взято}\\n\\n## Что нужно сделать\\n{Конкретные технические шаги по пунктам}\\n\\n## Критерии приёмки\\n[ ] Критерий 1\\n[ ] Критерий 2\\n[ ] Критерий 3\\n[ ] Критерий 4\\n\\n## Источник\\n{Документ/таблица, строка/раздел}",
      "priority": "High" | "Medium" | "Low",
      "storyPoints": число по Фибоначчи,
      "assignee": "Исполнитель по таблице или пусто",
      "dueDate": "Срок из таблицы или null",
      "sourceDocument": "Название документа",
      "taskType": "frontend" | "backend" | "fullstack" | "design" | "testing" | "devops"
    }
  ],
  "reasoning": "Сводка: сколько задач перенесено, сколько из бэклога, сколько из таблиц/ТЗ, общая логика спринта."
}

═══════════════════════════════════════════
ДАННЫЕ ДЛЯ ПЛАНИРОВАНИЯ:
═══════════════════════════════════════════

1. НЕЗАВЕРШЁННЫЕ ЗАДАЧИ АКТИВНОГО СПРИНТА (перенести обязательно):
${JSON.stringify(activeSprintIssues, null, 2)}

2. JIRA БЭКЛОГ (отбирать по датам и приоритету):
${truncateContext(JSON.stringify(backlog, null, 2), 20000)}

3. ПРИКРЕПЛЁННЫЕ ДОКУМЕНТЫ — GOOGLE SHEETS И ТЗ (ГЛАВНЫЙ источник, читай КАЖДУЮ строку):
${truncateContext(JSON.stringify(spaceDocuments, null, 2), 30000)}
`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  try {
    return JSON.parse(responseText);
  } catch (e) {
    console.error('Failed to parse Sprint Proposal JSON:', responseText);
    throw new Error('AI sprint planning response was not valid JSON: ' + e.message);
  }
}

// Анализ здоровья спринта (Sprint Health Report)
export async function generateSprintHealthReport(activeSprint, sprintIssues, gitlabCommits = [], gitlabMergeRequests = []) {
  const { apiKey, modelName } = getGeminiConfig();
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
    }
  });

  const prompt = `
Ты — Senior Project Manager, Agile Scrum-мастер и Системный аналитик.
Твоя задача — проанализировать текущее состояние спринта (задачи JIRA, их статусы и исполнители) и сопоставить его с активностью в GitLab (коммиты и Merge Requests).
Сформируй умный отчет о здоровье спринта и выяви расхождения и риски.

КЛЮЧЕВЫЕ РИСКИ ДЛЯ АНАЛИЗА:
1. Расхождение статусов: есть ли коммиты или Merge Requests, упоминающие задачу (например, "CRMPLT-127"), но сама задача в JIRA все еще в статусе "To Do" или "Ready for Dev"? (Разработчики часто забывают двигать задачи).
2. Зависшие задачи: задачи, которые висят в статусе "In Progress" или "Blocked" дольше обычного, или по которым нет никакой активности в Git.
3. Угроза срыва дедлайна: задачи со сроками (dueDate), по которым мало или нет активности, и спринт скоро заканчивается.
4. Нераспределенная нагрузка: перегружен ли кто-то из разработчиков.

ДАННЫЕ:
- Спринт: ${JSON.stringify(activeSprint, null, 2)}
- Задачи спринта JIRA: ${JSON.stringify(sprintIssues, null, 2)}
- Последние коммиты GitLab: ${JSON.stringify(gitlabCommits, null, 2)}
- Открытые Merge Requests GitLab: ${JSON.stringify(gitlabMergeRequests, null, 2)}

Отвечай СТРОГО на русском языке и выдай ответ ТОЛЬКО в формате JSON:
{
  "healthStatus": "Green" | "Amber" | "Red",
  "healthScore": число от 0 до 100,
  "sprintSummary": "Краткая профессиональная сводка по состоянию спринта",
  "discrepancies": [
    {
      "issueKey": "Ключ задачи (например CRMPLT-92)",
      "summary": "Название задачи",
      "severity": "High" | "Medium" | "Low",
      "description": "Описание расхождения (например: 'Разработчик сделал 3 коммита, но задача в Jira до сих пор в To Do. Рекомендуется перевести в In Progress')",
      "suggestedTransition": "In Progress" | "Done" | "In Review" | null
    }
  ],
  "risks": [
    {
      "issueKey": "Ключ задачи или null",
      "severity": "High" | "Medium" | "Low",
      "description": "Описание риска (например: 'Задача CRMPLT-95 заблокирована и не успеет к дедлайну')"
    }
  ],
  "recommendations": [
    "Конкретная рекомендация PM по исправлению ситуации 1",
    "Рекомендация 2"
  ]
}
`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  try {
    return JSON.parse(responseText);
  } catch (e) {
    console.error('Failed to parse Sprint Health report JSON:', responseText);
    throw new Error('AI Sprint Health response was not valid JSON: ' + e.message);
  }
}
