import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Trash2, BrainCircuit, UploadCloud, MessageSquare, Mic, FileText, Send, Calendar, AlertTriangle, Loader2, CheckSquare, Square } from 'lucide-react';

export default function Inbox({ onTasksGenerated }) {
  const [inbox, setInbox] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [activeSpaceId, setActiveSpaceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedInboxIds, setSelectedInboxIds] = useState(new Set());
  const [batchActionRunning, setBatchActionRunning] = useState(false);
  
  // Quick Ingest State
  const [quickText, setQuickText] = useState('');
  const [quickSource, setQuickSource] = useState('telegram');
  const [quickTitle, setQuickTitle] = useState('');

  // Audio Upload State
  const [audioFile, setAudioFile] = useState(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  // Analysis State
  const [analyzingId, setAnalyzingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchInbox();
  }, []);

  const fetchInbox = async () => {
    setLoading(true);
    try {
      const [data, spacesList, activeRes] = await Promise.all([
        api.getInbox(),
        api.getSpaces().catch(() => []),
        api.getActiveSpaceId().catch(() => ({ activeSpaceId: '' }))
      ]);
      setInbox(data);
      setSpaces(spacesList);
      setActiveSpaceId(activeRes.activeSpaceId);
    } catch (e) {
      console.error(e);
      setErrorMsg('Не удалось загрузить лог входящих сообщений.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedInboxIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAll = (list) => {
    if (selectedInboxIds.size === list.length) {
      setSelectedInboxIds(new Set());
    } else {
      setSelectedInboxIds(new Set(list.map(item => item.id)));
    }
  };

  const handleBatchDelete = async (filteredList) => {
    const ids = filteredList.filter(item => selectedInboxIds.has(item.id)).map(item => item.id);
    if (ids.length === 0) return;
    if (!window.confirm(`Удалить выбранные логи (${ids.length} шт.)?`)) return;

    setBatchActionRunning(true);
    setErrorMsg('');
    let deletedCount = 0;
    for (const id of ids) {
      try {
        await api.deleteInboxItem(id);
        setInbox(prev => prev.filter(item => item.id !== id));
        setSelectedInboxIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        deletedCount++;
      } catch (e) {
        console.error(`Failed to delete inbox item ${id}:`, e);
        setErrorMsg(prev => (prev ? prev + '\n' : '') + `Не удалось удалить лог ${id}: ${e.message}`);
      }
    }
    setBatchActionRunning(false);
  };

  const handleBatchAnalyze = async (filteredList) => {
    const ids = filteredList.filter(item => selectedInboxIds.has(item.id)).map(item => item.id);
    if (ids.length === 0) return;

    setBatchActionRunning(true);
    setErrorMsg('');
    let analyzedCount = 0;
    for (const id of ids) {
      try {
        await api.analyzeInboxItem(id);
        setInbox(prev => prev.map(item => item.id === id ? { ...item, status: 'processed' } : item));
        setSelectedInboxIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        analyzedCount++;
      } catch (e) {
        console.error(`Failed to analyze inbox item ${id}:`, e);
        setErrorMsg(prev => (prev ? prev + '\n' : '') + `Не удалось проанализировать лог ${id}: ${e.message}`);
      }
    }
    setBatchActionRunning(false);
    if (analyzedCount > 0) {
      if (onTasksGenerated) {
        onTasksGenerated();
      }
      alert(`Успешно обработано ИИ логов: ${analyzedCount}`);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот лог?')) return;
    try {
      await api.deleteInboxItem(id);
      setInbox(prev => prev.filter(item => item.id !== id));
    } catch (e) {
      alert(`Ошибка удаления: ${e.message}`);
    }
  };

  const handleQuickIngest = async (e) => {
    e.preventDefault();
    if (!quickText.trim()) return;

    try {
      const newItem = await api.ingestText({
        source: quickSource,
        content: quickText,
        title: quickTitle || undefined
      });
      setInbox(prev => [newItem, ...prev]);
      setQuickText('');
      setQuickTitle('');
      setErrorMsg('');
    } catch (e) {
      setErrorMsg(`Ошибка импорта: ${e.message}`);
    }
  };

  const handleAudioUpload = async (e) => {
    e.preventDefault();
    if (!audioFile) return;

    setUploadingAudio(true);
    setErrorMsg('');
    
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('source', 'audio');
    formData.append('title', audioFile.name);

    try {
      const res = await api.ingestAudioFile(formData);
      setAudioFile(null);
      
      const fileInput = document.getElementById('audio-file-input');
      if (fileInput) fileInput.value = '';

      fetchInbox();
      if (onTasksGenerated) {
        onTasksGenerated();
      }
      alert('Аудиофайл успешно загружен, транскрибирован и задачи добавлены в черновики!');
    } catch (e) {
      setErrorMsg(`Ошибка обработки аудио: ${e.message}`);
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleAnalyze = async (id) => {
    setAnalyzingId(id);
    setErrorMsg('');
    try {
      await api.analyzeInboxItem(id);
      setInbox(prev => prev.map(item => item.id === id ? { ...item, status: 'processed' } : item));
      if (onTasksGenerated) {
        onTasksGenerated();
      }
    } catch (e) {
      setErrorMsg(`Ошибка анализа ИИ: ${e.message}`);
    } finally {
      setAnalyzingId(null);
    }
  };

  const getSourceIcon = (source) => {
    switch (source) {
      case 'telegram': return <MessageSquare size={16} style={{ color: '#22d3ee' }} />;
      case 'whatsapp': return <MessageSquare size={16} style={{ color: '#34d399' }} />;
      case 'audio': return <Mic size={16} style={{ color: '#a78bfa' }} />;
      default: return <FileText size={16} style={{ color: '#cbd5e1' }} />;
    }
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
        
        {/* Inbox List */}
        <div>
          <h2 style={{ fontSize: '28px', marginBottom: '24px', fontFamily: 'var(--font-display)' }}>Входящие чаты и записи</h2>
          
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

          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px' }}>
              <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto', color: 'var(--primary)' }} />
            </div>
          ) : (() => {
            const filteredInbox = inbox.filter(item => !item.spaceId || item.spaceId === activeSpaceId);
            if (filteredInbox.length === 0) {
              return (
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <MessageSquare size={48} style={{ strokeWidth: 1.5, marginBottom: '16px', color: 'var(--text-dark)' }} />
                  <p style={{ fontSize: '15px' }}>Нет логов во входящих для этого пространства.</p>
                  <p style={{ fontSize: '12px', marginTop: '6px' }}>Используйте расширение Chrome или добавьте лог вручную, чтобы наполнить это пространство.</p>
                </div>
              );
            }
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Batch actions panel */}
                <div className="glass-panel" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '4px 10px', fontSize: '11px', background: 'rgba(255,255,255,0.03)' }}
                      onClick={() => handleToggleAll(filteredInbox)}
                    >
                      {selectedInboxIds.size === filteredInbox.length ? 'Снять выделение' : 'Выбрать все'}
                    </button>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Выделено: {selectedInboxIds.size}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="btn btn-primary" 
                      style={{ padding: '4px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      disabled={selectedInboxIds.size === 0 || batchActionRunning}
                      onClick={() => handleBatchAnalyze(filteredInbox)}
                    >
                      <BrainCircuit size={12} /> Анализ ИИ ({selectedInboxIds.size})
                    </button>
                    <button 
                      className="btn btn-secondary icon-btn-danger" 
                      style={{ padding: '4px 12px', fontSize: '11px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                      disabled={selectedInboxIds.size === 0 || batchActionRunning}
                      onClick={() => handleBatchDelete(filteredInbox)}
                    >
                      Удалить ({selectedInboxIds.size})
                    </button>
                  </div>
                </div>

                {filteredInbox.map(item => {
                  const itemSpace = spaces.find(s => s.id === item.spaceId);
                  return (
                    <div key={item.id} className="glass-panel glass-panel-hover" style={{ padding: '20px', borderLeft: item.status === 'processed' ? '4px solid var(--success)' : '4px solid var(--primary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                          {/* Selection Checkbox */}
                          <div 
                            style={{ cursor: 'pointer', color: selectedInboxIds.has(item.id) ? 'var(--primary)' : 'var(--text-dark)', display: 'flex', alignItems: 'center', marginRight: '4px' }}
                            onClick={() => handleToggleSelect(item.id)}
                          >
                            {selectedInboxIds.has(item.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                          </div>
                          {getSourceIcon(item.source)}
                          <span className={`badge badge-${item.source}`}>{item.source === 'text' ? 'текст' : item.source}</span>
                          {itemSpace && (
                            <span className="badge" style={{ background: 'rgba(236, 72, 153, 0.1)', color: 'var(--secondary)', textTransform: 'none' }}>
                              {itemSpace.name}
                            </span>
                          )}
                          <h4 style={{ fontSize: '15px', color: 'var(--text-main)', margin: 0 }}>{item.title}</h4>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={12} /> {new Date(item.timestamp).toLocaleString()}
                          </span>
                          {item.status === 'processed' ? (
                            <span className="badge badge-low" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>Обработано</span>
                          ) : (
                            <span className="badge badge-high" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)' }}>Новое</span>
                          )}
                        </div>
                      </div>
                      
                      <div style={{ 
                        maxHeight: '120px', 
                        overflowY: 'auto', 
                        fontSize: '13px', 
                        color: 'var(--text-muted)',
                        background: 'rgba(0, 0, 0, 0.2)',
                        padding: '10px',
                        borderRadius: '6px',
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        marginBottom: '16px'
                      }}>
                        {item.content}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 size={14} /> Удалить
                        </button>
                        {item.status !== 'processed' && (
                          <button 
                            className="btn btn-primary" 
                            style={{ padding: '6px 14px', fontSize: '12px' }}
                            onClick={() => handleAnalyze(item.id)}
                            disabled={analyzingId === item.id}
                          >
                            {analyzingId === item.id ? (
                              <>
                                <Loader2 className="animate-spin" size={14} /> Извлечение...
                              </>
                            ) : (
                              <>
                                <BrainCircuit size={14} /> Извлечь задачи ИИ
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Ingestion Panel (Right Sidebar) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Quick Ingest */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
              <Send size={18} /> Быстрая вставка текста
            </h3>
            
            <form onSubmit={handleQuickIngest}>
              <div className="input-group">
                <label>Заголовок лога (необязательно)</label>
                <input 
                  type="text" 
                  className="input-text" 
                  placeholder="Например: Обсуждение бага X с разработчиком"
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label>Канал-источник</label>
                <select className="input-select" value={quickSource} onChange={(e) => setQuickSource(e.target.value)}>
                  <option value="telegram">Telegram</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="text">Общий текст / Документ</option>
                </select>
              </div>

              <div className="input-group">
                <label>Вставьте текст переписки / Заметку</label>
                <textarea 
                  className="input-textarea" 
                  style={{ minHeight: '150px' }}
                  placeholder="[Разработчик]: Я закончил фикс страницы входа. Нужно создать таску на тестирование в JIRA и залить в прод."
                  value={quickText}
                  onChange={(e) => setQuickText(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Добавить во входящие
              </button>
            </form>
          </div>

          {/* Audio Meeting Upload */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--secondary)' }}>
              <UploadCloud size={18} /> Загрузка аудиозаписи встречи
            </h3>
            
            <form onSubmit={handleAudioUpload}>
              <div className="input-group">
                <label>Выберите аудиофайл</label>
                <input 
                  type="file" 
                  id="audio-file-input"
                  className="input-text" 
                  accept="audio/*"
                  onChange={(e) => setAudioFile(e.target.files[0])}
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Поддерживаются форматы MP3, WAV, M4A, OGG. Gemini автоматически расшифрует аудио и извлечет задачи.
                </span>
              </div>

              <button 
                type="submit" 
                className="btn btn-success" 
                style={{ width: '100%' }} 
                disabled={uploadingAudio}
              >
                {uploadingAudio ? (
                  <>
                    <Loader2 className="animate-spin" size={16} /> Расшифровка аудио...
                  </>
                ) : (
                  <>
                    <BrainCircuit size={16} /> Загрузить и проанализировать
                  </>
                )}
              </button>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
}
