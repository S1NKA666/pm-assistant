import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Check, Edit3, Trash2, ExternalLink, Zap, AlertCircle, RefreshCw, Layers, CheckSquare, Square } from 'lucide-react';

export default function TaskDrafts({ activeSpaceId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sprints, setSprints] = useState([]);
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [allBoards, setAllBoards] = useState([]);
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [projects, setProjects] = useState([]);
  const [selectedProjectKey, setSelectedProjectKey] = useState('');
  
  // Jira Url from settings for link creation
  const [jiraUrl, setJiraUrl] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState(null);
  const [editedTask, setEditedTask] = useState({});
  const [pushingId, setPushingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [batchPushing, setBatchPushing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [taskList, settings, spacesList, activeRes] = await Promise.all([
        api.getTasks(),
        api.getSettings(),
        api.getSpaces().catch(() => []),
        api.getActiveSpaceId().catch(() => ({ activeSpaceId: '' }))
      ]);
      setTasks(taskList);
      setJiraUrl(settings.jiraUrl);

      // Load projects and boards
      const [projList, boardList] = await Promise.all([
        api.getJiraProjects().catch(() => []),
        api.getJiraBoards().catch(() => [])
      ]);
      setProjects(projList);
      setAllBoards(boardList);

      const activeSpace = spacesList.find(s => s.id === activeRes.activeSpaceId);
      const spaceBoardId = activeSpace?.jiraBoardId;
      const spaceProjectKey = activeSpace?.jiraProjectKey;

      const defaultBoardId = spaceBoardId || settings.jiraBoardId || (boardList[0]?.id ? String(boardList[0].id) : '');
      setSelectedBoardId(defaultBoardId);

      const defaultProjKey = spaceProjectKey || settings.jiraProjectKey || (projList[0]?.key || '');
      setSelectedProjectKey(defaultProjKey);

      if (defaultBoardId) {
        await loadSprintsForBoard(defaultBoardId);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Не удалось загрузить черновики задач или настройки JIRA.');
    } finally {
      setLoading(false);
    }
  };

  const loadSprintsForBoard = async (bId) => {
    try {
      const sprintList = await api.getJiraSprints(bId).catch(() => []);
      setSprints(sprintList.filter(s => s.state !== 'closed'));
      const active = sprintList.find(s => s.state === 'active');
      if (active) setSelectedSprintId(active.id);
      else setSelectedSprintId('');
    } catch (e) {
      console.error('Failed to load sprints for board', bId, e);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить этот черновик задачи?')) return;
    try {
      await api.deleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      alert(`Ошибка удаления: ${e.message}`);
    }
  };

  const startEdit = (task) => {
    setEditingId(task.id);
    setEditedTask({ ...task });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditedTask(prev => ({ ...prev, [name]: value }));
  };

  const saveEdit = async (id) => {
    try {
      const updated = await api.updateTask(id, editedTask);
      setTasks(prev => prev.map(t => t.id === id ? updated : t));
      setEditingId(null);
    } catch (e) {
      alert(`Ошибка обновления: ${e.message}`);
    }
  };

  const handlePush = async (id) => {
    setPushingId(id);
    setErrorMsg('');
    try {
      // Пушим задачу. Передаем selectedSprintId и selectedProjectKey
      const res = await api.pushTaskToJira(id, selectedSprintId || null, selectedProjectKey || null);
      
      // Обновляем состояние задачи
      setTasks(prev => prev.map(t => t.id === id ? res.task : t));
    } catch (e) {
      setErrorMsg(`Ошибка пуша в JIRA: ${e.message}`);
    } finally {
      setPushingId(null);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAll = (draftList) => {
    if (selectedTaskIds.size === draftList.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(draftList.map(t => t.id)));
    }
  };

  const handleBatchPush = async (draftList) => {
    const idsToPush = draftList.filter(t => selectedTaskIds.has(t.id)).map(t => t.id);
    if (idsToPush.length === 0) return;

    setBatchPushing(true);
    setErrorMsg('');
    let successCount = 0;
    
    for (const id of idsToPush) {
      try {
        const res = await api.pushTaskToJira(id, selectedSprintId || null, selectedProjectKey || null);
        setTasks(prev => prev.map(t => t.id === id ? res.task : t));
        setSelectedTaskIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        successCount++;
      } catch (e) {
        console.error(`Failed to push task ${id}:`, e);
        setErrorMsg(prev => (prev ? prev + '\n' : '') + `Ошибка заведения задачи: ${e.message}`);
      }
    }
    
    setBatchPushing(false);
    if (successCount > 0) {
      alert(`Успешно создано задач в JIRA: ${successCount}`);
    }
  };

  const handleBatchDelete = async (draftList) => {
    const idsToDelete = draftList.filter(t => selectedTaskIds.has(t.id)).map(t => t.id);
    if (idsToDelete.length === 0) return;
    if (!window.confirm(`Удалить выбранные черновики задач (${idsToDelete.length} шт.)?`)) return;

    setBatchPushing(true);
    setErrorMsg('');
    let successCount = 0;
    
    for (const id of idsToDelete) {
      try {
        await api.deleteTask(id);
        setTasks(prev => prev.filter(t => t.id !== id));
        setSelectedTaskIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        successCount++;
      } catch (e) {
        console.error(`Failed to delete task ${id}:`, e);
        setErrorMsg(prev => (prev ? prev + '\n' : '') + `Ошибка удаления задачи: ${e.message}`);
      }
    }
    
    setBatchPushing(false);
  };

  const translatePriority = (priority) => {
    switch (priority) {
      case 'High': return 'Высокий';
      case 'Medium': return 'Средний';
      case 'Low': return 'Низкий';
      default: return priority;
    }
  };

  const drafts = tasks.filter(t => t.status === 'draft' && (!activeSpaceId || t.spaceId === activeSpaceId));
  const pushed = tasks.filter(t => t.status === 'pushed' && (!activeSpaceId || t.spaceId === activeSpaceId));

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <h2 style={{ fontSize: '28px', fontFamily: 'var(--font-display)' }}>Черновики задач</h2>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Project selector */}
          {projects.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="glass-panel" style={{ padding: '6px 12px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>Целевой проект JIRA:</span>
              <select 
                className="input-select" 
                style={{ padding: '4px 8px', fontSize: '12px', background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: '4px' }}
                value={selectedProjectKey}
                onChange={(e) => setSelectedProjectKey(e.target.value)}
              >
                {projects.map(p => (
                  <option key={p.key} value={p.key}>{p.name} ({p.key})</option>
                ))}
              </select>
            </div>
          )}

          {/* Board Selector */}
          {allBoards.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="glass-panel" style={{ padding: '6px 12px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>Доска (для спринтов):</span>
              <select 
                className="input-select" 
                style={{ padding: '4px 8px', fontSize: '12px', background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: '4px' }}
                value={selectedBoardId}
                onChange={(e) => {
                  setSelectedBoardId(e.target.value);
                  loadSprintsForBoard(e.target.value);
                }}
              >
                {allBoards.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Sprint selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="glass-panel" style={{ padding: '6px 12px' }}>
            <Layers size={14} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>Спринт JIRA:</span>
            <select 
              className="input-select" 
              style={{ padding: '4px 8px', fontSize: '12px', background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: '4px' }}
              value={selectedSprintId}
              onChange={(e) => setSelectedSprintId(e.target.value)}
            >
              <option value="">Бэклог (без спринта)</option>
              {sprints.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.state === 'active' ? 'активный' : 'будущий'})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '12px 16px', 
          borderRadius: 'var(--radius-sm)', 
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--danger)',
          color: '#f87171',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px' }}>
          <RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto', color: 'var(--primary)' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', alignItems: 'start' }}>
          
          {/* Drafts Board */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', color: 'var(--primary)', margin: 0 }}>
                Ожидают утверждения ({drafts.length})
              </h3>
              {drafts.length > 0 && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '4px 10px', fontSize: '11px', background: 'rgba(255,255,255,0.03)' }}
                    onClick={() => handleToggleAll(drafts)}
                  >
                    {selectedTaskIds.size === drafts.length ? 'Снять выделение' : 'Выбрать все'}
                  </button>
                  <button 
                    className="btn btn-primary" 
                    style={{ padding: '4px 12px', fontSize: '11px' }}
                    disabled={selectedTaskIds.size === 0 || batchPushing}
                    onClick={() => handleBatchPush(drafts)}
                  >
                    {batchPushing ? 'Создание...' : `Завести выбранные (${selectedTaskIds.size})`}
                  </button>
                  <button 
                    className="btn btn-secondary icon-btn-danger" 
                    style={{ padding: '4px 12px', fontSize: '11px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                    disabled={selectedTaskIds.size === 0 || batchPushing}
                    onClick={() => handleBatchDelete(drafts)}
                  >
                    Удалить ({selectedTaskIds.size})
                  </button>
                </div>
              )}
            </div>
            
            {drafts.length === 0 ? (
              <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Check size={48} style={{ strokeWidth: 1.5, marginBottom: '16px', color: 'var(--success)' }} />
                <p>Нет черновиков задач.</p>
                <p style={{ fontSize: '12px', marginTop: '6px' }}>Используйте кнопку «Извлечь задачи ИИ» на вкладке входящих логов.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {drafts.map(task => (
                  <div key={task.id} className="glass-panel" style={{ padding: '20px' }}>
                    {editingId === task.id ? (
                      // EDIT MODE
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className="input-group">
                          <label>Заголовок задачи (Summary)</label>
                          <input 
                            type="text" 
                            name="summary" 
                            className="input-text" 
                            value={editedTask.summary} 
                            onChange={handleEditChange} 
                          />
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                          <div className="input-group">
                            <label>Приоритет</label>
                            <select 
                              name="priority" 
                              className="input-select" 
                              value={editedTask.priority} 
                              onChange={handleEditChange}
                            >
                              <option value="High">Высокий (High)</option>
                              <option value="Medium">Средний (Medium)</option>
                              <option value="Low">Низкий (Low)</option>
                            </select>
                          </div>
                          <div className="input-group">
                            <label>Исполнитель (Логин в JIRA)</label>
                            <input 
                              type="text" 
                              name="assignee" 
                              className="input-text" 
                              placeholder="Например: i.ivanov"
                              value={editedTask.assignee || ''} 
                              onChange={handleEditChange} 
                            />
                          </div>
                          <div className="input-group">
                            <label>Story Points</label>
                            <input 
                              type="number" 
                              name="storyPoints" 
                              className="input-text" 
                              placeholder="Например: 5"
                              value={editedTask.storyPoints || ''} 
                              onChange={handleEditChange} 
                            />
                          </div>
                        </div>

                        <div className="input-group">
                          <label>Описание задачи</label>
                          <textarea 
                            name="description" 
                            className="input-textarea" 
                            style={{ minHeight: '120px' }}
                            value={editedTask.description} 
                            onChange={handleEditChange} 
                          />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary" onClick={() => setEditingId(null)}>Отмена</button>
                          <button className="btn btn-success" onClick={() => saveEdit(task.id)}>Сохранить</button>
                        </div>
                      </div>
                    ) : (
                      // VIEW MODE
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, flexWrap: 'wrap' }}>
                            <div 
                              style={{ cursor: 'pointer', color: selectedTaskIds.has(task.id) ? 'var(--primary)' : 'var(--text-dark)', display: 'flex', alignItems: 'center' }}
                              onClick={() => handleToggleSelect(task.id)}
                            >
                              {selectedTaskIds.has(task.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                            </div>
                            {/* taskType badge */}
                            {task.taskType && (() => {
                              const typeColors = { frontend: '#6366f1', backend: '#10b981', fullstack: '#f59e0b', design: '#ec4899', testing: '#8b5cf6', devops: '#64748b' };
                              const typeLabels = { frontend: 'FRONT', backend: 'BACK', fullstack: 'FULL', design: 'DESIGN', testing: 'TEST', devops: 'DEVOPS' };
                              return (
                                <span style={{ background: typeColors[task.taskType] || 'var(--primary)', color: '#fff', fontSize: '10px', fontWeight: 'bold', padding: '2px 7px', borderRadius: '4px', letterSpacing: '0.5px' }}>
                                  {typeLabels[task.taskType] || task.taskType.toUpperCase()}
                                </span>
                              );
                            })()}
                            <h4 style={{ fontSize: '15px', fontWeight: '600', margin: 0 }}>{task.summary}</h4>
                          </div>
                          <span className={`badge badge-${task.priority?.toLowerCase()}`}>{translatePriority(task.priority)}</span>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                          {task.assignee && (
                            <span>👤 <strong>{task.assignee}</strong></span>
                          )}
                          {task.storyPoints && (
                            <span style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--primary)', padding: '1px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                              {task.storyPoints} SP
                            </span>
                          )}
                          {task.dueDate && (
                            <span>📅 Срок: <strong>{task.dueDate}</strong></span>
                          )}
                          {task.sourceDocument && (
                            <span style={{ fontStyle: 'italic' }}>📄 {task.sourceDocument}</span>
                          )}
                        </div>

                        <pre style={{ 
                          fontSize: '12px', 
                          color: 'var(--text-muted)', 
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'inherit',
                          lineHeight: '1.7',
                          background: 'rgba(0,0,0,0.15)',
                          padding: '12px',
                          borderRadius: '6px',
                          border: '1px solid rgba(255, 255, 255, 0.03)',
                          marginBottom: '16px',
                          maxHeight: '280px',
                          overflowY: 'auto'
                        }}>
                          {task.description}
                        </pre>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => startEdit(task)}>
                              <Edit3 size={12} /> Изменить
                            </button>
                            <button className="btn btn-secondary icon-btn-danger" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleDelete(task.id)}>
                              <Trash2 size={12} /> Удалить
                            </button>
                          </div>
                          
                          <button 
                            className="btn btn-primary" 
                            style={{ padding: '8px 16px', fontSize: '13px' }} 
                            onClick={() => handlePush(task.id)}
                            disabled={pushingId === task.id}
                          >
                            {pushingId === task.id ? 'Создание...' : (
                              <>
                                <Zap size={14} /> Создать в JIRA
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pushed Tasks Log */}
          <div>
            <h3 style={{ fontSize: '18px', color: 'var(--success)', marginBottom: '16px' }}>
              Отправлено в JIRA ({pushed.length})
            </h3>
            {pushed.length === 0 ? (
              <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dark)', fontSize: '13px' }}>
                Здесь будут отображаться созданные в JIRA задачи.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pushed.map(task => (
                  <div key={task.id} className="glass-panel" style={{ padding: '14px 16px', borderLeft: '4px solid var(--success)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)' }}>{task.summary}</span>
                      <a 
                        href={`${jiraUrl}/browse/${task.jiraKey}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="badge badge-low" 
                        style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                      >
                        {task.jiraKey} <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
