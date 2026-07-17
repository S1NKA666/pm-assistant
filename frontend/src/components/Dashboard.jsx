import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useI18n } from '../services/i18n';
import { ShieldCheck, MessageSquare, BrainCircuit, Activity, Settings, Calendar, CheckSquare, ChevronRight, Zap, Code } from 'lucide-react';

export default function Dashboard({ setActiveTab }) {
  const { t, locale } = useI18n();
  const [stats, setStats] = useState({
    inboxCount: 0,
    newInboxCount: 0,
    draftsCount: 0,
    activeSprintName: 'None',
    activeSprintIssuesCount: 0,
    jiraConnected: false,
    geminiConnected: false,
    gitlabConnected: false
  });
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [inbox, tasks, settings, jiraTest, gitlabTest] = await Promise.all([
        api.getInbox().catch(() => []),
        api.getTasks().catch(() => []),
        api.getSettings().catch(() => ({})),
        api.testJira().catch(() => ({ success: false })),
        api.testGitLab().catch(() => ({ success: false }))
      ]);

      let activeSprintName = locale === 'ru' ? 'Нет' : 'None';
      let activeSprintIssuesCount = 0;

      if (settings.jiraBoardId) {
        const sprints = await api.getJiraSprints(settings.jiraBoardId).catch(() => []);
        const active = sprints.find(s => s.state === 'active');
        if (active) {
          activeSprintName = active.name;
          const issues = await api.getSprintIssues(active.id).catch(() => []);
          activeSprintIssuesCount = issues.length;
        }
      }

      setStats({
        inboxCount: inbox.length,
        newInboxCount: inbox.filter(i => i.status === 'unprocessed').length,
        draftsCount: tasks.filter(t => t.status === 'draft').length,
        activeSprintName,
        activeSprintIssuesCount,
        jiraConnected: jiraTest.success,
        geminiConnected: !!settings.geminiApiKey,
        gitlabConnected: gitlabTest.success
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: t('inbox'),
      value: stats.inboxCount,
      desc: locale === 'ru' ? `${stats.newInboxCount} не обработано` : `${stats.newInboxCount} unprocessed`,
      icon: <MessageSquare size={24} style={{ color: 'var(--primary)' }} />,
      tab: 'inbox'
    },
    {
      title: t('drafts'),
      value: stats.draftsCount,
      desc: locale === 'ru' ? 'Ожидают заведения в JIRA' : 'Awaiting creation in JIRA',
      icon: <BrainCircuit size={24} style={{ color: 'var(--secondary)' }} />,
      tab: 'drafts'
    },
    {
      title: t('activeSprintTitle'),
      value: stats.activeSprintIssuesCount,
      desc: stats.activeSprintName,
      icon: <CheckSquare size={24} style={{ color: 'var(--success)' }} />,
      tab: 'jira'
    }
  ];

  return (
    <div className="fade-in">
      {/* Welcome Banner */}
      <div className="glass-panel" style={{ 
        padding: '32px', 
        marginBottom: '24px', 
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(236, 72, 153, 0.15) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
          {locale === 'ru' ? 'Добро пожаловать в PM Flow Copilot!' : 'Welcome to PM Flow Copilot!'}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', maxWidth: '700px', lineHeight: '1.6' }}>
          {locale === 'ru' 
            ? 'Это ваш личный ассистент управления задачами. Мы автоматически собираем сообщения из Telegram/WhatsApp Web, транскрибируем аудиозаписи встреч, анализируем их с помощью ИИ Gemini и формируем готовые задачи для вашей локальной JIRA с интеграцией репозиториев GitLab.'
            : 'This is your personal project manager copilot. We capture chat logs from Telegram/WhatsApp, transcribe voice meetings, analyze requirements using Gemini AI, and draft rich engineering tasks for JIRA mapped to GitLab codebase.'}
        </p>
      </div>

      {/* Connection Status Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        
        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Zap size={20} style={{ color: stats.jiraConnected ? 'var(--success)' : 'var(--danger)' }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 'bold' }}>JIRA Integration</div>
              <div style={{ fontSize: '11px', color: 'var(--text-dark)' }}>Jira Server / DC</div>
            </div>
          </div>
          <span className="badge" style={{ 
            background: stats.jiraConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
            color: stats.jiraConnected ? 'var(--success)' : 'var(--danger)' 
          }}>
            {stats.jiraConnected ? 'Online' : 'Offline'}
          </span>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Code size={20} style={{ color: stats.gitlabConnected ? 'var(--success)' : 'var(--danger)' }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 'bold' }}>GitLab Server</div>
              <div style={{ fontSize: '11px', color: 'var(--text-dark)' }}>{locale === 'ru' ? 'Репозитории кода' : 'Code repositories'}</div>
            </div>
          </div>
          <span className="badge" style={{ 
            background: stats.gitlabConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
            color: stats.gitlabConnected ? 'var(--success)' : 'var(--danger)' 
          }}>
            {stats.gitlabConnected ? 'Online' : 'Offline'}
          </span>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <BrainCircuit size={20} style={{ color: stats.geminiConnected ? 'var(--success)' : 'var(--danger)' }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Gemini LLM</div>
              <div style={{ fontSize: '11px', color: 'var(--text-dark)' }}>Google AI Studio</div>
            </div>
          </div>
          <span className="badge" style={{ 
            background: stats.geminiConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
            color: stats.geminiConnected ? 'var(--success)' : 'var(--danger)' 
          }}>
            {stats.geminiConnected ? (locale === 'ru' ? 'Активен' : 'Active') : (locale === 'ru' ? 'Отключен' : 'Offline')}
          </span>
        </div>

      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '24px' }}>
        {statCards.map((card, i) => (
          <div 
            key={i} 
            className="glass-panel glass-panel-hover" 
            style={{ padding: '24px', cursor: 'pointer' }}
            onClick={() => setActiveTab(card.tab)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-muted)' }}>{card.title}</span>
              {card.icon}
            </div>
            <div style={{ fontSize: '36px', fontWeight: '800', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>
              {loading ? '...' : card.value}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{card.desc}</span>
              <ChevronRight size={14} />
            </div>
          </div>
        ))}
      </div>

      {/* Quick Action Guides */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={20} style={{ color: 'var(--info)' }} /> {locale === 'ru' ? 'Руководство по настройке системы' : 'System Configuration Guide'}
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
          
          <div style={{ background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
            <h4 style={{ color: 'var(--text-main)', marginBottom: '8px', fontSize: '14px' }}>
              {locale === 'ru' ? '1. Установка расширения Chrome' : '1. Installing Chrome Extension'}
            </h4>
            {locale === 'ru' ? (
              <ol style={{ paddingLeft: '16px' }}>
                <li>Откройте Chrome и перейдите на страницу <code style={{ color: 'var(--primary)' }}>chrome://extensions</code>.</li>
                <li>Включите <strong>Режим разработчика</strong> (переключатель в верхнем правом углу).</li>
                <li>Нажмите кнопку <strong>Загрузить распакованное расширение</strong>.</li>
                <li>Выберите директорию проекта: <code style={{ color: 'var(--secondary)' }}>chrome-extension/</code>.</li>
              </ol>
            ) : (
              <ol style={{ paddingLeft: '16px' }}>
                <li>Open Chrome and navigate to <code style={{ color: 'var(--primary)' }}>chrome://extensions</code>.</li>
                <li>Enable <strong>Developer mode</strong> toggle in top-right.</li>
                <li>Click <strong>Load unpacked</strong> button.</li>
                <li>Choose the project folder: <code style={{ color: 'var(--secondary)' }}>chrome-extension/</code>.</li>
              </ol>
            )}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
            <h4 style={{ color: 'var(--text-main)', marginBottom: '8px', fontSize: '14px' }}>
              {locale === 'ru' ? '2. Импорт чатов из браузера' : '2. Ingesting Chats from Browser'}
            </h4>
            {locale === 'ru' ? (
              <ul style={{ listStyleType: 'disc', paddingLeft: '16px' }}>
                <li>Откройте <strong>Telegram Web</strong> или <strong>WhatsApp Web</strong>.</li>
                <li>Выделите сообщения чата, нажмите правую кнопку мыши и выберите <strong>"Send to PM Assistant"</strong>.</li>
                <li>Либо нажмите на фиолетовую плавающую кнопку <strong>"PM: Import Chat"</strong> в правом нижнем углу.</li>
                <li>Лог мгновенно появится во вкладке <strong>Входящие логи</strong>!</li>
              </ul>
            ) : (
              <ul style={{ listStyleType: 'disc', paddingLeft: '16px' }}>
                <li>Open <strong>Telegram Web</strong> or <strong>WhatsApp Web</strong>.</li>
                <li>Select chat messages, right click and choose <strong>"Send to PM Assistant"</strong>.</li>
                <li>Or click the floating purple <strong>"PM: Import Chat"</strong> button in bottom-right corner.</li>
                <li>The log will instantly appear in the <strong>Inbox Logs</strong> tab!</li>
              </ul>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
