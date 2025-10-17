import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { FileText, ClipboardCheck, Gear, Plus, Trash3, Folder, Database } from 'react-bootstrap-icons';
import Editor from './components/Editor';
import ClipboardPage from './components/ClipboardPage';
import WorkspacePage from './components/WorkspacePage';
import StoragePage from './components/StoragePage';
import Settings from './components/Settings';
import { getAllDocuments, initDB, deleteDocument, Document } from './utils/db';
import toast, { Toaster } from 'react-hot-toast';
import './App.css';

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

function AppContent() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('isDarkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [language, setLanguage] = useState<'ko' | 'en'>(() => {
    const saved = localStorage.getItem('language');
    return (saved === 'ko' || saved === 'en') ? saved : 'ko';
  });
  const editorRef = useRef<{ handleSave: () => void } | null>(null);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

    useEffect(() => {
    initDB();
    loadDocuments();
    // API 키 테스트 제거 - 실제 사용 시 에러 처리
  }, []); // language 의존성 제거 - API 테스트는 한 번만 실행

  useEffect(() => {
    if (id) {
      setSelectedDocumentId(id);
    } else if (window.location.pathname === '/documents') {
      setSelectedDocumentId(null);
    }
  }, [id]);

  useEffect(() => {
    document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Save theme preference to localStorage
  useEffect(() => {
    localStorage.setItem('isDarkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  // Save language preference to localStorage
  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const loadDocuments = async () => {
    const docs = await getAllDocuments();
    // Sort by updatedAt in descending order (most recent first)
    const sortedDocs = docs.sort((a, b) => {
      const dateA = new Date(a.updatedAt).getTime();
      const dateB = new Date(b.updatedAt).getTime();
      return dateB - dateA;
    });
    setDocuments(sortedDocs);
  };

  const handleSave = (doc: Document) => {
    loadDocuments(); // Refresh the list
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(language === 'ko' ? '정말로 이 문서를 삭제하시겠습니까?' : 'Are you sure you want to delete this document?')) {
      await deleteDocument(id);
      loadDocuments();
      if (selectedDocumentId === id) {
        setSelectedDocumentId(null);
      }
    }
  };

  const createNewDocument = () => {
    if (isDirty) {
      const save = window.confirm(language === 'ko' ? '저장되지 않은 변경사항이 있습니다. 새 문서를 만들기 전에 저장하시겠습니까?' : 'You have unsaved changes. Do you want to save before creating a new document?');
      if (save) {
        editorRef.current?.handleSave();
      }
    }
    setSelectedDocumentId(null);
    navigate('/documents');
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-content">
          <h1>{language === 'ko' ? 'AI 텍스트 편집기' : 'AI Text Editor'}</h1>
        </div>
      </header>
      <div className="main-layout">
        <aside className="sidebar">
          {/* Icon Navigation */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px',
            marginBottom: '24px',
            paddingBottom: '24px',
            borderBottom: '1px solid var(--border-color)'
          }}>
            <button
              onClick={() => navigate('/workspace')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                background: window.location.pathname === '/workspace' ? 'var(--primary-color)' : 'transparent',
                color: window.location.pathname === '/workspace' ? 'white' : 'var(--text-primary)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'var(--transition)',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                if (window.location.pathname !== '/workspace') {
                  e.currentTarget.style.background = 'var(--bg-secondary)';
                }
              }}
              onMouseLeave={(e) => {
                if (window.location.pathname !== '/workspace') {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <Folder size={18} />
              <span>{language === 'ko' ? '워크스페이스' : 'Workspace'}</span>
            </button>
            <button
              onClick={() => navigate('/documents')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                background: (window.location.pathname.startsWith('/documents') || window.location.pathname === '/') ? 'var(--primary-color)' : 'transparent',
                color: (window.location.pathname.startsWith('/documents') || window.location.pathname === '/') ? 'white' : 'var(--text-primary)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'var(--transition)',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                if (!(window.location.pathname.startsWith('/documents') || window.location.pathname === '/')) {
                  e.currentTarget.style.background = 'var(--bg-secondary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!(window.location.pathname.startsWith('/documents') || window.location.pathname === '/')) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <FileText size={18} />
              <span>{language === 'ko' ? '문서' : 'Documents'}</span>
            </button>
            <button
              onClick={() => navigate('/clipboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                background: window.location.pathname === '/clipboard' ? 'var(--primary-color)' : 'transparent',
                color: window.location.pathname === '/clipboard' ? 'white' : 'var(--text-primary)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'var(--transition)',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                if (window.location.pathname !== '/clipboard') {
                  e.currentTarget.style.background = 'var(--bg-secondary)';
                }
              }}
              onMouseLeave={(e) => {
                if (window.location.pathname !== '/clipboard') {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <ClipboardCheck size={18} />
              <span>{language === 'ko' ? '클립보드' : 'Clipboard'}</span>
            </button>
            <button
              onClick={() => navigate('/storage')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                background: window.location.pathname === '/storage' ? 'var(--primary-color)' : 'transparent',
                color: window.location.pathname === '/storage' ? 'white' : 'var(--text-primary)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'var(--transition)',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                if (window.location.pathname !== '/storage') {
                  e.currentTarget.style.background = 'var(--bg-secondary)';
                }
              }}
              onMouseLeave={(e) => {
                if (window.location.pathname !== '/storage') {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <Database size={18} />
              <span>{language === 'ko' ? '저장공간' : 'Storage'}</span>
            </button>
            <button
              onClick={() => navigate('/settings')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                background: window.location.pathname === '/settings' ? 'var(--primary-color)' : 'transparent',
                color: window.location.pathname === '/settings' ? 'white' : 'var(--text-primary)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'var(--transition)',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                if (window.location.pathname !== '/settings') {
                  e.currentTarget.style.background = 'var(--bg-secondary)';
                }
              }}
              onMouseLeave={(e) => {
                if (window.location.pathname !== '/settings') {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <Gear size={18} />
              <span>{language === 'ko' ? '환경설정' : 'Settings'}</span>
            </button>
          </div>
          {(window.location.pathname.startsWith('/documents') || window.location.pathname === '/') && (
            <div className="document-list">
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginBottom: '12px'
              }}>
                <h2 style={{ margin: '0', fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {language === 'ko' ? '최근 문서' : 'Recent Documents'}
                </h2>
                <button
                  onClick={createNewDocument}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    background: 'var(--primary-color)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'var(--transition)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  title={language === 'ko' ? '새 문서' : 'New Document'}
                >
                  <Plus size={16} />
                </button>
              </div>
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className={`document-item ${selectedDocumentId === doc.id ? 'selected' : ''}`}
                >
                  <div
                    onClick={() => {
                      setSelectedDocumentId(doc.id);
                      navigate(`/documents/${doc.id}`);
                    }}
                    style={{ flex: 1, cursor: 'pointer' }}
                  >
                    <div className="document-title">{doc.title}</div>
                    <div className="document-date">
                      {new Date(doc.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(doc.id);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '4px',
                      transition: 'var(--transition)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                    title={language === 'ko' ? '삭제' : 'Delete'}
                  >
                    <Trash3 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/workspace" replace />} />
            <Route path="/documents" element={<Editor ref={editorRef} documentId={selectedDocumentId || undefined} onSave={handleSave} onDirtyChange={setIsDirty} />} />
            <Route path="/documents/:id" element={<Editor ref={editorRef} documentId={selectedDocumentId || undefined} onSave={handleSave} onDirtyChange={setIsDirty} />} />
            <Route path="/clipboard" element={<ClipboardPage />} />
            <Route path="/storage" element={<StoragePage />} />
            <Route path="/workspace" element={<WorkspacePage onDocumentSelect={(id) => {
              if (id === 'new') {
                // 새 문서 만들기 로직
                setSelectedDocumentId(null);
                navigate('/documents');
              } else {
                setSelectedDocumentId(id);
                navigate(`/documents/${id}`);
              }
            }} />} />
            <Route path="/settings" element={
              <Settings
                isDarkMode={isDarkMode}
                onToggleTheme={toggleTheme}
                language={language}
                onLanguageChange={setLanguage}
              />
            } />
          </Routes>
        </main>
      </div>
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            boxShadow: 'var(--shadow-lg)'
          },
          success: {
            iconTheme: {
              primary: 'var(--primary-color)',
              secondary: 'white',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: 'white',
            },
          },
        }}
      />
    </div>
  );
}

export default App;
