Markdown
# 🚀 PM Assistant / AI Workspace

🇬🇧 [English](#english-version) | 🇷🇺 [Русский](#русская-версия)

---

<a name="english-version"></a>
## 🇬🇧 English Version

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)](https://vitejs.dev/)
[![Extension](https://img.shields.io/badge/Chrome_Extension-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white)](https://developer.chrome.com/)

A comprehensive personal assistant for task and context management. This project unifies scattered data sources (Jira, GitLab, web content) into a single Inbox, automates task draft generation using AI, and allows for quick context capturing via a dedicated browser extension.

### ✨ Key Features

- 📥 **Unified Inbox:** Aggregates incoming tasks, notes, and web links in one place.
- 🤖 **AI Assistant (`ai.js`):** Automatically processes incoming data, generates, and summarizes Task Drafts.
- 🔄 **Tracker Integrations:** Two-way communication with **Jira** and **GitLab** — manage tickets and Merge Requests directly from the dashboard.
- 🧩 **Spaces Management:** Logical separation of context, environments, and projects.
- 🌐 **Chrome Extension:** Quickly save highlighted text, links, or sudden ideas directly from your browser to your Inbox.

### 🛠 Tech Stack

- **Frontend:** React, Vite, custom UI components.
- **Backend:** Node.js, Express, local database (JSON/SQLite).
- **Integrations:** Jira API, GitLab API, AI Provider API.
- **Extension:** Manifest V3, Background Service Workers.

### 📁 Project Structure

```text
├── backend/                # API server & business logic
│   ├── services/           # Integrations (ai.js, jira.js, gitlab.js, retry.js)
│   ├── database.js         # Data layer
│   ├── server.js           # Express entry point
│   └── db.json.example     # Database schema example
├── frontend/               # SPA client (React + Vite)
│   ├── src/components/     # UI Components (Dashboard, Inbox, JiraManager, etc.)
│   └── src/services/       # API client for backend communication
└── chrome-extension/       # Browser plugin
    ├── background.js       # Extension background processes
    ├── content.js          # Scripts for page interaction
    └── popup.html/js       # Extension UI (web clipper)
🚀 Quick Start
1. Start the Backend
Navigate to the backend directory, install dependencies, and set up the environment:

Bash
cd backend
npm install
# Copy the database/config example
cp db.json.example db.json
# Start the server
npm start
2. Start the Frontend
In a new terminal window, start the client:

Bash
cd frontend
npm install
npm run dev
3. Install the Chrome Extension
Open Google Chrome and navigate to chrome://extensions/.

Enable Developer mode in the top right corner.

Click Load unpacked and select the chrome-extension folder from this repository.

⚙️ Configuration
For integrations to work correctly, you need to provide access tokens in your backend configuration:

JIRA_API_TOKEN and your workspace URL.

GITLAB_PERSONAL_TOKEN.

API keys for the AI module.

👨‍💻 Author
Ivan Gridasov

Project Lead / Technical Lead

🇷🇺 Русская версия
Комплексный персональный ассистент для управления задачами. Проект объединяет разрозненные источники данных (Jira, GitLab, веб-контент) в единый Inbox, автоматизирует создание черновиков задач с помощью AI и позволяет быстро сохранять контекст через браузерное расширение.

✨ Ключевые возможности
📥 Единый Inbox: Агрегация входящих задач, заметок и ссылок в одном месте.

🤖 AI Ассистент (ai.js): Автоматическая обработка входящих данных, генерация и саммаризация черновиков задач (Task Drafts).

🔄 Интеграция с трекерами: Двусторонняя связь с Jira и GitLab — управление тикетами и MR напрямую из дашборда.

🧩 Управление пространствами (Spaces): Логическое разделение контекста и проектов.

🌐 Chrome Extension: Быстрое сохранение выделенного текста, ссылок или идей прямо из браузера в свой Inbox.

🛠 Технологический стек
Фронтенд: React, Vite, кастомные UI-компоненты.

Бэкенд: Node.js, Express, локальная БД (JSON/SQLite).

Интеграции: Jira API, GitLab API, AI Provider API.

Расширение: Manifest V3, Background Service Workers.

📁 Структура проекта
Plaintext
├── backend/                # API сервер и бизнес-логика
│   ├── services/           # Интеграции (ai.js, jira.js, gitlab.js, retry.js)
│   ├── database.js         # Слой работы с данными
│   ├── server.js           # Точка входа Express
│   └── db.json.example     # Пример схемы БД
├── frontend/               # SPA клиент (React + Vite)
│   ├── src/components/     # Компоненты (Dashboard, Inbox, JiraManager и др.)
│   └── src/services/       # API клиент для связи с бэкендом
└── chrome-extension/       # Плагин для браузера
    ├── background.js       # Фоновые процессы расширения
    ├── content.js          # Скрипты для взаимодействия со страницами
    └── popup.html/js       # Интерфейс расширения (клиппер)
🚀 Быстрый старт
1. Запуск Backend
Перейдите в директорию бэкенда, установите зависимости и настройте окружение:

Bash
cd backend
npm install
# Скопируйте пример базы данных/конфига
cp db.json.example db.json
# Запустите сервер
npm start
2. Запуск Frontend
В новом окне терминала запустите клиентскую часть:

Bash
cd frontend
npm install
npm run dev
3. Установка Chrome Extension
Откройте Google Chrome и перейдите по адресу chrome://extensions/.

Включите Режим разработчика (Developer mode) в правом верхнем углу.

Нажмите Загрузить распакованное расширение (Load unpacked) и выберите папку chrome-extension из этого репозитория.

⚙️ Конфигурация
Для корректной работы интеграций потребуется указать токены доступа. Добавьте в конфигурацию бэкенда:

JIRA_API_TOKEN и URL вашего пространства.

GITLAB_PERSONAL_TOKEN.

Ключи для работы модуля AI.
