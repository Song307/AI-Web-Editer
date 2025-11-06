import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Editor from './components/Editor';
import ClipboardPage from './components/UI/shared/ClipboardPage';
import WorkspacePage from './components/WorkspacePage';
import StoragePage from './components/StoragePage';
import Settings from './components/Settings';
import ImageEditor from './components/tools/ImageEditor';
import AISecretaryCreator from './components/AISecretaryCreator';
import AISecretaryManager from './components/AISecretaryManager';
import AIAssistantPage from './components/AIAssistantPage';
import Menubar from './components/layout/Menubar';
import Taskbar from './components/layout/Taskbar';
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('isSidebarOpen');
    return saved ? JSON.parse(saved) : true;
  });
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('isRightSidebarOpen');
    return saved ? JSON.parse(saved) : false;
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth');
    return saved ? parseInt(saved) : 320;
  });
  const [rightSidebarWidth, setRightSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('rightSidebarWidth');
    return saved ? parseInt(saved) : 320;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('isDarkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [language, setLanguage] = useState<'ko' | 'en'>(() => {
    const saved = localStorage.getItem('language');
    return (saved === 'ko' || saved === 'en') ? saved : 'ko';
  });
  const [selectionPreview, setSelectionPreview] = useState<string | null>(null);
  const [selectionRange, setSelectionRange] = useState<{ from: number; to: number } | null>(null);
  const editorRef = useRef<{ handleSave: () => void; saveEditorStateToCookie: () => void; replaceSelection: (text: string) => void; highlightSelection: (from: number, to: number) => void; clearHighlight: () => void } | null>(null);
  const navigate = useNavigate();

  // 사이드바 상태 변경 시 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('isSidebarOpen', JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  // 사이드바 너비 변경 시 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('sidebarWidth', sidebarWidth.toString());
  }, [sidebarWidth]);

  // 우측 사이드바 너비 변경 시 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('rightSidebarWidth', rightSidebarWidth.toString());
  }, [rightSidebarWidth]);

  // 우측 사이드바 상태 변경 시 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('isRightSidebarOpen', JSON.stringify(isRightSidebarOpen));
  }, [isRightSidebarOpen]);

    useEffect(() => {
    const initializeDB = async () => {
      try {
        await initDB();
        console.log('App: DB 초기화 성공');
        await loadDocuments();
      } catch (error) {
        console.error('App: DB 초기화 실패:', error);
        // 재시도
        try {
          console.log('App: DB 재초기화 시도');
          await initDB();
          await loadDocuments();
        } catch (retryError) {
          console.error('App: DB 재초기화도 실패:', retryError);
        }
      }
    };
    
    initializeDB();
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

  const clearSelection = () => {
    setSelectionPreview(null);
    setSelectionRange(null);
    // 하이라이트 제거
    if (editorRef.current) {
      editorRef.current.clearHighlight();
    }
  };

  const openTaskbar = () => {
    setIsRightSidebarOpen(true);
  };

  // 사이드바 리사이저 핸들러
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  // 우측 사이드바 리사이저 핸들러
  const handleRightMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingRight(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const minWidth = 200;
        const maxWidth = 600;
        const newWidth = e.clientX;

        if (newWidth >= minWidth && newWidth <= maxWidth) {
          setSidebarWidth(newWidth);
        }
      }

      if (isResizingRight) {
        const minWidth = 250;
        const maxWidth = 800;
        const newWidth = window.innerWidth - e.clientX;

        if (newWidth >= minWidth && newWidth <= maxWidth) {
          setRightSidebarWidth(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setIsResizingRight(false);
    };

    if (isResizing || isResizingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, isResizingRight]);

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
      
      {/* 우측 상단 고정 토글 버튼 */}
      {!isRightSidebarOpen && (
        <button
          onClick={() => setIsRightSidebarOpen(true)}
          className="fixed top-6 right-6 z-50 p-2 rounded-lg transition-colors"
          title="사이드바 열기"
        >
          <svg
            className="w-6 h-6 text-gray-700 dark:text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}
      
      <div 
        className="flex h-[calc(100vh-48px)] relative"
        style={{ 
          marginRight: isRightSidebarOpen ? `${rightSidebarWidth}px` : '0',
          transition: isResizing || isResizingRight ? 'none' : 'margin-right 300ms ease-in-out'
        }}
      >
        {/* 좌측 사이드바 */}
        <div 
          style={{ 
            width: isSidebarOpen ? `${sidebarWidth}px` : '80px',
            minWidth: isSidebarOpen ? '200px' : '80px',
            maxWidth: isSidebarOpen ? '600px' : '80px',
            transition: isResizing ? 'none' : 'width 300ms ease-in-out'
          }}
          className="flex-shrink-0"
        >
          <Menubar
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
            language={language}
            documents={documents}
            createNewDocument={createNewDocument}
            handleRenameStart={handleRenameStart}
            handleDelete={handleDelete}
            editorRef={editorRef}
          />
        </div>

        {/* 리사이저 */}
        {isSidebarOpen && (
          <div
            className="w-1 hover:w-2 bg-transparent hover:bg-blue-500 cursor-col-resize transition-all flex-shrink-0 relative group"
            onMouseDown={handleMouseDown}
          >
            <div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-1 h-12 bg-blue-500 rounded-full"></div>
            </div>
          </div>
        )}

        {/* 메인 컨텐츠 */}
        <div className="flex-1 min-w-0 ml-6">
          <main className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 backdrop-blur-xl overflow-y-auto h-full flex flex-col scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <Routes>
            <Route path="/" element={<Navigate to="/workspace" replace />} />
            <Route path="/documents" element={<Editor ref={editorRef} onSave={handleSave} onDirtyChange={setIsDirty} onSelectionPreviewChange={setSelectionPreview} onSelectionRangeChange={setSelectionRange} onOpenTaskbar={openTaskbar} />} />
            <Route path="/documents/:id" element={<Editor ref={editorRef} onSave={handleSave} onDirtyChange={setIsDirty} onSelectionPreviewChange={setSelectionPreview} onSelectionRangeChange={setSelectionRange} onOpenTaskbar={openTaskbar} />} />
            <Route path="/clipboard" element={<ClipboardPage />} />
            <Route path="/storage" element={<StoragePage />} />
            <Route path="/image-editor" element={<ImageEditor />} />
            <Route path="/ai-secretary" element={<AISecretaryManager />} />
            <Route path="/ai-secretary/create" element={<AISecretaryCreator />} />
            <Route path="/ai-assistant" element={<AIAssistantPage />} />
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
      </div>
      
      {/* 우측 사이드바 - 최상위 레벨 */}
      <Taskbar
        isRightSidebarOpen={isRightSidebarOpen}
        rightSidebarWidth={rightSidebarWidth}
        isResizingRight={isResizingRight}
        onClose={() => {
          setIsRightSidebarOpen(false);
          // Taskbar 닫을 때 하이라이트 제거
          if (editorRef.current) {
            editorRef.current.clearHighlight();
          }
        }}
        onMouseDown={handleRightMouseDown}
        selectionPreview={selectionPreview}
        selectionRange={selectionRange}
        onClearSelection={clearSelection}
        onReplaceSelection={(newText: string) => {
          if (editorRef.current) {
            editorRef.current.replaceSelection(newText);
          }
        }}
        onHighlightSelection={(from: number, to: number) => {
          if (editorRef.current) {
            editorRef.current.highlightSelection(from, to);
          }
        }}
        onClearHighlight={() => {
          if (editorRef.current) {
            editorRef.current.clearHighlight();
          }
        }}
      />
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
