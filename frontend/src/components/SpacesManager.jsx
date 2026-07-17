import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { FolderGit, Check, Trash2, Edit3, PlusCircle, AlertTriangle, Layers, BrainCircuit, RefreshCw } from 'lucide-react';

export default function SpacesManager({ onSpaceChanged }) {
  const [spaces, setSpaces] = useState([]);
  const [activeSpaceId, setActiveSpaceId] = useState('');
  
  // Forms lists from integrations
  const [jiraProjects, setJiraProjects] = useState([]);
  const [jiraBoards, setJiraBoards] = useState([]);
  const [gitlabProjects, setGitlabProjects] = useState([]);
  
  // New Space Form State
  const [name, setName] = useState('');
  const [jiraProjectKey, setJiraProjectKey] = useState('');
  const [jiraBoardId, setJiraBoardId] = useState('');
  const [gitlabProjectIds, setGitlabProjectIds] = useState([]);

  // Editing State
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const handleToggleRepo = (id) => {
    const idStr = String(id);
    setGitlabProjectIds(prev => 
      prev.includes(idStr) ? prev.filter(x => x !== idStr) : [...prev, idStr]
    );
  };

  const [loading, setLoading] = useState(false);
  const [analyzingSpaceId, setAnalyzingSpaceId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    let gitlabError = false;
    let jiraError = false;
    try {
      const [spacesList, activeRes] = await Promise.all([
        api.getSpaces(),
        api.getActiveSpaceId()
      ]);

      setSpaces(spacesList);
      setActiveSpaceId(activeRes.activeSpaceId);

      const projects = await api.getJiraProjects().catch(err => {
        console.error('Failed to load JIRA Projects:', err);
        jiraError = true;
        return [];
      });

      const boards = await api.getJiraBoards().catch(err => {
        console.error('Failed to load JIRA Boards:', err);
        jiraError = true;
        return [];
      });

      const gitlabList = await api.getGitLabProjects().catch(err => {
        console.error('Failed to load GitLab Projects:', err);
        gitlabError = true;
        return [];
      });

      setJiraProjects(projects);
      setJiraBoards(boards);
      setGitlabProjects(gitlabList);

      // Инициализируем форму дефолтными значениями
      if (projects.length > 0) setJiraProjectKey(projects[0].key);
      if (boards.length > 0) setJiraBoardId(String(boards[0].id));
      setGitlabProjectIds([]);

      if (jiraError && gitlabError) {
        setErrorMsg('Не удалось загрузить данные из JIRA и GitLab. Проверьте настройки авторизации в вкладке настроек.');
      } else if (jiraError) {
        setErrorMsg('Не удалось загрузить проекты или доски JIRA. Проверьте подключение к JIRA.');
      } else if (gitlabError) {
        setErrorMsg('Не удалось загрузить репозитории GitLab. Убедитесь, что токен GitLab имеет права API/read_repository.');
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Критическая ошибка загрузки данных пространств.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const newSpace = await api.createSpace({
        name,
        jiraProjectKey,
        jiraBoardId,
        gitlabProjectIds
      });
      
      setSpaces(prev => [...prev, newSpace]);
      setName('');
      setGitlabProjectIds([]);
      setSuccessMsg('Пространство успешно создано!');
      
      if (!activeSpaceId) {
        setActiveSpaceId(newSpace.id);
        if (onSpaceChanged) onSpaceChanged(newSpace.id);
      }
    } catch (e) {
      setErrorMsg(`Не удалось создать пространство: ${e.message}`);
    }
  };

  const handleActivate = async (id) => {
    try {
      const res = await api.setActiveSpaceId(id);
      setActiveSpaceId(res.activeSpaceId);
      setSuccessMsg('Активное пространство успешно переключено!');
      if (onSpaceChanged) onSpaceChanged(res.activeSpaceId);
    } catch (e) {
      setErrorMsg(`Не удалось переключить пространство: ${e.message}`);
    }
  };

  const handleFileUpload = async (spaceId, e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    setErrorMsg('');
    setSuccessMsg('');
    
    try {
      const newDoc = await api.uploadSpaceFile(spaceId, formData);
      setSpaces(prev => prev.map(s => {
        if (s.id === spaceId) {
          return { ...s, documents: [...(s.documents || []), newDoc] };
        }
        return s;
      }));
      setSuccessMsg(`Файл "${file.name}" успешно прикреплен к базе знаний пространства!`);
    } catch (err) {
      setErrorMsg(`Ошибка загрузки файла: ${err.message}`);
    }
  };

  const handleAddLinkPrompt = async (spaceId) => {
    const url = prompt('Введите URL ссылки (например, на Google Docs или папку Google Drive):');
    if (!url) return;
    
    const name = prompt('Введите понятное название для ссылки (например, "Google Диск: ТЗ проекта"):');
    if (!name) return;

    setErrorMsg('');
    setSuccessMsg('');
    
    try {
      const newDoc = await api.addSpaceLink(spaceId, name, url);
      setSpaces(prev => prev.map(s => {
        if (s.id === spaceId) {
          return { ...s, documents: [...(s.documents || []), newDoc] };
        }
        return s;
      }));
      setSuccessMsg(`Ссылка "${name}" успешно добавлена!`);
    } catch (err) {
      setErrorMsg(`Ошибка добавления ссылки: ${err.message}`);
    }
  };

  const handleRemoveDocument = async (spaceId, docId) => {
    if (!confirm('Вы действительно хотите удалить этот документ из базы знаний проекта?')) return;
    setErrorMsg('');
    setSuccessMsg('');
    
    try {
      await api.deleteSpaceDocument(spaceId, docId);
      setSpaces(prev => prev.map(s => {
        if (s.id === spaceId) {
          return { ...s, documents: (s.documents || []).filter(d => d.id !== docId) };
        }
        return s;
      }));
      setSuccessMsg('Документ успешно удален из хранилища.');
    } catch (err) {
      setErrorMsg(`Ошибка удаления документа: ${err.message}`);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Вы уверены, что хотите удалить это пространство?')) return;
    try {
      await api.deleteSpace(id);
      setSpaces(prev => prev.filter(s => s.id !== id));
      
      if (activeSpaceId === id) {
        const remaining = spaces.filter(s => s.id !== id);
        const nextActiveId = remaining[0]?.id || '';
        setActiveSpaceId(nextActiveId);
        if (onSpaceChanged) onSpaceChanged(nextActiveId);
      }
    } catch (e) {
      alert(`Ошибка удаления: ${e.message}`);
    }
  };

  const startEdit = (space) => {
    setEditingId(space.id);
    setEditForm({ ...space });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const saveEdit = async (id) => {
    try {
      const updated = await api.updateSpace(id, editForm);
      setSpaces(prev => prev.map(s => s.id === id ? updated : s));
      setEditingId(null);
      setSuccessMsg('Пространство обновлено!');
      if (activeSpaceId === id && onSpaceChanged) {
        onSpaceChanged(id);
      }
    } catch (e) {
      alert(`Ошибка обновления: ${e.message}`);
    }
  };

  const handleAnalyzeContext = async (id) => {
    setAnalyzingSpaceId(id);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const updatedSpace = await api.analyzeSpaceContext(id);
      setSpaces(prev => prev.map(s => s.id === id ? updatedSpace : s));
      setSuccessMsg(`Контекст проекта "${updatedSpace.name}" успешно проанализирован ИИ и сохранен!`);
      if (activeSpaceId === id && onSpaceChanged) {
        onSpaceChanged(id);
      }
    } catch (err) {
      setErrorMsg(`Ошибка анализа контекста проекта: ${err.message}`);
    } finally {
      setAnalyzingSpaceId(null);
    }
  };

  return (
    <div className="fade-in">
      <h2 style={{ fontSize: '28px', marginBottom: '24px', fontFamily: 'var(--font-display)' }}>Управление пространствами</h2>
      
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
          <AlertTriangle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '12px 16px', 
          borderRadius: 'var(--radius-sm)', 
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid var(--success)',
          color: '#34d399',
          textAlign: 'center'
        }}>
          {successMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Список пространств */}
        <div>
          <h3 style={{ fontSize: '18px', color: 'var(--primary)', marginBottom: '16px' }}>Существующие пространства</h3>
          {spaces.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Layers size={48} style={{ strokeWidth: 1.5, marginBottom: '16px', color: 'var(--text-dark)' }} />
              <p>Вы пока не создали ни одного пространства.</p>
              <p style={{ fontSize: '12px', marginTop: '6px' }}>Используйте форму справа, чтобы привязать проект JIRA, доску и репозиторий GitLab.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {spaces.map(space => {
                const isActive = activeSpaceId === space.id;
                const activeRepos = gitlabProjects.filter(p => (space.gitlabProjectIds || []).includes(String(p.id)));
                const board = jiraBoards.find(b => String(b.id) === String(space.jiraBoardId));
                
                return (
                  <div 
                    key={space.id} 
                    className="glass-panel" 
                    style={{ 
                      padding: '20px', 
                      borderLeft: isActive ? '4px solid var(--success)' : '4px solid transparent',
                      boxShadow: isActive ? '0 0 15px var(--success-glow)' : 'none'
                    }}
                  >
                    {editingId === space.id ? (
                      // Редактирование пространства
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className="input-group">
                          <label>Название пространства</label>
                          <input 
                            type="text" 
                            name="name" 
                            className="input-text" 
                            value={editForm.name} 
                            onChange={handleEditChange} 
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div className="input-group">
                            <label>Проект JIRA</label>
                            <select 
                              name="jiraProjectKey" 
                              className="input-select" 
                              value={editForm.jiraProjectKey} 
                              onChange={handleEditChange}
                              disabled={jiraProjects.length === 0}
                            >
                              {jiraProjects.length === 0 ? (
                                <option value="">-- Нет проектов (проверьте Настройки) --</option>
                              ) : (
                                jiraProjects.map(p => (
                                  <option key={p.key} value={p.key}>{p.name} ({p.key})</option>
                                ))
                              )}
                            </select>
                          </div>
                          
                          <div className="input-group">
                            <label>Доска JIRA</label>
                            <select 
                              name="jiraBoardId" 
                              className="input-select" 
                              value={editForm.jiraBoardId} 
                              onChange={handleEditChange}
                              disabled={jiraBoards.length === 0}
                            >
                              {jiraBoards.length === 0 ? (
                                <option value="">-- Нет досок (проверьте Настройки) --</option>
                              ) : (
                                jiraBoards.map(b => (
                                  <option key={b.id} value={b.id}>{b.name}</option>
                                ))
                              )}
                            </select>
                          </div>
                        </div>

                        <div className="input-group">
                          <label>Репозитории GitLab</label>
                          {gitlabProjects.length === 0 ? (
                            <div style={{ fontSize: '11px', color: 'var(--text-dark)', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                              Нет доступных репозиториев (проверьте Настройки)
                            </div>
                          ) : (
                            <div style={{ 
                              maxHeight: '120px', 
                              overflowY: 'auto', 
                              background: 'rgba(0,0,0,0.2)', 
                              padding: '10px', 
                              borderRadius: '6px',
                              border: '1px solid var(--glass-border)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}>
                              {gitlabProjects.map(p => {
                                const isChecked = (editForm.gitlabProjectIds || []).includes(String(p.id));
                                return (
                                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                                    <input 
                                      type="checkbox" 
                                      checked={isChecked}
                                      onChange={() => {
                                        const idStr = String(p.id);
                                        const currentIds = editForm.gitlabProjectIds || [];
                                        const nextIds = currentIds.includes(idStr)
                                          ? currentIds.filter(x => x !== idStr)
                                          : [...currentIds, idStr];
                                        setEditForm(prev => ({ ...prev, gitlabProjectIds: nextIds }));
                                      }}
                                    />
                                    <span>{p.pathWithNamespace}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary" onClick={() => setEditingId(null)}>Отмена</button>
                          <button className="btn btn-success" onClick={() => saveEdit(space.id)}>Сохранить</button>
                        </div>
                      </div>
                    ) : (
                      // Просмотр пространства
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <h4 style={{ fontSize: '18px', fontWeight: 'bold' }}>{space.name}</h4>
                          {isActive ? (
                            <span className="badge badge-low" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>Активно</span>
                          ) : (
                            <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => handleActivate(space.id)}>
                              Активировать
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                          <div>
                            <div>Проект JIRA: <strong style={{ color: 'var(--text-main)' }}>{space.jiraProjectKey || '—'}</strong></div>
                            <div>Доска JIRA: <strong style={{ color: 'var(--text-main)' }}>{board?.name || space.jiraBoardId || '—'}</strong></div>
                          </div>
                          <div>
                            <div style={{ color: 'var(--text-muted)' }}>Репозитории ({activeRepos.length}):</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                              {activeRepos.length === 0 ? <span style={{ color: 'var(--text-dark)', fontSize: '12px' }}>Не привязаны</span> : (
                                activeRepos.map(r => (
                                  <span key={r.id} className="badge badge-low" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', textTransform: 'none', fontSize: '11px' }}>
                                    {r.name}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Результаты ИИ-анализа контекста */}
                        {space.contextProfile && (
                          <div style={{ 
                            marginTop: '16px', 
                            marginBottom: '16px',
                            background: 'rgba(0,0,0,0.25)', 
                            padding: '16px', 
                            borderRadius: '8px', 
                            fontSize: '12px', 
                            border: '1px solid rgba(255,255,255,0.06)' 
                          }}>
                            <h5 style={{ color: 'var(--primary)', marginBottom: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                              <BrainCircuit size={16} /> ИИ-База знаний проекта:
                            </h5>
                            
                            {/* Скорость */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px', background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: '4px' }}>
                              <div>Скорость команды: <strong style={{ color: 'var(--success)' }}>{space.contextProfile.velocity?.averageStoryPoints || '—'} SP / спринт</strong></div>
                              <div>Спринт: <strong>{space.contextProfile.velocity?.sprintLengthWeeks || 2} недели</strong></div>
                            </div>

                            {/* Имеющийся функционал (Existing Features) */}
                            {space.contextProfile.projectIntelligence?.existingFeatures && space.contextProfile.projectIntelligence.existingFeatures.length > 0 && (
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ color: 'var(--primary)', fontWeight: 'bold', marginBottom: '4px' }}>Имеющийся функционал (уже сделано):</div>
                                <ul style={{ margin: 0, paddingLeft: '16px', listStyleType: 'disc', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {space.contextProfile.projectIntelligence.existingFeatures.map((feat, idx) => (
                                    <li key={idx} style={{ lineHeight: '1.3' }}>{feat}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Архитектура и стек */}
                            {(space.contextProfile.projectIntelligence?.technicalStack || space.contextProfile.projectIntelligence?.architectureDetails) && (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                {space.contextProfile.projectIntelligence.technicalStack && (
                                  <div>
                                    <div style={{ color: 'var(--text-dark)', fontWeight: 'bold', marginBottom: '2px' }}>Технический стек:</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '11px', lineHeight: '1.3' }}>{space.contextProfile.projectIntelligence.technicalStack}</div>
                                  </div>
                                )}
                                {space.contextProfile.projectIntelligence.architectureDetails && (
                                  <div>
                                    <div style={{ color: 'var(--text-dark)', fontWeight: 'bold', marginBottom: '2px' }}>Архитектура:</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '11px', lineHeight: '1.3' }}>{space.contextProfile.projectIntelligence.architectureDetails}</div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Карта кода и Недавние изменения */}
                            {space.contextProfile.codebaseMapping?.mainComponents && (
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ color: 'var(--text-dark)', fontWeight: 'bold', marginBottom: '2px' }}>Модули кодовой базы:</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '11px', lineHeight: '1.3' }}>{space.contextProfile.codebaseMapping.mainComponents}</div>
                              </div>
                            )}
                            {space.contextProfile.projectIntelligence?.recentCompletedWork && (
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ color: 'var(--text-dark)', fontWeight: 'bold', marginBottom: '2px' }}>Недавние изменения:</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '11px', lineHeight: '1.3' }}>{space.contextProfile.projectIntelligence.recentCompletedWork}</div>
                              </div>
                            )}

                            {/* Интерактивная карта элементов интерфейса */}
                            {space.contextProfile.projectIntelligence?.uiFeaturesMap && space.contextProfile.projectIntelligence.uiFeaturesMap.length > 0 && (
                              <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', marginBottom: '12px' }}>
                                <div style={{ color: 'var(--primary)', fontWeight: 'bold', marginBottom: '8px' }}>Карта интерфейса и кнопок (UI & API Trace):</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '6px' }}>
                                  {space.contextProfile.projectIntelligence.uiFeaturesMap.map((page, pIdx) => (
                                    <div key={pIdx} style={{ background: 'rgba(255,255,255,0.01)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.02)' }}>
                                      <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '11px', marginBottom: '4px' }}>{page.pageName}</div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingLeft: '8px' }}>
                                        {page.elements?.map((el, eIdx) => (
                                          <div key={eIdx} style={{ fontSize: '11px', lineHeight: '1.3', color: 'var(--text-muted)' }}>
                                            • <strong style={{ color: 'var(--text-dark)' }}>{el.elementName}</strong>: <span>{el.actionDescription}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Шаблоны JIRA */}
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                              <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Стиль названий JIRA:</div>
                                <div style={{ fontWeight: '500', color: 'var(--text-main)' }}>{space.contextProfile.taskFormat?.namingPattern || '—'}</div>
                              </div>
                              <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Шкала оценок SP:</div>
                                <div style={{ color: 'var(--text-main)' }}>{space.contextProfile.taskFormat?.storyPointsDistribution || '—'}</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* База знаний и файлы пространства */}
                        <div style={{ 
                          marginTop: '16px', 
                          marginBottom: '16px', 
                          background: 'rgba(255,255,255,0.02)', 
                          padding: '16px', 
                          borderRadius: '8px', 
                          border: '1px solid var(--glass-border)' 
                        }}>
                          <h5 style={{ color: 'var(--primary)', fontWeight: 'bold', marginBottom: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FolderGit size={16} /> База знаний и документы проекта
                          </h5>
                          
                          {/* Список документов */}
                          {(!space.documents || space.documents.length === 0) ? (
                            <div style={{ fontSize: '12px', color: 'var(--text-dark)', padding: '10px 0' }}>
                              Документы и ссылки не прикреплены. Загрузите ТЗ или привяжите Google Drive.
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                              {space.documents.map(doc => (
                                <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '6px 10px', borderRadius: '4px', fontSize: '12px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {doc.type === 'link' ? (
                                      <span style={{ color: '#60a5fa', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => window.open(doc.url, '_blank')}>
                                        🔗 {doc.name}
                                      </span>
                                    ) : (
                                      <span style={{ color: 'var(--text-main)' }}>
                                        📄 {doc.name} <span style={{ color: 'var(--text-dark)', fontSize: '10px' }}>({(doc.size / 1024).toFixed(1)} KB)</span>
                                      </span>
                                    )}
                                  </div>
                                  <button 
                                    className="btn-link" 
                                    style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px' }}
                                    onClick={() => handleRemoveDocument(space.id, doc.id)}
                                  >
                                    Удалить
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Панель добавления документов */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '12px' }}>
                            {/* Загрузка файлов */}
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-dark)', marginBottom: '4px' }}>Загрузить локальный файл ТЗ (.txt, .md):</div>
                              <input 
                                type="file" 
                                id={`file-upload-${space.id}`}
                                style={{ display: 'none' }} 
                                onChange={(e) => handleFileUpload(space.id, e)}
                              />
                              <label 
                                htmlFor={`file-upload-${space.id}`} 
                                className="btn btn-secondary" 
                                style={{ display: 'block', textAlign: 'center', padding: '6px 10px', fontSize: '11px', cursor: 'pointer' }}
                              >
                                Выбрать файл
                              </label>
                            </div>

                            {/* Добавление ссылки на Google Drive */}
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-dark)', marginBottom: '4px' }}>Добавить ссылку (Google Drive, Notion):</div>
                              <button 
                                className="btn btn-secondary" 
                                style={{ display: 'block', width: '100%', padding: '6px 10px', fontSize: '11px' }}
                                onClick={() => handleAddLinkPrompt(space.id)}
                              >
                                Привязать ссылку
                              </button>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ 
                              padding: '6px 12px', 
                              fontSize: '12px', 
                              marginRight: 'auto', 
                              background: 'rgba(99, 102, 241, 0.1)', 
                              border: '1px solid rgba(99, 102, 241, 0.3)',
                              color: 'var(--primary)'
                            }}
                            onClick={() => handleAnalyzeContext(space.id)}
                            disabled={analyzingSpaceId === space.id}
                          >
                            {analyzingSpaceId === space.id ? (
                              <>
                                <RefreshCw className="animate-spin" size={12} /> Анализ...
                              </>
                            ) : (
                              <>
                                <BrainCircuit size={12} /> ИИ-Изучение проекта
                              </>
                            )}
                          </button>
                          
                          <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => startEdit(space)}>
                            <Edit3 size={12} /> Изменить
                          </button>
                          <button className="btn btn-secondary icon-btn-danger" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleDelete(space.id)}>
                            <Trash2 size={12} /> Удалить
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Форма создания пространства */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
            <PlusCircle size={18} /> Создать пространство
          </h3>
          
          <form onSubmit={handleCreate}>
            <div className="input-group">
              <label>Название пространства</label>
              <input 
                type="text" 
                className="input-text" 
                placeholder="Например: Мобильное приложение"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label>Проект JIRA</label>
              <select 
                className="input-select" 
                value={jiraProjectKey} 
                onChange={(e) => setJiraProjectKey(e.target.value)}
                disabled={jiraProjects.length === 0}
                required
              >
                {jiraProjects.length === 0 ? (
                  <option value="">-- Нет доступных проектов (проверьте Настройки) --</option>
                ) : (
                  jiraProjects.map(p => (
                    <option key={p.key} value={p.key}>{p.name} ({p.key})</option>
                  ))
                )}
              </select>
            </div>

            <div className="input-group">
              <label>Доска JIRA (Agile)</label>
              <select 
                className="input-select" 
                value={jiraBoardId} 
                onChange={(e) => setJiraBoardId(e.target.value)}
                disabled={jiraBoards.length === 0}
                required
              >
                {jiraBoards.length === 0 ? (
                  <option value="">-- Нет доступных досок (проверьте Настройки) --</option>
                ) : (
                  jiraBoards.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))
                )}
              </select>
            </div>

            <div className="input-group">
              <label>Репозитории GitLab (выберите один или несколько)</label>
              {gitlabProjects.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-dark)', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                  Нет доступных репозиториев (проверьте Настройки)
                </div>
              ) : (
                <div style={{ 
                  maxHeight: '150px', 
                  overflowY: 'auto', 
                  background: 'rgba(0,0,0,0.2)', 
                  padding: '10px', 
                  borderRadius: '6px',
                  border: '1px solid var(--glass-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {gitlabProjects.map(p => {
                    const isChecked = gitlabProjectIds.includes(String(p.id));
                    return (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => handleToggleRepo(p.id)}
                        />
                        <span>{p.pathWithNamespace}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={loading}>
              Добавить пространство
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
