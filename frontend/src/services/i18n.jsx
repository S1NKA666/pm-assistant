export const translations = {
  ru: {
    // Navigation & General
    dashboard: "Дашборд",
    inbox: "Входящие логов",
    drafts: "Черновики задач",
    jiraAgile: "JIRA Agile",
    gitlab: "GitLab Integration",
    settings: "Настройки",
    spaces: "Пространства",
    appName: "PM Assistant",
    appSubtitle: "ИИ-ассистент управления проектами",
    loading: "Загрузка...",
    save: "Сохранить",
    cancel: "Отмена",
    delete: "Удалить",
    edit: "Редактировать",
    success: "Успешно!",
    error: "Ошибка",
    close: "Закрыть",
    selectLanguage: "Язык / Language",

    // Dashboard
    activeSpace: "Активный проект / пространство",
    noActiveSpace: "Пространство не выбрано",
    totalInbox: "Входящих логов",
    totalDrafts: "Черновиков задач",
    totalJiraIssues: "Задач в спринте",
    gitlabProjects: "Репозитории GitLab",
    gitlabDocCount: "Документы базы знаний",
    sprintHealthScore: "Здоровье спринта",
    healthStatus: "Статус",
    sprintSummary: "Сводка спринта",
    noData: "Нет данных для отображения",
    recommendations: "Рекомендации ИИ",
    quickActions: "Быстрые действия",
    analyzeNow: "Анализировать состояние",

    // Inbox
    inboxTitle: "Логи обсуждений и аудиозаписи",
    inboxSubtitle: "Сюда попадают обсуждения из Chrome-расширения и записанный голос. ИИ извлечет из них задачи.",
    selectAll: "Выбрать все",
    batchAnalyze: "AI Анализ выбранных",
    batchDelete: "Удалить выбранные",
    audioLog: "Голосовая запись",
    textLog: "Текстовое обсуждение",
    logUploaded: "Загружено",
    extractTasks: "Извлечь задачи ИИ",
    noLogs: "Список логов пуст. Используйте Chrome-расширение для захвата или загрузите лог.",
    dragDropText: "Перетащите аудио или текстовый файл сюда для загрузки",

    // Drafts
    draftsTitle: "Локальные черновики задач",
    draftsSubtitle: "Задачи, сгенерированные ИИ из логов. Вы можете отредактировать их перед отправкой в JIRA.",
    batchPush: "Завести выбранные в JIRA",
    pushedToJira: "Отправлено в JIRA",
    storyPoints: "Story Points",
    priority: "Приоритет",
    assignee: "Исполнитель",
    dueDate: "Срок",
    taskType: "Тип",
    suggestedFiles: "Задействованные файлы",
    pushToJira: "Завести в JIRA",
    noDrafts: "Черновиков задач нет. Проанализируйте входящие логи с помощью ИИ, чтобы создать их.",

    // JiraManager
    jiraTitle: "Управление спринтами JIRA",
    syncJiraBtn: "Синхронизировать JIRA",
    sprintHealthBtn: "Здоровье спринта ИИ",
    sprintPlanningBtn: "Планирование спринта ИИ",
    createSprintBtn: "Создать спринт",
    activeSprintTitle: "АКТИВНЫЙ СПРИНТ",
    startSprint: "Запустить спринт",
    completeSprint: "Завершить спринт",
    startDate: "Начало",
    endDate: "Конец",
    sprintIssuesCount: "Задачи спринта",
    boardBacklog: "Бэклог доски",
    noBoardConfigured: "Не настроен ID доски JIRA в настройках.",
    healthReportTitle: "ИИ-Анализ здоровья спринта",
    healthStatusGreen: "В норме",
    healthStatusAmber: "Внимание",
    healthStatusRed: "Под угрозой",
    discrepanciesTitle: "⚠️ Расхождения статусов (Jira vs Git Activity):",
    risksTitle: "🔥 Выявленные риски спринта:",
    recommendationsTitle: "💡 Рекомендации ИИ для проектного руководителя:",
    syncOneClick: "Перевести в",
    sprintPlanningTitle: "ИИ-Планирование следующего спринта",
    carriedOverIssues: "🔄 Переносимые задачи (обязательно):",
    newDraftTasks: "🔍 Извлеченные новые задачи из документов:",
    recommendedBacklog: "📋 Рекомендуемые задачи из бэклога JIRA:",
    proposalReasoning: "💡 ИИ Обоснование спринта:",
    applyProposal: "Применить предложение ИИ",

    // GitLab Integration
    gitlabTitle: "Интеграция с GitLab",
    testConnection: "Проверить соединение",
    connectedProjects: "Подключенные репозитории в пространстве",
    noGitlabConfigured: "Параметры GitLab не настроены.",

    // Settings
    settingsTitle: "Настройки систем интеграции",
    jiraUrl: "JIRA URL",
    jiraEmail: "JIRA Email",
    jiraToken: "JIRA API Token / PAT",
    jiraProjectKey: "JIRA Project Key",
    jiraBoardId: "JIRA Board ID",
    storyPointsFieldId: "Story Points Field ID (customfield_XXXXX)",
    geminiApiKey: "Gemini API Key",
    geminiModel: "Gemini Model",
    gitlabUrl: "GitLab URL",
    gitlabToken: "GitLab Private Token",
    saveSettings: "Сохранить настройки",

    // Spaces
    spacesTitle: "Управление пространствами (Проектами)",
    newSpace: "Создать новое пространство",
    spaceName: "Название пространства",
    descriptionLabel: "Описание проекта",
    repositoryLabel: "Связать с репозиториями GitLab",
    documentsLabel: "База знаний (ТЗ, Google Docs / Sheets)",
    addLink: "Добавить ссылку",
    uploadFile: "Загрузить файл ТЗ",
    createSpaceBtn: "Создать пространство",
    noSpaces: "Нет созданных пространств. Создайте первое для начала работы."
  },
  en: {
    // Navigation & General
    dashboard: "Dashboard",
    inbox: "Inbox Logs",
    drafts: "Task Drafts",
    jiraAgile: "JIRA Agile",
    gitlab: "GitLab Integration",
    settings: "Settings",
    spaces: "Spaces",
    appName: "PM Assistant",
    appSubtitle: "AI-Powered Project Management Assistant",
    loading: "Loading...",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    success: "Success!",
    error: "Error",
    close: "Close",
    selectLanguage: "Language / Язык",

    // Dashboard
    activeSpace: "Active Project / Space",
    noActiveSpace: "No active space selected",
    totalInbox: "Inbox Logs",
    totalDrafts: "Task Drafts",
    totalJiraIssues: "Active Sprint Tasks",
    gitlabProjects: "GitLab Repositories",
    gitlabDocCount: "Knowledge Base Docs",
    sprintHealthScore: "Sprint Health",
    healthStatus: "Status",
    sprintSummary: "Sprint Summary",
    noData: "No data to display",
    recommendations: "AI Recommendations",
    quickActions: "Quick Actions",
    analyzeNow: "Analyze Health Now",

    // Inbox
    inboxTitle: "Discussion Logs & Audio Recordings",
    inboxSubtitle: "Logs from Chrome extension and voice notes arrive here. AI will extract Jira tasks from them.",
    selectAll: "Select All",
    batchAnalyze: "AI Ingest Selected",
    batchDelete: "Delete Selected",
    audioLog: "Voice Record",
    textLog: "Chat Discussion",
    logUploaded: "Uploaded",
    extractTasks: "Extract Tasks via AI",
    noLogs: "No logs found. Use the Chrome extension to capture logs, or drag & drop files.",
    dragDropText: "Drag & drop audio or text files here to upload",

    // Drafts
    draftsTitle: "Local Task Drafts",
    draftsSubtitle: "Tasks drafted by AI. Review and edit them here before pushing to JIRA.",
    batchPush: "Create Selected in JIRA",
    pushedToJira: "Pushed to JIRA",
    storyPoints: "Story Points",
    priority: "Priority",
    assignee: "Assignee",
    dueDate: "Due Date",
    taskType: "Type",
    suggestedFiles: "Affected Files",
    pushToJira: "Push to JIRA",
    noDrafts: "No task drafts available. Ingest incoming logs via AI to generate them.",

    // JiraManager
    jiraTitle: "JIRA Sprint Manager",
    syncJiraBtn: "Sync JIRA",
    sprintHealthBtn: "AI Sprint Health",
    sprintPlanningBtn: "AI Sprint Planning",
    createSprintBtn: "Create Sprint",
    activeSprintTitle: "ACTIVE SPRINT",
    startSprint: "Start Sprint",
    completeSprint: "Complete Sprint",
    startDate: "Start Date",
    endDate: "End Date",
    sprintIssuesCount: "Sprint Issues",
    boardBacklog: "Board Backlog",
    noBoardConfigured: "JIRA Board ID is not configured in settings.",
    healthReportTitle: "AI Sprint Health Analysis",
    healthStatusGreen: "On Track",
    healthStatusAmber: "Needs Attention",
    healthStatusRed: "At Risk",
    discrepanciesTitle: "⚠️ Status Discrepancies (Jira vs Git Activity):",
    risksTitle: "🔥 Identified Sprint Risks:",
    recommendationsTitle: "💡 AI Recommendations for Project Manager:",
    syncOneClick: "Transition to",
    sprintPlanningTitle: "AI Next Sprint Planning",
    carriedOverIssues: "🔄 Carried Over Issues (Mandatory):",
    newDraftTasks: "🔍 Newly Extracted Tasks from Documents:",
    recommendedBacklog: "📋 Recommended Board Backlog Tasks:",
    proposalReasoning: "💡 AI Sprint Proposal Reasoning:",
    applyProposal: "Apply AI Proposal",

    // GitLab Integration
    gitlabTitle: "GitLab Integration",
    testConnection: "Test Connection",
    connectedProjects: "Connected Repositories in Space",
    noGitlabConfigured: "GitLab settings are not configured.",

    // Settings
    settingsTitle: "Integration Systems Settings",
    jiraUrl: "JIRA URL",
    jiraEmail: "JIRA Email",
    jiraToken: "JIRA API Token / PAT",
    jiraProjectKey: "JIRA Project Key",
    jiraBoardId: "JIRA Board ID",
    storyPointsFieldId: "Story Points Field ID (customfield_XXXXX)",
    geminiApiKey: "Gemini API Key",
    geminiModel: "Gemini Model",
    gitlabUrl: "GitLab URL",
    gitlabToken: "GitLab Private Token",
    saveSettings: "Save Settings",

    // Spaces
    spacesTitle: "Spaces & Projects Management",
    newSpace: "Create New Space",
    spaceName: "Space Name",
    descriptionLabel: "Project Description",
    repositoryLabel: "Link GitLab Repositories",
    documentsLabel: "Knowledge Base (PRD, Spec, Google Sheets Link)",
    addLink: "Add Link",
    uploadFile: "Upload Spec File",
    createSpaceBtn: "Create Space",
    noSpaces: "No spaces available. Create your first space to start."
  }
};

// React Context Helper
import React, { createContext, useContext, useState, useEffect } from 'react';

const I18nContext = createContext();

export function I18nProvider({ children }) {
  const [locale, setLocale] = useState(() => localStorage.getItem('locale') || 'ru');

  useEffect(() => {
    localStorage.setItem('locale', locale);
  }, [locale]);

  const t = (key) => {
    return translations[locale]?.[key] || translations['ru']?.[key] || key;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
