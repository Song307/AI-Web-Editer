import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { FileText, ClipboardCheck, Gear, Plus, Trash3, Folder, Database, Palette } from 'react-bootstrap-icons';
import Editor from './components/Editor';
import ClipboardPage from './components/ClipboardPage';
import WorkspacePage from './components/WorkspacePage';
import StoragePage from './components/StoragePage';
import Settings from './components/Settings';
import ImageEditor from './components/ImageEditor';
import { getAllDocuments, initDB, deleteDocument, Document } from './utils/db';
import { Toaster } from 'react-hot-toast';
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
    document.documentElement.classList.toggle('dark', isDarkMode);
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
    <div className="min-h-screen p-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 transition-colors">
      <header className="text-center mb-8 text-gray-900 dark:text-gray-100 relative z-10">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <h1 className="text-5xl font-extrabold m-0 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-400 tracking-tight">
            {language === 'ko' ? 'AI 워크스페이스' : 'AI Workspace'}
          </h1>
        </div>
      </header>
      <div className="grid grid-cols-[320px_1fr] gap-6 h-[calc(100vh-140px)]">
        <aside className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 flex flex-col border border-gray-200 dark:border-gray-700 backdrop-blur-xl overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          {/* Icon Navigation */}
          <div className="flex flex-col gap-2 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => navigate('/workspace')}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium text-left rounded-lg cursor-pointer transition-all duration-300 ${
                window.location.pathname === '/workspace'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Folder size={18} />
              <span>{language === 'ko' ? '워크스페이스' : 'Workspace'}</span>
            </button>
            <button
              onClick={() => navigate('/documents')}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium text-left rounded-lg cursor-pointer transition-all duration-300 ${
                (window.location.pathname.startsWith('/documents') || window.location.pathname === '/')
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <FileText size={18} />
              <span>{language === 'ko' ? '문서' : 'Documents'}</span>
            </button>
            <button
              onClick={() => navigate('/clipboard')}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium text-left rounded-lg cursor-pointer transition-all duration-300 ${
                window.location.pathname === '/clipboard'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <ClipboardCheck size={18} />
              <span>{language === 'ko' ? '클립보드' : 'Clipboard'}</span>
            </button>
            <button
              onClick={() => navigate('/storage')}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium text-left rounded-lg cursor-pointer transition-all duration-300 ${
                window.location.pathname === '/storage'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Database size={18} />
              <span>{language === 'ko' ? '저장공간' : 'Storage'}</span>
            </button>
            <button
              onClick={() => navigate('/image-editor')}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium text-left rounded-lg cursor-pointer transition-all duration-300 ${
                window.location.pathname === '/image-editor'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Palette size={18} />
              <span>{language === 'ko' ? '이미지 편집기' : 'Image Editor'}</span>
            </button>
            <button
              onClick={() => navigate('/settings')}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium text-left rounded-lg cursor-pointer transition-all duration-300 ${
                window.location.pathname === '/settings'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Gear size={18} />
              <span>{language === 'ko' ? '환경설정' : 'Settings'}</span>
            </button>
          </div>
          {(window.location.pathname.startsWith('/documents') || window.location.pathname === '/') && (
            <div className="document-list">
              <div className="flex items-center justify-between mb-3">
                <h2 className="m-0 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  {language === 'ko' ? '최근 문서' : 'Recent Documents'}
                </h2>
                <button
                  onClick={createNewDocument}
                  className="flex items-center justify-center w-7 h-7 bg-indigo-600 text-white border-none rounded cursor-pointer transition-transform hover:scale-110"
                  title={language === 'ko' ? '새 문서' : 'New Document'}
                >
                  <Plus size={16} />
                </button>
              </div>
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className={`p-4 border rounded-lg mb-3 cursor-pointer transition-all duration-300 bg-white dark:bg-gray-800 flex justify-between items-start ${
                    selectedDocumentId === doc.id
                      ? 'border-indigo-500 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 shadow-lg ring-2 ring-indigo-100 dark:ring-indigo-900/50'
                      : 'border-gray-200 dark:border-gray-700 hover:border-indigo-500 hover:shadow-md hover:transform hover:-translate-y-0.5'
                  }`}
                >
                  <div
                    onClick={() => {
                      setSelectedDocumentId(doc.id);
                      navigate(`/documents/${doc.id}`);
                    }}
                    style={{ flex: 1, cursor: 'pointer' }}
                  >
                    <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-1">{doc.title}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {new Date(doc.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(doc.id);
                    }}
                    className="flex items-center justify-center bg-transparent border-none text-gray-600 dark:text-gray-400 cursor-pointer p-1 rounded transition-colors hover:text-red-500"
                    title={language === 'ko' ? '삭제' : 'Delete'}
                  >
                    <Trash3 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>
        <main className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 backdrop-blur-xl overflow-y-auto flex flex-col scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <Routes>
            <Route path="/" element={<Navigate to="/workspace" replace />} />
            <Route path="/documents" element={<Editor ref={editorRef} documentId={selectedDocumentId || undefined} onSave={handleSave} onDirtyChange={setIsDirty} />} />
            <Route path="/documents/:id" element={<Editor ref={editorRef} documentId={selectedDocumentId || undefined} onSave={handleSave} onDirtyChange={setIsDirty} />} />
            <Route path="/clipboard" element={<ClipboardPage />} />
            <Route path="/storage" element={<StoragePage />} />
            <Route path="/image-editor" element={<ImageEditor />} />
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
            background: isDarkMode ? '#1f2937' : '#ffffff',
            color: isDarkMode ? '#f3f4f6' : '#111827',
            border: `1px solid ${isDarkMode ? '#374151' : '#d1d5db'}`,
            borderRadius: '8px',
            boxShadow: isDarkMode
              ? '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)'
              : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
          },
          success: {
            iconTheme: {
              primary: '#10b981',
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
