import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { GitBranch, GitCommit, Folder, File, Code, RefreshCw, AlertTriangle, ChevronRight, CornerDownRight, ExternalLink } from 'lucide-react';

export default function GitLabManager() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [commits, setCommits] = useState([]);
  const [fileTree, setFileTree] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  
  // File Content State
  const [activeFile, setActiveFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [data, spacesList, activeRes] = await Promise.all([
        api.getGitLabProjects(),
        api.getSpaces().catch(() => []),
        api.getActiveSpaceId().catch(() => ({ activeSpaceId: '' }))
      ]);

      const activeSpace = spacesList.find(s => s.id === activeRes.activeSpaceId);
      const spaceRepoIds = activeSpace?.gitlabProjectIds || [];

      if (data.length > 0) {
        // Оставляем только те проекты, которые привязаны к пространству
        const filteredProjects = data.filter(p => spaceRepoIds.includes(String(p.id)));
        const availableProjects = filteredProjects.length > 0 ? filteredProjects : data;

        setProjects(availableProjects);

        const defaultProj = availableProjects[0];
        if (defaultProj) {
          setSelectedProjectId(defaultProj.id);
          loadProjectDetails(defaultProj.id, defaultProj.defaultBranch || 'main');
        }
      } else {
        setProjects([]);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Не удалось загрузить проекты GitLab. Проверьте URL и токен в настройках.');
    } finally {
      setLoading(false);
    }
  };

  const loadProjectDetails = async (projId, branchName) => {
    setLoading(false);
    setErrorMsg('');
    try {
      // 1. Загружаем ветки
      const branchList = await api.getGitLabBranches(projId).catch(() => []);
      setBranches(branchList);
      
      const activeBranch = branchName || branchList.find(b => b.default)?.name || branchList[0]?.name || 'main';
      setSelectedBranch(activeBranch);

      // 2. Загружаем коммиты и дерево файлов
      await Promise.all([
        loadCommits(projId, activeBranch),
        loadFileTree(projId, activeBranch, '')
      ]);
    } catch (e) {
      console.error(e);
      setErrorMsg(`Ошибка GitLab: ${e.message}`);
    }
  };

  const loadCommits = async (projId, branch) => {
    const list = await api.getGitLabCommits(projId, branch).catch(() => []);
    setCommits(list);
  };

  const loadFileTree = async (projId, branch, path) => {
    setActiveFile(null);
    setFileContent('');
    setCurrentPath(path);
    try {
      const tree = await api.getGitLabTree(projId, branch, path);
      setFileTree(tree);
    } catch (e) {
      console.error(e);
      setErrorMsg(`Не удалось загрузить дерево файлов: ${e.message}`);
    }
  };

  const handleProjectChange = (e) => {
    const projId = e.target.value;
    setSelectedProjectId(projId);
    const proj = projects.find(p => String(p.id) === String(projId));
    loadProjectDetails(projId, proj?.defaultBranch || 'main');
  };

  const handleBranchChange = (e) => {
    const branchName = e.target.value;
    setSelectedBranch(branchName);
    loadCommits(selectedProjectId, branchName);
    loadFileTree(selectedProjectId, branchName, '');
  };

  const handleNodeClick = async (node) => {
    if (node.type === 'tree') {
      // Папка
      loadFileTree(selectedProjectId, selectedBranch, node.path);
    } else {
      // Файл - загружаем контент
      setActiveFile(node);
      setLoadingFile(true);
      try {
        const text = await api.getGitLabFileContent(selectedProjectId, node.path, selectedBranch);
        setFileContent(text);
      } catch (e) {
        setFileContent(`Ошибка загрузки содержимого: ${e.message}`);
      } finally {
        setLoadingFile(false);
      }
    }
  };

  const goBackFolder = () => {
    const parts = currentPath.split('/');
    parts.pop();
    const parentPath = parts.join('/');
    loadFileTree(selectedProjectId, selectedBranch, parentPath);
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ fontSize: '28px', fontFamily: 'var(--font-display)' }}>Интеграция с GitLab</h2>
          
          {projects.length > 0 && (
            <select 
              className="input-select"
              style={{ padding: '6px 12px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--glass-border)', fontSize: '14px' }}
              value={selectedProjectId}
              onChange={handleProjectChange}
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.pathWithNamespace}</option>
              ))}
            </select>
          )}

          {branches.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} className="glass-panel" style={{ padding: '6px 12px' }}>
              <GitBranch size={14} style={{ color: 'var(--primary)' }} />
              <select 
                className="input-select"
                style={{ padding: '2px 8px', fontSize: '12px', background: 'rgba(0,0,0,0.3)', border: 'none' }}
                value={selectedBranch}
                onChange={handleBranchChange}
              >
                {branches.map(b => (
                  <option key={b.name} value={b.name}>{b.name} {b.default ? '(default)' : ''}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <button className="btn btn-secondary" onClick={loadProjects} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Обновить
        </button>
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
          <AlertTriangle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px' }}>
          <RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto', color: 'var(--primary)' }} />
        </div>
      ) : projects.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Code size={48} style={{ strokeWidth: 1.5, marginBottom: '16px', color: 'var(--text-dark)' }} />
          <h3>Репозитории не настроены</h3>
          <p style={{ fontSize: '13px', marginTop: '6px' }}>Перейдите во вкладку «Настройки» и укажите ваш GitLab URL и Токен.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: '24px', alignItems: 'start' }}>
          
          {/* Левая панель - Файлы и Коммиты */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Файловый браузер */}
            <div className="glass-panel" style={{ padding: '20px', maxHeight: '400px', overflowY: 'auto' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                <Folder size={18} /> Файлы репозитория
              </h3>
              
              <div style={{ fontSize: '13px', marginBottom: '10px', color: 'var(--text-muted)' }}>
                Путь: <span style={{ fontFamily: 'monospace', color: 'var(--text-main)' }}>/{currentPath || 'root'}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {currentPath && (
                  <div 
                    onClick={goBackFolder}
                    style={{ 
                      padding: '8px 10px', 
                      borderRadius: '6px', 
                      cursor: 'pointer', 
                      background: 'rgba(255,255,255,0.02)',
                      fontSize: '13px',
                      color: 'var(--primary)'
                    }}
                  >
                    📂 .. (Назад)
                  </div>
                )}

                {fileTree.map(node => (
                  <div 
                    key={node.id}
                    onClick={() => handleNodeClick(node)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '8px 10px', 
                      borderRadius: '6px', 
                      cursor: 'pointer', 
                      background: activeFile?.path === node.path ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                      border: activeFile?.path === node.path ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                      fontSize: '13px',
                      transition: 'background 0.2s'
                    }}
                    className="file-node-hover"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {node.type === 'tree' ? <Folder size={16} style={{ color: '#fbbf24' }} /> : <File size={16} style={{ color: 'var(--text-muted)' }} />}
                      <span>{node.name}</span>
                    </div>
                    <ChevronRight size={12} style={{ color: 'var(--text-dark)' }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Последние коммиты */}
            <div className="glass-panel" style={{ padding: '20px', maxHeight: '350px', overflowY: 'auto' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--secondary)' }}>
                <GitCommit size={18} /> Последние изменения
              </h3>

              {commits.length === 0 ? (
                <p style={{ color: 'var(--text-dark)', fontSize: '12px' }}>Коммиты не найдены.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {commits.map(commit => (
                    <div key={commit.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--secondary)', fontWeight: 'bold' }}>{commit.id}</span>
                        <span style={{ color: 'var(--text-dark)' }}>{new Date(commit.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: '500', marginBottom: '2px' }}>
                        {commit.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Автор: {commit.authorName}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Правая панель - Просмотр контента файла */}
          <div className="glass-panel" style={{ padding: '24px', minHeight: '500px' }}>
            {activeFile ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Code size={18} style={{ color: 'var(--primary)' }} /> {activeFile.name}
                    </h3>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{activeFile.path}</span>
                  </div>
                  
                  <button 
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                    onClick={() => {
                      navigator.clipboard.writeText(activeFile.path);
                      alert('Путь к файлу скопирован в буфер обмена!');
                    }}
                  >
                    Скопировать путь
                  </button>
                </div>

                {loadingFile ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, padding: '50px 0' }}>
                    <RefreshCw className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
                  </div>
                ) : (
                  <pre style={{ 
                    flex: 1, 
                    background: 'rgba(0,0,0,0.3)',
                    padding: '16px',
                    borderRadius: '8px',
                    overflowX: 'auto',
                    overflowY: 'auto',
                    maxHeight: '550px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    color: '#e2e8f0',
                    border: '1px solid rgba(255,255,255,0.05)',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {fileContent}
                  </pre>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '400px', color: 'var(--text-dark)' }}>
                <Code size={64} style={{ strokeWidth: 1, marginBottom: '16px' }} />
                <p>Выберите файл в левой панели для просмотра кода</p>
                <p style={{ fontSize: '11px', marginTop: '6px' }}>Вы можете копировать пути к файлам для использования их в описании JIRA задач.</p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
