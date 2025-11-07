import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Workspace from './components/Workspace';
import ClipboardPage from './components/ui/shared/ClipboardPage';
import StoragePage from './components/StoragePage';
import Settings from './components/Settings';
import ImageEditor from './components/tools/ImageEditor';
import AISecretaryCreator from './components/AISecretaryCreator';
import AISecretaryManager from './components/AISecretaryManager';
import AIAssistantPage from './components/AIAssistantPage';
import Taskbar from './components/layout/Taskbar';
import Menubar from './components/layout/Menubar';
import { initDB } from './utils/db';
import { Toaster } from 'react-hot-toast';
import LandingPage from './components/LandingPage';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/*" element={<AppContent />} />
      </Routes>
    </Router>
  );
}

function AppContent() {
  const [isMenubarHidden, setIsMenubarHidden] = useState(() => {
    const saved = localStorage.getItem('isMenubarHidden');
    return saved ? JSON.parse(saved) : false;
  });
  const [isMenubarHoveredWhileHidden, setIsMenubarHoveredWhileHidden] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('isRightSidebarOpen');
    return saved ? JSON.parse(saved) : false;
  });
  const [rightSidebarWidth, setRightSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('rightSidebarWidth');
    return saved ? parseInt(saved) : 320;
  });
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('isDarkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [language, setLanguage] = useState<'ko' | 'en'>(() => {
    const saved = localStorage.getItem('language');
    return (saved === 'ko' || saved === 'en') ? saved : 'ko';
  });
  const [isCompactLayout, setIsCompactLayout] = useState(() => {
    const saved = localStorage.getItem('isCompactLayout');
    return saved ? JSON.parse(saved) : true; // 기본값: 컴팩트(여백 없음)
  });
  const [selectionPreview, setSelectionPreview] = useState<string | null>(null);
  const [selectionRange, setSelectionRange] = useState<{ from: number; to: number } | null>(null);

  // 메뉴바 숨김 상태 동기화
  useEffect(() => {
    const handleMenubarHiddenChange = () => {
      const saved = localStorage.getItem('isMenubarHidden');
      if (saved) {
        setIsMenubarHidden(JSON.parse(saved));
      }
    };

    window.addEventListener('storage', handleMenubarHiddenChange);
    // 초기 상태 체크
    const interval = setInterval(() => {
      const saved = localStorage.getItem('isMenubarHidden');
      if (saved) {
        const newValue = JSON.parse(saved);
        if (newValue !== isMenubarHidden) {
          setIsMenubarHidden(newValue);
        }
      }
    }, 100);

    return () => {
      window.removeEventListener('storage', handleMenubarHiddenChange);
      clearInterval(interval);
    };
  }, [isMenubarHidden]);

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
      } catch (error) {
        console.error('App: DB 초기화 실패:', error);
        // 재시도
        try {
          console.log('App: DB 재초기화 시도');
          await initDB();
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

  // Save layout preference to localStorage
  useEffect(() => {
    localStorage.setItem('isCompactLayout', JSON.stringify(isCompactLayout));
  }, [isCompactLayout]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const toggleLayout = () => {
    setIsCompactLayout(!isCompactLayout);
  };

  const clearSelection = () => {
    setSelectionPreview(null);
    setSelectionRange(null);
  };

  const openTaskbar = () => {
    setIsRightSidebarOpen(true);
  };

  // 우측 사이드바 리사이저 핸들러
  const handleRightMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingRight(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
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
      setIsResizingRight(false);
    };

    if (isResizingRight) {
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
  }, [isResizingRight]);

  return (
    <div className={`flex h-screen bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 transition-colors ${isCompactLayout ? '' : 'p-4 gap-4'}`}>
      
      {/* 좌측 메뉴바 */}
      <Menubar 
        isDarkMode={isDarkMode}
        language={language}
        isCompactLayout={isCompactLayout}
        onHoverChange={setIsMenubarHoveredWhileHidden}
      />
      
      {/* 우측 상단 고정 토글 버튼 */}
      {!isRightSidebarOpen && (
        <button
          onClick={() => setIsRightSidebarOpen(true)}
          className="fixed top-6 right-6 z-50 p-2 rounded-lg bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all"
          title="AI 채팅 열기"
        >
          <svg
            className="w-6 h-6 text-gray-700 dark:text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
      )}
      
      {/* 메인 컨텐츠 영역 */}
      <div 
        className="flex-1 flex flex-col overflow-hidden transition-all duration-300"
        style={{ 
          marginLeft: (isMenubarHidden && !isMenubarHoveredWhileHidden) ? '0' : '80px',
          marginRight: isRightSidebarOpen ? `${rightSidebarWidth}px` : '0',
          transition: 'margin 300ms ease-in-out'
        }}
      >
        {/* 메인 컨텐츠 */}
        <main className="flex-1 overflow-hidden">
          <div className="h-full bg-white dark:bg-gray-900 overflow-hidden">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard isDarkMode={isDarkMode} />} />
              <Route path="/workspace" element={<Workspace isDarkMode={isDarkMode} onSelectionPreviewChange={setSelectionPreview} onSelectionRangeChange={setSelectionRange} onOpenTaskbar={() => setIsRightSidebarOpen(true)} />} />
              <Route path="/workspace/:id" element={<Workspace isDarkMode={isDarkMode} onSelectionPreviewChange={setSelectionPreview} onSelectionRangeChange={setSelectionRange} onOpenTaskbar={() => setIsRightSidebarOpen(true)} />} />
              <Route path="/clipboard" element={<ClipboardPage />} />
              <Route path="/storage" element={<StoragePage />} />
              <Route 
                path="/settings" 
                element={
                  <Settings 
                    isDarkMode={isDarkMode} 
                    onToggleTheme={toggleTheme}
                    language={language}
                    onLanguageChange={setLanguage}
                    isMenubarHidden={isMenubarHidden}
                    onToggleMenubar={() => setIsMenubarHidden(!isMenubarHidden)}
                    isCompactLayout={isMenubarHidden}
                    onToggleLayout={toggleLayout}
                  />
                } 
              />
              <Route path="/image-editor" element={<ImageEditor />} />
              <Route path="/ai-secretary" element={<AISecretaryManager />} />
              <Route path="/ai-secretary/create" element={<AISecretaryCreator />} />
              <Route path="/ai-assistant" element={<AIAssistantPage />} />
            </Routes>
          </div>
        </main>
      </div>
      
      {/* 우측 사이드바 - 최상위 레벨 */}
      <Taskbar
        isRightSidebarOpen={isRightSidebarOpen}
        rightSidebarWidth={rightSidebarWidth}
        isResizingRight={isResizingRight}
        onClose={() => {
          setIsRightSidebarOpen(false);
        }}
        onMouseDown={handleRightMouseDown}
        selectionPreview={selectionPreview}
        selectionRange={selectionRange}
        onClearSelection={clearSelection}
        onReplaceSelection={(newText: string) => {
          // Replace selection will be handled by Workspace
        }}
        onHighlightSelection={(from: number, to: number) => {
          // Highlight will be handled by Workspace
        }}
        onClearHighlight={() => {
          // Clear highlight will be handled by Workspace
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
