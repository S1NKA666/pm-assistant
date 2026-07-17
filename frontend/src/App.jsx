import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Inbox from './components/Inbox';
import TaskDrafts from './components/TaskDrafts';
import JiraManager from './components/JiraManager';
import GitLabManager from './components/GitLabManager';
import SpacesManager from './components/SpacesManager';
import Settings from './components/Settings';
import { api } from './services/api';
import { useI18n } from './services/i18n';
import { LayoutDashboard, Inbox as InboxIcon, FileSpreadsheet, Settings as SettingsIcon, Kanban, Code, Layers, RefreshCw } from 'lucide-react';

export default function App() {
  const { locale, setLocale, t } = useI18n();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [spaces, setSpaces] = useState([]);
  const [activeSpaceId, setActiveSpaceId] = useState('');
  const [loadingSpaces, setLoadingSpaces] = useState(true);

  useEffect(() => {
    loadSpaces();
  }, []);

  const loadSpaces = async () => {
    setLoadingSpaces(true);
    try {
      const [spacesList, activeRes] = await Promise.all([
        api.getSpaces().catch(() => []),
        api.getActiveSpaceId().catch(() => ({ activeSpaceId: '' }))
      ]);
      setSpaces(spacesList);
      setActiveSpaceId(activeRes.activeSpaceId);
    } catch (e) {
      console.error('Failed to load spaces in App:', e);
    } finally {
      setLoadingSpaces(false);
    }
  };

  const handleSpaceChange = async (e) => {
    const id = e.target.value;
    try {
      const res = await api.setActiveSpaceId(id);
      setActiveSpaceId(res.activeSpaceId);
    } catch (err) {
      alert(`Не удалось переключить пространство: ${err.message}`);
    }
  };

  const handleSpaceUpdated = async (newActiveSpaceId) => {
    // Перезагружаем список пространств при изменениях из SpacesManager
    await loadSpaces();
    if (newActiveSpaceId) {
      setActiveSpaceId(newActiveSpaceId);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard setActiveTab={setActiveTab} />;
      case 'inbox':
        return <Inbox key={activeSpaceId} onTasksGenerated={() => setActiveTab('drafts')} />;
      case 'drafts':
        return <TaskDrafts key={activeSpaceId} activeSpaceId={activeSpaceId} />;
      case 'jira':
        return <JiraManager key={activeSpaceId} activeSpaceId={activeSpaceId} />;
      case 'gitlab':
        return <GitLabManager key={activeSpaceId} activeSpaceId={activeSpaceId} />;
      case 'spaces':
        return <SpacesManager onSpaceChanged={handleSpaceUpdated} />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard setActiveTab={setActiveTab} />;
    }
  };

  const navItems = [
    { id: 'dashboard', label: t('dashboard'), icon: <LayoutDashboard size={18} /> },
    { id: 'inbox', label: t('inbox'), icon: <InboxIcon size={18} /> },
    { id: 'drafts', label: t('drafts'), icon: <FileSpreadsheet size={18} /> },
    { id: 'jira', label: t('jiraAgile'), icon: <Kanban size={18} /> },
    { id: 'gitlab', label: t('gitlab'), icon: <Code size={18} /> },
    { id: 'spaces', label: t('spaces'), icon: <Layers size={18} /> },
    { id: 'settings', label: t('settings'), icon: <SettingsIcon size={18} /> }
  ];

  const activeSpace = spaces.find(s => s.id === activeSpaceId);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      
      {/* Sidebar Navigation */}
      <aside className="glass-panel" style={{ 
        width: '260px', 
        borderRadius: 0, 
        borderRight: '1px solid var(--glass-border)',
        borderLeft: 'none',
        borderTop: 'none',
        borderBottom: 'none',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        height: '100vh',
        zIndex: 10
      }}>
        
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', padding: '0 8px' }}>
          <div style={{ 
            width: '32px', 
            height: '32px', 
            borderRadius: '8px', 
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            color: 'white',
            fontFamily: 'var(--font-display)',
            fontSize: '18px'
          }}>
            П
          </div>
          <span style={{ 
            fontFamily: 'var(--font-display)', 
            fontWeight: '800', 
            fontSize: '18px', 
            background: 'linear-gradient(to right, #ffffff, #a5b4fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            PM Flow Copilot
          </span>
        </div>

        {/* Global Space Selector */}
        <div style={{ marginBottom: '32px', padding: '0 8px' }}>
          <label style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-dark)', display: 'block', marginBottom: '6px' }}>
            {t('activeSpace')}:
          </label>
          {loadingSpaces ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <RefreshCw className="animate-spin" size={12} /> {t('loading')}
            </div>
          ) : spaces.length > 0 ? (
            <select 
              className="input-select"
              style={{ width: '100%', padding: '6px 10px', fontSize: '13px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}
              value={activeSpaceId}
              onChange={handleSpaceChange}
            >
              {spaces.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          ) : (
            <div 
              onClick={() => setActiveTab('spaces')}
              style={{ 
                fontSize: '12px', 
                color: 'var(--secondary)', 
                cursor: 'pointer',
                padding: '6px 10px', 
                background: 'rgba(236,72,153,0.1)', 
                border: '1px dashed var(--secondary)',
                borderRadius: '6px',
                textAlign: 'center',
                fontWeight: '500'
              }}
            >
              + {t('newSpace')}
            </div>
          )}
        </div>

        {/* Nav Links */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          {navItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button 
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                  border: 'none',
                  outline: 'none',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  fontWeight: isActive ? '600' : '500',
                  textAlign: 'left',
                  borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                  transition: 'all 0.2s'
                }}
              >
                <span style={{ color: isActive ? 'var(--primary)' : 'inherit' }}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Language Switcher */}
        <div style={{ marginBottom: '20px', padding: '0 8px', marginTop: '20px' }}>
          <label style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-dark)', display: 'block', marginBottom: '6px' }}>
            {t('selectLanguage')}:
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setLocale('ru')}
              style={{
                flex: 1,
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: locale === 'ru' ? 'bold' : 'normal',
                background: locale === 'ru' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                color: locale === 'ru' ? 'var(--text-main)' : 'var(--text-muted)',
                border: locale === 'ru' ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              RU
            </button>
            <button 
              onClick={() => setLocale('en')}
              style={{
                flex: 1,
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: locale === 'en' ? 'bold' : 'normal',
                background: locale === 'en' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                color: locale === 'en' ? 'var(--text-main)' : 'var(--text-muted)',
                border: locale === 'en' ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              EN
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div style={{ fontSize: '11px', color: 'var(--text-dark)', padding: '0 8px' }}>
          <div>Локальное окружение v1.0</div>
          <div style={{ marginTop: '4px' }}>Статус: Подключено к бэкенду</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ 
        flex: 1, 
        marginLeft: '260px', 
        padding: '40px',
        minHeight: '100vh',
        background: 'transparent'
      }}>
        {/* Global Space Banner */}
        {activeSpace && (
          <div className="glass-panel" style={{ 
            marginBottom: '24px', 
            padding: '12px 20px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            background: 'rgba(99,102,241,0.03)',
            border: '1px solid rgba(255,255,255,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(99,102,241,0.1)', padding: '6px', borderRadius: '6px', color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                <Layers size={18} />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-dark)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>Активный проект / Пространство</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>{activeSpace.name}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'var(--text-dark)', fontSize: '10px' }}>Репозитории GitLab</div>
                <div style={{ fontWeight: '600', color: 'var(--text-muted)' }}>{(activeSpace.gitlabProjectIds || []).length} подключено</div>
              </div>
              <div style={{ textAlign: 'right', borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: '16px' }}>
                <div style={{ color: 'var(--text-dark)', fontSize: '10px' }}>Документы базы знаний</div>
                <div style={{ fontWeight: '600', color: 'var(--text-muted)' }}>{(activeSpace.documents || []).length} файлов/ссылок</div>
              </div>
              <div style={{ textAlign: 'right', borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: '16px' }}>
                <div style={{ color: 'var(--text-dark)', fontSize: '10px' }}>JIRA Доска</div>
                <div style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Board #{activeSpace.jiraBoardId || '—'}</div>
              </div>
            </div>
          </div>
        )}
        {renderContent()}
      </main>

    </div>
  );
}
