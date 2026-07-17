import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useI18n } from '../services/i18n';
import { CheckCircle, AlertTriangle, RefreshCw, Key, Link2, GitFork } from 'lucide-react';

export default function Settings() {
  const { t, locale } = useI18n();
  const [settings, setSettings] = useState({
    jiraUrl: '',
    jiraEmail: '',
    jiraToken: '',
    jiraProjectKey: '',
    jiraBoardId: '',
    storyPointsFieldId: '',
    geminiApiKey: '',
    gitlabUrl: 'https://gitlab.com',
    gitlabToken: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingJira, setTestingJira] = useState(false);
  const [testingGitLab, setTestingGitLab] = useState(false);
  const [jiraTestResult, setJiraTestResult] = useState(null);
  const [gitlabTestResult, setGitlabTestResult] = useState(null);
  
  const [projects, setProjects] = useState([]);
  const [boards, setBoards] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const loadGeminiModels = async () => {
    try {
      const models = await api.getGeminiModels();
      setAvailableModels(models);
    } catch (e) {
      console.error(e);
      setStatusMsg(locale === 'ru' ? `Не удалось получить модели Gemini с серверов Google: ${e.message}` : `Failed to fetch Gemini models: ${e.message}`);
      setAvailableModels([]);
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setSettings(prev => ({ ...prev, ...data }));
      
      if (data.jiraUrl && data.jiraToken) {
        loadJiraMetaData();
      }
      if (data.geminiApiKey) {
        loadGeminiModels();
      }
    } catch (e) {
      console.error(e);
      setStatusMsg(locale === 'ru' ? 'Не удалось загрузить настройки с сервера.' : 'Failed to load settings from server.');
    } finally {
      setLoading(false);
    }
  };

  const loadJiraMetaData = async () => {
    try {
      const [projList, boardList] = await Promise.all([
        api.getJiraProjects().catch(() => []),
        api.getJiraBoards().catch(() => [])
      ]);
      setProjects(projList);
      setBoards(boardList);
    } catch (e) {
      console.error('Failed to load Jira metadata:', e);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setStatusMsg('');
    try {
      await api.saveSettings(settings);
      setStatusMsg(locale === 'ru' ? 'Настройки успешно сохранены!' : 'Settings saved successfully!');
      loadJiraMetaData();
      if (settings.geminiApiKey) {
        loadGeminiModels();
      }
    } catch (err) {
      setStatusMsg(locale === 'ru' ? `Ошибка сохранения: ${err.message}` : `Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestJira = async () => {
    setTestingJira(true);
    setJiraTestResult(null);
    try {
      await api.saveSettings(settings);
      const res = await api.testJira();
      setJiraTestResult(res);
      if (res.success) {
        loadJiraMetaData();
      }
    } catch (err) {
      setJiraTestResult({ success: false, error: err.message });
    } finally {
      setTestingJira(false);
    }
  };

  const handleTestGitLab = async () => {
    setTestingGitLab(true);
    setGitlabTestResult(null);
    try {
      await api.saveSettings(settings);
      const res = await api.testGitLab();
      setGitlabTestResult(res);
    } catch (err) {
      setGitlabTestResult({ success: false, error: err.message });
    } finally {
      setTestingGitLab(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
        <RefreshCw className="animate-spin" size={32} style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '28px', marginBottom: '24px', fontFamily: 'var(--font-display)' }}>
        {t('settingsTitle')}
      </h2>
      
      {/* JIRA Settings */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px', marginBottom: '20px', color: 'var(--primary)' }}>
          <Link2 size={20} /> {locale === 'ru' ? 'Конфигурация локальной JIRA' : 'Local JIRA Configuration'}
        </h3>
        
        <form onSubmit={handleSave}>
          <div className="input-group">
            <label>{t('jiraUrl')}</label>
            <input 
              type="url" 
              name="jiraUrl" 
              className="input-text"
              placeholder={locale === 'ru' ? "http://localhost:8080 или http://jira.mycompany.local" : "http://localhost:8080 or http://jira.mycompany.local"}
              value={settings.jiraUrl}
              onChange={handleChange}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="input-group">
              <label>{t('jiraEmail')} {locale === 'ru' ? '(необязательно для PAT)' : '(optional for PAT)'}</label>
              <input 
                type="text" 
                name="jiraEmail" 
                className="input-text"
                placeholder="ivan.ivanov"
                value={settings.jiraEmail}
                onChange={handleChange}
              />
            </div>
            <div className="input-group">
              <label>{t('jiraToken')}</label>
              <input 
                type="password" 
                name="jiraToken" 
                className="input-text"
                placeholder="••••••••••••••••••••"
                value={settings.jiraToken}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '8px' }}>
            <div className="input-group">
              <label>{t('jiraProjectKey')}</label>
              {projects.length > 0 ? (
                <select name="jiraProjectKey" className="input-select" value={settings.jiraProjectKey} onChange={handleChange}>
                  <option value="">{locale === 'ru' ? 'Выберите проект' : 'Select Project'}</option>
                  {projects.map(p => (
                    <option key={p.key} value={p.key}>{p.name} ({p.key})</option>
                  ))}
                </select>
              ) : (
                <input 
                  type="text" 
                  name="jiraProjectKey" 
                  className="input-text"
                  placeholder="PROJ"
                  value={settings.jiraProjectKey}
                  onChange={handleChange}
                />
              )}
            </div>

            <div className="input-group">
              <label>{t('jiraBoardId')}</label>
              {boards.length > 0 ? (
                <select name="jiraBoardId" className="input-select" value={settings.jiraBoardId} onChange={handleChange}>
                  <option value="">{locale === 'ru' ? 'Выберите доску' : 'Select Board'}</option>
                  {boards.map(b => (
                    <option key={b.id} value={b.id}>{b.name} (ID: {b.id})</option>
                  ))}
                </select>
              ) : (
                <input 
                  type="text" 
                  name="jiraBoardId" 
                  className="input-text"
                  placeholder="1"
                  value={settings.jiraBoardId}
                  onChange={handleChange}
                />
              )}
            </div>
          </div>

          <div className="input-group">
            <label>{t('storyPointsFieldId')} {locale === 'ru' ? '(оставьте пустым, если не знаете)' : '(leave empty if unknown)'}</label>
            <input 
              type="text" 
              name="storyPointsFieldId" 
              className="input-text"
              placeholder="customfield_10008"
              value={settings.storyPointsFieldId}
              onChange={handleChange}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (locale === 'ru' ? 'Сохранение...' : 'Saving...') : (locale === 'ru' ? 'Сохранить настройки JIRA' : 'Save JIRA Settings')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleTestJira} disabled={testingJira}>
              {testingJira ? (locale === 'ru' ? 'Проверка...' : 'Testing...') : (locale === 'ru' ? 'Проверить связь с JIRA' : 'Test JIRA Connection')}
            </button>
          </div>
        </form>

        {jiraTestResult && (
          <div style={{ 
            marginTop: '20px', 
            padding: '12px 16px', 
            borderRadius: 'var(--radius-sm)', 
            background: jiraTestResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${jiraTestResult.success ? 'var(--success)' : 'var(--danger)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            {jiraTestResult.success ? (
              <>
                <CheckCircle style={{ color: 'var(--success)' }} />
                <span>
                  {locale === 'ru' 
                    ? `Успешно подключено к JIRA как ${jiraTestResult.user?.displayName || jiraTestResult.user?.name}!` 
                    : `Successfully connected to JIRA as ${jiraTestResult.user?.displayName || jiraTestResult.user?.name}!`}
                </span>
              </>
            ) : (
              <>
                <AlertTriangle style={{ color: 'var(--danger)' }} />
                <span>{locale === 'ru' ? 'Ошибка подключения к JIRA:' : 'JIRA connection error:'} {jiraTestResult.error}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* GitLab Settings */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px', marginBottom: '20px', color: 'var(--secondary)' }}>
          <GitFork size={20} /> {locale === 'ru' ? 'Настройка интеграции с GitLab' : 'GitLab Integration Settings'}
        </h3>
        
        <form onSubmit={handleSave}>
          <div className="input-group">
            <label>{t('gitlabUrl')}</label>
            <input 
              type="url" 
              name="gitlabUrl" 
              className="input-text"
              placeholder="https://gitlab.com"
              value={settings.gitlabUrl}
              onChange={handleChange}
              required
            />
          </div>

          <div className="input-group">
            <label>{t('gitlabToken')}</label>
            <input 
              type="password" 
              name="gitlabToken" 
              className="input-text"
              placeholder="glpat-••••••••••••••••••••"
              value={settings.gitlabToken}
              onChange={handleChange}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (locale === 'ru' ? 'Сохранение...' : 'Saving...') : (locale === 'ru' ? 'Сохранить настройки GitLab' : 'Save GitLab Settings')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleTestGitLab} disabled={testingGitLab}>
              {testingGitLab ? (locale === 'ru' ? 'Проверка...' : 'Testing...') : (locale === 'ru' ? 'Проверить связь с GitLab' : 'Test GitLab Connection')}
            </button>
          </div>
        </form>

        {gitlabTestResult && (
          <div style={{ 
            marginTop: '20px', 
            padding: '12px 16px', 
            borderRadius: 'var(--radius-sm)', 
            background: gitlabTestResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${gitlabTestResult.success ? 'var(--success)' : 'var(--danger)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            {gitlabTestResult.success ? (
              <>
                <CheckCircle style={{ color: 'var(--success)' }} />
                <span>
                  {locale === 'ru' 
                    ? `Успешно подключено к GitLab! Авторизован как ${gitlabTestResult.user?.name} (@${gitlabTestResult.user?.username})`
                    : `Successfully connected to GitLab! Authenticated as ${gitlabTestResult.user?.name} (@${gitlabTestResult.user?.username})`}
                </span>
              </>
            ) : (
              <>
                <AlertTriangle style={{ color: 'var(--danger)' }} />
                <span>{locale === 'ru' ? 'Ошибка подключения к GitLab:' : 'GitLab connection error:'} {gitlabTestResult.error}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Gemini Settings */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px', marginBottom: '20px', color: 'var(--secondary)' }}>
          <Key size={20} /> {locale === 'ru' ? 'Настройки ИИ Google Gemini' : 'Google Gemini AI Settings'}
        </h3>
        
        <div className="input-group">
          <label>{t('geminiApiKey')}</label>
          <input 
            type="password" 
            name="geminiApiKey" 
            className="input-text"
            placeholder="AIzaSy..."
            value={settings.geminiApiKey}
            onChange={handleChange}
          />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {locale === 'ru' 
              ? 'Этот ключ используется для автоматического анализа историй чатов, документов и записей встреч.'
              : 'This key is used for AI-powered analysis of discussions, docs, and voice transcripts.'}
          </span>
        </div>

        <div className="input-group" style={{ marginTop: '16px' }}>
          <label>{t('geminiModel')}</label>
          <select 
            name="geminiModel" 
            className="input-select" 
            value={settings.geminiModel || 'gemini-1.5-flash'} 
            onChange={handleChange}
          >
            {availableModels.length === 0 ? (
              <>
                <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                <option value="gemini-2.0-flash-exp">gemini-2.0-flash-exp</option>
              </>
            ) : (
              availableModels.map(m => {
                const formatLimit = (limit) => {
                  if (!limit) return 'unknown';
                  if (limit >= 1000000) return `${(limit / 1000000).toFixed(0)}M`;
                  if (limit >= 1000) return `${(limit / 1000).toFixed(0)}K`;
                  return limit;
                };
                return (
                  <option key={m.name} value={m.name}>
                    {m.displayName} ({locale === 'ru' ? 'Лимит' : 'Limit'}: {formatLimit(m.inputTokenLimit)})
                  </option>
                );
              })
            )}
          </select>
          {(() => {
            const selectedModelName = settings.geminiModel || 'gemini-1.5-flash';
            const selectedModel = availableModels.find(m => m.name === selectedModelName);
            if (!selectedModel) {
              return (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  {locale === 'ru' 
                    ? 'Рекомендуется использовать gemini-1.5-flash для скорости работы.' 
                    : 'We recommend using gemini-1.5-flash for faster analysis.'}
                </span>
              );
            }
            
            const getFreeTierLimits = (name) => {
              const lowerName = name.toLowerCase();
              if (lowerName.includes('gemini-2.0')) {
                return { rpm: '10 RPM', tpm: '4M TPM', rpd: '1,500 RPD' };
              }
              if (lowerName.includes('gemini-1.5-pro')) {
                return { rpm: '2 RPM', tpm: '32K TPM', rpd: '50 RPD' };
              }
              if (lowerName.includes('gemini-1.5-flash')) {
                return { rpm: '15 RPM', tpm: '1M TPM', rpd: '1,500 RPD' };
              }
              return { rpm: '5 RPM', tpm: '100K TPM', rpd: '1,000 RPD' };
            };
            
            const info = getFreeTierLimits(selectedModelName);
            
            return (
              <div style={{ 
                marginTop: '16px', 
                padding: '16px', 
                background: 'rgba(0,0,0,0.3)', 
                borderRadius: '8px', 
                border: '1px solid var(--glass-border)',
                fontSize: '13px'
              }}>
                <h4 style={{ color: 'var(--primary)', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                  {locale === 'ru' ? 'Характеристики модели:' : 'Model Info:'} {selectedModel.displayName}
                </h4>
                
                <p style={{ color: 'var(--text-muted)', marginBottom: '12px', fontStyle: 'italic', lineHeight: '1.4', fontSize: '12px' }}>
                  {selectedModel.description}
                </p>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <div style={{ color: 'var(--text-dark)', fontWeight: '500', marginBottom: '4px' }}>
                      {locale === 'ru' ? 'Лимиты контекста:' : 'Context Limits:'}
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      • {locale === 'ru' ? 'Входной контекст:' : 'Input context:'} <strong style={{ color: 'var(--text-main)' }}>{selectedModel.inputTokenLimit?.toLocaleString() || 'unknown'}</strong>
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      • {locale === 'ru' ? 'Лимит генерации:' : 'Output context:'} <strong style={{ color: 'var(--text-main)' }}>{selectedModel.outputTokenLimit?.toLocaleString() || 'unknown'}</strong>
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ color: 'var(--text-dark)', fontWeight: '500', marginBottom: '4px' }}>
                      {locale === 'ru' ? 'Частотные лимиты (Free Tier):' : 'Rate Limits (Free Tier):'}
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      • {locale === 'ru' ? 'Запросов в мин (RPM):' : 'Requests/min (RPM):'} <strong style={{ color: 'var(--text-main)' }}>{info.rpm}</strong>
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      • {locale === 'ru' ? 'Токенов в мин (TPM):' : 'Tokens/min (TPM):'} <strong style={{ color: 'var(--text-main)' }}>{info.tpm}</strong>
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      • {locale === 'ru' ? 'Лимит в день (RPD):' : 'Requests/day (RPD):'} <strong style={{ color: 'var(--text-main)' }}>{info.rpd}</strong>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        <button type="button" className="btn btn-secondary" onClick={() => handleSave()} disabled={saving} style={{ marginTop: '16px' }}>
          {saving ? (locale === 'ru' ? 'Сохранение...' : 'Saving...') : (locale === 'ru' ? 'Сохранить настройки ИИ' : 'Save AI Settings')}
        </button>
      </div>

      {statusMsg && (
        <div style={{ 
          marginTop: '20px', 
          padding: '12px 16px', 
          borderRadius: 'var(--radius-sm)', 
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          textAlign: 'center'
        }}>
          {statusMsg}
        </div>
      )}
    </div>
  );
}
