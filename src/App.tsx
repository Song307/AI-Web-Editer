import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Editor from './components/Editor';
import ClipboardPage from './components/UI/shared/ClipboardPage';
import WorkspacePage from './components/WorkspacePage';
import StoragePage from './components/StoragePage';
import Settings from './components/Settings';
import ImageEditor from './components/tools/ImageEditor';
import Sidebar from './components/layout/Sidebar';
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
  const [isDirty, setIsDirty] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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

    useEffect(() => {
    initDB();
    loadDocuments();
    // API 키 테스트 제거 - 실제 사용 시 에러 처리
  }, []); // language 의존성 제거 - API 테스트는 한 번만 실행

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
    }
  };

  const handleRenameStart = (doc: Document) => {
    // 문서 이름 변경 로직은 WorkspacePage에서 처리하므로 여기서는 빈 함수로 정의
    console.log('Rename document:', doc);
  };

    const createNewDocument = () => {
    if (isDirty) {
      const save = window.confirm(language === 'ko' ? '저장되지 않은 변경사항이 있습니다. 새 문서를 만들기 전에 저장하시겠습니까?' : 'You have unsaved changes. Do you want to save before creating a new document?');
      if (save) {
        editorRef.current?.handleSave();
      }
    }
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
      <div className={`grid gap-6 h-[calc(100vh-140px)] transition-all duration-300 ${
        isSidebarOpen ? 'grid-cols-[320px_1fr]' : 'grid-cols-[80px_1fr]'
      }`}>
        <Sidebar
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          language={language}
          documents={documents}
          createNewDocument={createNewDocument}
          handleRenameStart={handleRenameStart}
          handleDelete={handleDelete}
        />

        <main className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 backdrop-blur-xl overflow-y-auto flex flex-col scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <Routes>
            <Route path="/" element={<Navigate to="/workspace" replace />} />
            <Route path="/documents" element={<Editor ref={editorRef} onSave={handleSave} onDirtyChange={setIsDirty} />} />
            <Route path="/documents/:id" element={<Editor ref={editorRef} onSave={handleSave} onDirtyChange={setIsDirty} />} />
            <Route path="/clipboard" element={<ClipboardPage />} />
            <Route path="/storage" element={<StoragePage />} />
            <Route path="/image-editor" element={<ImageEditor />} />
            <Route path="/workspace" element={<WorkspacePage onDocumentSelect={(id) => {
              if (id === 'new') {
                // 새 문서 만들기 로직
                navigate('/documents');
              } else {
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
