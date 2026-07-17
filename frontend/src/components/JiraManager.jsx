import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Layers, Play, CheckCircle2, PlusCircle, RefreshCw, AlertTriangle, ExternalLink, Calendar, BrainCircuit, X, Check } from 'lucide-react';

export default function JiraManager({ activeSpaceId }) {
  const [boardId, setBoardId] = useState('');
  const [allBoards, setAllBoards] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [activeSprint, setActiveSprint] = useState(null);
  const [backlog, setBacklog] = useState([]);
  const [sprintIssues, setSprintIssues] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [jiraUrl, setJiraUrl] = useState('');

  // activeSpace detail to see if context exists
  const [activeSpace, setActiveSpace] = useState(null);

  // Sprint Creation State
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [newSprintName, setNewSprintName] = useState('');

  // AI Sprint Planning State
  const [showAiPlanning, setShowAiPlanning] = useState(false);
  const [loadingProposal, setLoadingProposal] = useState(false);
  const [proposal, setProposal] = useState(null);
  const [proposalSprintName, setProposalSprintName] = useState('');
  const [selectedIssueKeys, setSelectedIssueKeys] = useState([]);
  const [planningSuccess, setPlanningSuccess] = useState('');

  // AI Sprint Health State
  const [showSprintHealth, setShowSprintHealth] = useState(false);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [healthReport, setHealthReport] = useState(null);

  useEffect(() => {
    loadSettings();
  }, [activeSpaceId]);

  const loadSettings = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [settings, spacesList] = await Promise.all([
        api.getSettings(),
        api.getSpaces().catch(() => [])
      ]);
      setJiraUrl(settings.jiraUrl);
      
      const boardsList = await api.getJiraBoards().catch(() => []);
      setAllBoards(boardsList);

      const space = spacesList.find(s => s.id === activeSpaceId);
      setActiveSpace(space || null);
      const spaceBoardId = space?.jiraBoardId;
      const spaceProjectKey = space?.jiraProjectKey || settings.jiraProjectKey || '';

      const activeBoardId = spaceBoardId || settings.jiraBoardId || (boardsList[0]?.id ? String(boardsList[0].id) : '');
      if (activeBoardId) {
        setBoardId(activeBoardId);
        loadBoardData(activeBoardId, spaceProjectKey);
      } else {
        setErrorMsg('Пожалуйста, сначала настройте подключение к JIRA во вкладке «Настройки» или создайте пространство.');
        setLoading(false);
      }
    } catch (e) {
      setErrorMsg(`Не удалось загрузить настройки JIRA: ${e.message}`);
      setLoading(false);
    }
  };

  const loadBoardData = async (bId, projectKey = '') => {
    setLoading(true);
    setErrorMsg('');
    try {
      const sprintList = await api.getJiraSprints(bId).catch(() => []);
      setSprints(sprintList);
      
      const active = sprintList.find(s => s.state === 'active');
      setActiveSprint(active || null);

      if (active) {
        const issues = await api.getSprintIssues(active.id).catch(() => []);
        setSprintIssues(issues);
      } else {
        setSprintIssues([]);
      }

      // Бэклог берём по проекту (projectKey), а не по доске, чтобы видеть все задачи проекта
      const backlogIssues = await api.getJiraBacklog(bId, projectKey).catch(() => []);
      setBacklog(backlogIssues);
    } catch (e) {
      console.error(e);
      setErrorMsg(`Ошибка JIRA: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSprint = async (e) => {
    e.preventDefault();
    if (!newSprintName.trim()) return;
    try {
      await api.createSprint(newSprintName, boardId);
      setShowCreateSprint(false);
      setNewSprintName('');
      loadBoardData(boardId);
    } catch (e) {
      alert(`Не удалось создать спринт: ${e.message}`);
    }
  };

  const handleStartSprint = async (sprintId) => {
    const startDate = new Date().toISOString();
    const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 2 недели
    
    if (!window.confirm('Вы действительно хотите НАЧАТЬ этот спринт длительностью 2 недели?')) return;

    try {
      await api.startSprint(sprintId, startDate, endDate);
      loadBoardData(boardId);
    } catch (e) {
      alert(`Не удалось начать спринт: ${e.message}`);
    }
  };

  const handleCompleteSprint = async (sprintId) => {
    if (!window.confirm('Вы уверены, что хотите ЗАВЕРШИТЬ этот спринт? Все невыполненные задачи будут возвращены в бэклог.')) return;
    try {
      await api.completeSprint(sprintId);
      loadBoardData(boardId);
    } catch (e) {
      alert(`Не удалось завершить спринт: ${e.message}`);
    }
  };

  const [transitioningKey, setTransitioningKey] = useState('');

  const handleSyncTransition = async (issueKey, transitionName) => {
    if (!activeSpaceId) return;
    setTransitioningKey(issueKey);
    try {
      await api.transitionJiraIssue(activeSpaceId, issueKey, transitionName);
      alert(`Задача ${issueKey} успешно переведена в статус "${transitionName}"!`);
      // Перезапускаем сбор здоровья
      const data = await api.getSprintHealth(activeSpaceId);
      setHealthReport(data);
      // И обновляем данные по спринту
      loadBoardData(boardId);
    } catch (e) {
      alert(`Не удалось обновить статус: ${e.message}`);
    } finally {
      setTransitioningKey('');
    }
  };

  const startSprintHealthAnalysis = async () => {
    if (!activeSpaceId) {
      alert('Сначала выберите активное пространство!');
      return;
    }
    setShowSprintHealth(true);
    setLoadingHealth(true);
    setHealthReport(null);
    try {
      const data = await api.getSprintHealth(activeSpaceId);
      setHealthReport(data);
    } catch (e) {
      console.error(e);
      setErrorMsg(`Не удалось получить отчет о здоровье спринта: ${e.message}`);
      setShowSprintHealth(false);
    } finally {
      setLoadingHealth(false);
    }
  };

  const startAiPlanning = async () => {
    if (!activeSpaceId) {
      alert('Сначала выберите активное пространство!');
      return;
    }
    
    if (!activeSpace?.contextProfile) {
      alert('ИИ-профиль проекта не найден. Сначала перейдите во вкладку «Пространства (Spaces)» и нажмите кнопку «ИИ-Изучение проекта» для этого пространства.');
      return;
    }

    setShowAiPlanning(true);
    setLoadingProposal(true);
    setProposal(null);
    setPlanningSuccess('');
    
    try {
      const data = await api.getSprintProposal(activeSpaceId);
      setProposal(data);
      setProposalSprintName(`Спринт #${data.sprintNumber || 1}`);
      const recommendedKeys = [
        ...(data.carriedOverIssues?.map(i => i.key) || []),
        ...(data.selectedBacklogIssues?.map(i => i.key) || [])
      ];
      setSelectedIssueKeys(recommendedKeys);
    } catch (err) {
      setErrorMsg(`Не удалось получить предложение планирования от ИИ: ${err.message}`);
      setShowAiPlanning(false);
    } finally {
      setLoadingProposal(false);
    }
  };

  const handleToggleIssue = (key) => {
    setSelectedIssueKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const executeAiSprintCreation = async () => {
    if (!proposalSprintName.trim()) {
      alert('Введите название спринта!');
      return;
    }
    if (selectedIssueKeys.length === 0) {
      alert('Выберите хотя бы одну задачу для добавления в спринт!');
      return;
    }

    setLoadingProposal(true);
    try {
      // 1. Создаем спринт в JIRA
      const sprint = await api.createSprint(proposalSprintName, boardId);
      const sprintId = sprint.id;

      // 2. Добавляем выбранные задачи в этот спринт
      await api.addIssuesToSprint(sprintId, selectedIssueKeys);

      // 3. Запускаем спринт
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      await api.startSprint(sprintId, startDate, endDate);

      setPlanningSuccess('Спринт успешно создан, задачи перенесены, спринт запущен в JIRA!');
      setTimeout(() => {
        setShowAiPlanning(false);
        setProposal(null);
        loadBoardData(boardId);
      }, 3000);

    } catch (err) {
      alert(`Ошибка при формировании спринта: ${err.message}`);
    } finally {
      setLoadingProposal(false);
    }
  };

  const translatePriority = (priority) => {
    const p = priority?.toLowerCase() || '';
    if (p.includes('block') || p.includes('crit') || p.includes('high')) return 'Высокий';
    if (p.includes('major') || p.includes('med')) return 'Средний';
    return 'Низкий';
  };

  const getPriorityColor = (priorityName) => {
    const p = priorityName?.toLowerCase() || '';
    if (p.includes('block') || p.includes('crit') || p.includes('high')) return 'var(--danger)';
    if (p.includes('major') || p.includes('med')) return 'var(--warning)';
    return 'var(--success)';
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ fontSize: '28px', fontFamily: 'var(--font-display)' }}>Управление спринтами JIRA</h2>
          {allBoards.length > 0 && (
            <select 
              className="input-select"
              style={{ padding: '6px 12px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--glass-border)', fontSize: '14px', borderRadius: 'var(--radius-sm)' }}
              value={boardId}
              onChange={(e) => {
                setBoardId(e.target.value);
                loadBoardData(e.target.value);
              }}
            >
              {allBoards.map(b => (
                <option key={b.id} value={b.id}>{b.name} (ID: {b.id})</option>
              ))}
            </select>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={() => loadBoardData(boardId)} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Синхронизировать JIRA
          </button>

          {activeSpace?.contextProfile && (
            <>
              <button 
                className="btn btn-secondary" 
                style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.05)', color: '#34d399' }}
                onClick={startSprintHealthAnalysis}
              >
                <BrainCircuit size={14} /> Здоровье спринта ИИ
              </button>
              <button 
                className="btn btn-primary" 
                style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={startAiPlanning}
              >
                <BrainCircuit size={14} /> Планирование спринта ИИ
              </button>
            </>
          )}
          
          <button className="btn btn-secondary" onClick={() => setShowCreateSprint(!showCreateSprint)}>
            <PlusCircle size={14} /> Создать спринт
          </button>
        </div>
      </div>

      {showCreateSprint && (
        <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '16px' }}>Создать новый спринт</h4>
          <form onSubmit={handleCreateSprint} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <div className="input-group" style={{ marginBottom: 0, flex: 1 }}>
              <label>Название спринта</label>
              <input 
                type="text" 
                className="input-text" 
                placeholder="Например: Спринт 24 - Базовый функционал"
                value={newSprintName}
                onChange={(e) => setNewSprintName(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-success">Создать</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreateSprint(false)}>Отмена</button>
          </form>
        </div>
      )}

      {/* AI PLANNING MODAL WIZARD */}
      {showAiPlanning && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ 
            width: '100%', 
            maxWidth: '750px', 
            maxHeight: '90vh', 
            overflowY: 'auto', 
            padding: '30px', 
            boxShadow: '0 0 40px rgba(99, 102, 241, 0.25)',
            border: '1px solid rgba(99, 102, 241, 0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '22px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <BrainCircuit style={{ color: 'var(--primary)' }} /> ИИ-Планировщик Спринта: {activeSpace?.name}
              </h3>
              <button 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={() => setShowAiPlanning(false)}
              >
                <X size={20} />
              </button>
            </div>

            {loadingProposal ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <RefreshCw className="animate-spin" size={40} style={{ color: 'var(--primary)', margin: '0 auto 16px' }} />
                <p style={{ color: 'var(--text-muted)' }}>Анализируем бэклог, Velocity и зависимости кода для лучшего планирования...</p>
              </div>
            ) : proposal ? (
              <div>
                {planningSuccess ? (
                  <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--success)', color: '#34d399', padding: '16px', borderRadius: '8px', textAlign: 'center', marginBottom: '20px', fontSize: '15px' }}>
                    <Check size={24} style={{ margin: '0 auto 8px' }} />
                    {planningSuccess}
                  </div>
                ) : (
                  <div>
                    {/* Название спринта */}
                    <div className="input-group">
                      <label style={{ fontWeight: 'bold' }}>Название нового спринта (сгенерировано по шаблону)</label>
                      <input 
                        type="text" 
                        className="input-text" 
                        value={proposalSprintName} 
                        onChange={(e) => setProposalSprintName(e.target.value)} 
                      />
                    </div>

                    {/* Обоснование планирования */}
                    <div style={{ background: 'rgba(99,102,241,0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.1)', marginBottom: '20px', fontSize: '13px', lineHeight: '1.6' }}>
                      <strong style={{ color: 'var(--primary)', display: 'block', marginBottom: '6px' }}>ИИ-Обоснование состава спринта:</strong>
                      <p style={{ color: 'var(--text-muted)', margin: 0 }}>{proposal.reasoning}</p>
                    </div>

                    {/* Новые задачи из ТЗ и Google Sheets — карточки */}
                    {proposal.newDraftTasksToCreate && proposal.newDraftTasksToCreate.length > 0 && (
                      <div style={{ marginBottom: '20px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                          🔍 Найдено {proposal.newDraftTasksToCreate.length} задач из Google Диска/ТЗ → заведены в черновики
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '340px', overflowY: 'auto' }}>
                          {proposal.newDraftTasksToCreate.map((t, idx) => {
                            const typeColors = { frontend: '#6366f1', backend: '#10b981', fullstack: '#f59e0b', design: '#ec4899', testing: '#8b5cf6', devops: '#64748b' };
                            const typeLabels = { frontend: 'FRONT', backend: 'BACK', fullstack: 'FULL', design: 'DESIGN', testing: 'TEST', devops: 'DEVOPS' };
                            const typeColor = typeColors[t.taskType] || 'var(--primary)';
                            const typeLabel = typeLabels[t.taskType] || (t.taskType || '').toUpperCase();
                            const priorityColors = { High: '#ef4444', Medium: '#f59e0b', Low: '#6b7280' };
                            return (
                              <details key={idx} style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '10px 14px' }}>
                                <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  {typeLabel && (
                                    <span style={{ background: typeColor, color: '#fff', fontSize: '10px', fontWeight: 'bold', padding: '2px 7px', borderRadius: '4px', letterSpacing: '0.5px' }}>
                                      {typeLabel}
                                    </span>
                                  )}
                                  <span style={{ fontWeight: '600', fontSize: '13px', flex: 1 }}>{t.summary}</span>
                                  <span style={{ fontSize: '11px', color: priorityColors[t.priority] || 'var(--text-muted)', fontWeight: 'bold' }}>{t.priority}</span>
                                  {t.storyPoints && (
                                    <span style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--primary)', fontSize: '11px', padding: '2px 7px', borderRadius: '10px', fontWeight: 'bold' }}>
                                      {t.storyPoints} SP
                                    </span>
                                  )}
                                  {t.dueDate && (
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>📅 {t.dueDate}</span>
                                  )}
                                  {t.assignee && (
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>👤 {t.assignee}</span>
                                  )}
                                </summary>
                                {t.sourceDocument && (
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic' }}>
                                    📄 Источник: {t.sourceDocument}
                                  </div>
                                )}
                                {t.description && (
                                  <pre style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: '1.6', background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '6px' }}>
                                    {t.description}
                                  </pre>
                                )}
                              </details>
                            );
                          })}
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '8px 0 0 0', fontStyle: 'italic' }}>
                          * Задачи автоматически заведены в «Черновики задач». Нажмите на задачу чтобы увидеть полное описание, критерии приёмки и Story Points.
                        </p>
                      </div>
                    )}

                    {/* Переносимые невыполненные задачи */}
                    {proposal.carriedOverIssues && proposal.carriedOverIssues.length > 0 && (
                      <div style={{ marginBottom: '20px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#f87171', display: 'block', marginBottom: '8px' }}>
                          🔄 Переносимые невыполненные задачи текущего спринта ({proposal.carriedOverIssues.length}):
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto', background: 'rgba(239, 68, 68, 0.03)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                          {proposal.carriedOverIssues.map(issue => (
                            <div key={issue.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                              <span style={{ fontWeight: 'bold', color: '#f87171' }}>{issue.key}</span>
                              <span style={{ flex: 1, marginLeft: '12px', color: 'var(--text-main)' }}>{issue.summary}</span>
                              <span style={{ color: 'var(--text-dark)' }}>{issue.storyPoints || 0} SP</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Выбор задач */}
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Рекомендуемые к добавлению задачи ({selectedIssueKeys.length}):</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Выбрано Story Points: <strong style={{ color: 'var(--success)' }}>{proposal.totalStoryPoints} SP</strong> / Скорость (Velocity): {activeSpace?.contextProfile?.velocity?.averageStoryPoints || '—'} SP
                        </span>
                      </div>

                      <div style={{ 
                        maxHeight: '250px', 
                        overflowY: 'auto', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '8px',
                        background: 'rgba(0,0,0,0.2)',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.03)'
                      }}>
                        {backlog.map(issue => {
                          const isRecommended = proposal.selectedBacklogIssues?.some(i => i.key === issue.key);
                          const isChecked = selectedIssueKeys.includes(issue.key);
                          const sp = issue.fields?.customfield_10026 || issue.fields?.customfield_10008 || '—';
                          
                          return (
                            <label 
                              key={issue.key} 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '12px', 
                                padding: '10px', 
                                borderRadius: '6px',
                                background: isChecked ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.01)',
                                border: isChecked ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                            >
                              <input 
                                type="checkbox" 
                                checked={isChecked} 
                                onChange={() => handleToggleIssue(issue.key)} 
                              />
                              <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                <span style={{ fontWeight: '600', color: isChecked ? 'var(--primary)' : 'var(--text-muted)' }}>{issue.key}</span>
                                <span style={{ flex: 1, marginLeft: '12px', color: 'var(--text-main)' }}>{issue.fields?.summary}</span>
                                <span style={{ 
                                  color: getPriorityColor(issue.fields?.priority?.name), 
                                  fontWeight: 'bold',
                                  marginRight: '12px'
                                }}>
                                  {translatePriority(issue.fields?.priority?.name)}
                                </span>
                                <span style={{ color: 'var(--text-dark)' }}>SP: {sp}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary" onClick={() => setShowAiPlanning(false)}>Отмена</button>
                      <button 
                        className="btn btn-primary" 
                        onClick={executeAiSprintCreation}
                        style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)' }}
                      >
                        Создать и запустить спринт в JIRA
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: 'var(--danger)', textAlign: 'center', padding: '20px' }}>
                Не удалось сгенерировать предложение.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SPRINT HEALTH REPORT MODAL */}
      {showSprintHealth && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 101,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ 
            width: '100%', 
            maxWidth: '750px', 
            maxHeight: '90vh', 
            overflowY: 'auto', 
            padding: '30px', 
            boxShadow: '0 0 40px rgba(16, 185, 129, 0.25)',
            border: '1px solid rgba(16, 185, 129, 0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '22px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <BrainCircuit style={{ color: 'var(--success)' }} /> ИИ-Анализ здоровья спринта: {activeSpace?.name}
              </h3>
              <button 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={() => setShowSprintHealth(false)}
              >
                <X size={20} />
              </button>
            </div>

            {loadingHealth ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <RefreshCw className="animate-spin" size={40} style={{ color: 'var(--success)', margin: '0 auto 16px' }} />
                <p style={{ color: 'var(--text-muted)' }}>Сверяем коммиты и Merge Requests в GitLab с текущими задачами в JIRA для поиска расхождений...</p>
              </div>
            ) : healthReport ? (
              <div>
                {/* Health Meter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                  <div style={{
                    width: '70px',
                    height: '70px',
                    borderRadius: '50%',
                    border: `5px solid ${healthReport.healthStatus === 'Green' ? '#10b981' : healthReport.healthStatus === 'Amber' ? '#f59e0b' : '#ef4444'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: '#fff'
                  }}>
                    {healthReport.healthScore}%
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', background: healthReport.healthStatus === 'Green' ? 'rgba(16,185,129,0.1)' : healthReport.healthStatus === 'Amber' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)', color: healthReport.healthStatus === 'Green' ? '#10b981' : healthReport.healthStatus === 'Amber' ? '#f59e0b' : '#ef4444' }}>
                        Статус: {healthReport.healthStatus === 'Green' ? 'В норме' : healthReport.healthStatus === 'Amber' ? 'Внимание' : 'Под угрозой'}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>{healthReport.sprintSummary}</p>
                  </div>
                </div>

                {/* Discrepancies */}
                {healthReport.discrepancies && healthReport.discrepancies.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--warning)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      ⚠️ Расхождения статусов (Jira vs Git Activity):
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {healthReport.discrepancies.map((d, idx) => (
                        <div key={idx} style={{ background: 'rgba(245, 158, 11, 0.03)', border: '1px solid rgba(245, 158, 11, 0.1)', padding: '10px 14px', borderRadius: '6px', fontSize: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
                            <div>
                              <strong>{d.issueKey}</strong>: {d.summary}
                            </div>
                            <span style={{ fontSize: '10px', fontWeight: 'bold', color: d.severity === 'High' ? '#ef4444' : '#f59e0b' }}>{d.severity} priority</span>
                          </div>
                          <p style={{ color: 'var(--text-muted)', marginBottom: d.suggestedTransition ? '8px' : 0, margin: 0 }}>{d.description}</p>
                          {d.suggestedTransition && (
                            <button
                              className="btn btn-primary"
                              style={{ padding: '3px 8px', fontSize: '10px', background: 'rgba(99, 102, 241, 0.2)', color: 'var(--primary)', border: '1px solid rgba(99, 102, 241, 0.3)', marginTop: '6px' }}
                              onClick={() => handleSyncTransition(d.issueKey, d.suggestedTransition)}
                              disabled={transitioningKey === d.issueKey}
                            >
                              {transitioningKey === d.issueKey ? 'Синхронизация...' : `Перевести в "${d.suggestedTransition}"`}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risks */}
                {healthReport.risks && healthReport.risks.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#ef4444', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      🔥 Выявленные риски спринта:
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {healthReport.risks.map((r, idx) => (
                        <div key={idx} style={{ background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.1)', padding: '10px 14px', borderRadius: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                          {r.issueKey && <strong style={{ color: '#fff', marginRight: '6px' }}>{r.issueKey}</strong>}
                          {r.description}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* PM Recommendations */}
                {healthReport.recommendations && healthReport.recommendations.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '10px' }}>
                      💡 Рекомендации ИИ для проектного руководителя:
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                      {healthReport.recommendations.map((rec, idx) => (
                        <li key={idx} style={{ marginBottom: '6px' }}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                  <button className="btn btn-secondary" onClick={() => setShowSprintHealth(false)}>Закрыть</button>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--danger)', textAlign: 'center', padding: '20px' }}>
                Не удалось получить отчет о здоровье.
              </div>
            )}
          </div>
        </div>
      )}

      {errorMsg && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '12px 16px', 
          borderRadius: 'var(--radius-sm)', 
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid var(--warning)',
          color: '#fbbf24',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertTriangle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Sprint Dashboard */}
        <div>
          <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
            {activeSprint ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <span className="badge badge-low" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', marginBottom: '8px' }}>Активный спринт</span>
                    <h3 style={{ fontSize: '20px' }}>{activeSprint.name}</h3>
                  </div>
                  <button className="btn btn-danger" style={{ padding: '8px 16px' }} onClick={() => handleCompleteSprint(activeSprint.id)}>
                    <CheckCircle2 size={14} /> Завершить спринт
                  </button>
                </div>
                
                {activeSprint.startDate && (
                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} /> Начало: {new Date(activeSprint.startDate).toLocaleDateString()}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} /> Конец: {new Date(activeSprint.endDate).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {/* Active Sprint Issues */}
                <h4 style={{ fontSize: '15px', color: 'var(--primary)', marginBottom: '12px' }}>Задачи спринта ({sprintIssues.length})</h4>
                
                {sprintIssues.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Этот спринт пока пуст. Переместите в него задачи из Бэклога справа.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {sprintIssues.map(issue => (
                      <div key={issue.id} style={{ 
                        background: 'rgba(255,255,255,0.03)', 
                        border: '1px solid rgba(255,255,255,0.05)',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <a 
                              href={`${jiraUrl}/browse/${issue.key}`} 
                              target="_blank" 
                              rel="noreferrer"
                              style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: '600', fontSize: '13px' }}
                            >
                              {issue.key}
                            </a>
                            <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>{issue.fields?.summary}</span>
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-dark)' }}>
                            Статус: <span style={{ color: 'var(--text-muted)' }}>{issue.fields?.status?.name}</span> | Исполнитель: <span style={{ color: 'var(--text-muted)' }}>{issue.fields?.assignee?.displayName || 'Не назначен'}</span>
                          </span>
                        </div>

                        <span style={{ 
                          fontSize: '11px', 
                          fontWeight: 'bold', 
                          color: getPriorityColor(issue.fields?.priority?.name),
                          border: `1px solid ${getPriorityColor(issue.fields?.priority?.name)}`,
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {translatePriority(issue.fields?.priority?.name)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                <Layers size={48} style={{ color: 'var(--text-dark)', marginBottom: '16px' }} />
                <h3>Нет активного спринта</h3>
                <p style={{ fontSize: '13px', marginTop: '6px', marginBottom: '16px' }}>Запустите один из будущих спринтов ниже или создайте новый.</p>
                
                {sprints.filter(s => s.state === 'future').length > 0 && (
                  <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'left' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-dark)' }}>Запланированные спринты:</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                      {sprints.filter(s => s.state === 'future').map(s => (
                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600' }}>{s.name}</span>
                          <button className="btn btn-success" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => handleStartSprint(s.id)}>
                            <Play size={10} /> Запустить спринт
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Board Backlog */}
        <div className="glass-panel" style={{ padding: '24px', maxHeight: '600px', overflowY: 'auto' }}>
          <h3 style={{ fontSize: '18px', color: 'var(--secondary)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Бэклог доски</span>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Задач: {backlog.length}</span>
          </h3>

          {backlog.length === 0 ? (
            <p style={{ color: 'var(--text-dark)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>Бэклог пуст.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {backlog.map(issue => (
                <div key={issue.id} style={{ 
                  background: 'rgba(0,0,0,0.2)', 
                  border: '1px solid rgba(255,255,255,0.03)',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <a 
                      href={`${jiraUrl}/browse/${issue.key}`} 
                      target="_blank" 
                      rel="noreferrer"
                      style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: '600' }}
                    >
                      {issue.key}
                    </a>
                    <span style={{ color: getPriorityColor(issue.fields?.priority?.name), fontWeight: 'bold' }}>
                      {translatePriority(issue.fields?.priority?.name)}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-main)', marginBottom: '6px' }}>{issue.fields?.summary}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-dark)' }}>
                    <span>Исполнитель: {issue.fields?.assignee?.displayName || 'Не назначен'}</span>
                    <span>SP: {issue.fields?.customfield_10026 || issue.fields?.customfield_10008 || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
