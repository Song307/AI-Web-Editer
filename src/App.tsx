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
import toast from 'react-hot-toast';
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
  const [isMenubarVisible, setIsMenubarVisible] = useState(() => {
    const saved = localStorage.getItem('isMenubarHidden');
    const hidden = saved ? JSON.parse(saved) : false;
    return !hidden;
  });
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
  const [isFocusMode, setIsFocusMode] = useState(() => {
    const saved = localStorage.getItem('isFocusMode');
    return saved ? JSON.parse(saved) : false;
  });

  const [isTypewriterMode, setIsTypewriterMode] = useState(() => {
    const saved = localStorage.getItem('isTypewriterMode');
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
  const workspaceApiRef = React.useRef<{
    replaceSelection?: (text: string) => void;
    highlightSelection?: (from: number, to: number) => void;
    clearHighlight?: () => void;
    collapseSelection?: () => void;
    focus?: (opts?: any) => void;
  } | null>(null);

  // Tab API ref for focusing/opening tabs from Taskbar
  const tabApiRef = React.useRef<{ setActiveTabByTitle?: (title: string) => void; setActiveTabId?: (id: string | null) => void } | null>(null);

  const onRegisterTabApi = React.useCallback((api: typeof tabApiRef.current) => {
    console.log('App: onRegisterTabApi called', api);
    tabApiRef.current = api;
  }, []);

  const focusDocumentByName = React.useCallback((name: string | undefined | null) => {
    if (!name) return;
    try {
      if (tabApiRef.current?.setActiveTabByTitle) {
        tabApiRef.current.setActiveTabByTitle(name);
      } else if (tabApiRef.current?.setActiveTabId) {
        // no-op: cannot find by id from name
      }
    } catch (e) {
      console.error('App: focusDocumentByName failed', e);
    }
  }, []);

  // If Taskbar requests a replacement while the editor API isn't ready,
  // store it here and apply when the API becomes available.
  const pendingReplacementRef = React.useRef<string | null>(null);

  const onRegisterApi = React.useCallback((api: typeof workspaceApiRef.current) => {
    console.log('App: onRegisterApi called', api);
    workspaceApiRef.current = api;
    // If there is a pending replacement request, apply it now.
    if (pendingReplacementRef.current && workspaceApiRef.current?.replaceSelection) {
      try {
        workspaceApiRef.current.replaceSelection(pendingReplacementRef.current);
        toast.success('대기 중이던 제안사항이 문서에 적용되었습니다.');
      } catch (e) {
        console.error('App: failed to apply pending replacement', e);
        toast.error('대기 중이던 제안사항 적용에 실패했습니다.');
      }
      pendingReplacementRef.current = null;
    }
  }, []);

  const onSelectionPreviewChange = React.useCallback((preview: string | null) => {
    setSelectionPreview(preview);
  }, []);

  const onSelectionRangeChange = React.useCallback((range: { from: number; to: number } | null) => {
    setSelectionRange(range);
  }, []);

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

  // Keep menubarVisible in sync with hidden/hover state in case other tabs change localStorage
  useEffect(() => {
    setIsMenubarVisible(!isMenubarHidden || isMenubarHoveredWhileHidden);
  }, [isMenubarHidden, isMenubarHoveredWhileHidden]);

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
      } catch (error) {
        console.error('App: DB 초기화 실패:', error);
        // 재시도
        try {
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

  // Save focus/typewriter preferences
  useEffect(() => {
    localStorage.setItem('isFocusMode', JSON.stringify(isFocusMode));
  }, [isFocusMode]);

  useEffect(() => {
    localStorage.setItem('isTypewriterMode', JSON.stringify(isTypewriterMode));
  }, [isTypewriterMode]);

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

  const toggleFocusMode = () => setIsFocusMode((v: boolean) => !v);
  const toggleTypewriterMode = () => setIsTypewriterMode((v: boolean) => !v);

  const clearSelection = () => {
    setSelectionPreview(null);
    setSelectionRange(null);
  };

  const openTaskbar = () => {
    setIsRightSidebarOpen(true);
    // After opening the taskbar, restore focus back to the editor so the
    // browser doesn't clear the user's selection. Use a short timeout so the
    // sidebar render completes first.
    setTimeout(() => {
      try {
        workspaceApiRef.current?.focus?.();
      } catch (e) {
        console.warn('App: failed to restore editor focus after opening taskbar', e);
      }
    }, 0);
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
        onVisibleChange={setIsMenubarVisible}
      />
      
      {/* 우측 상단 고정 토글 버튼 */}
      {!isRightSidebarOpen && (
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={openTaskbar}
          className="fixed top-6 right-10 z-50 p-1 bg-transparent hover:bg-transparent transition-none"
          title="AI 채팅 열기"
          aria-label="Open AI chat"
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
          // When not compact layout we inset the menubar by 16px; account for that in main content margin
          marginLeft: isMenubarVisible ? (isCompactLayout ? '80px' : '96px') : '0',
          marginRight: isRightSidebarOpen ? `${rightSidebarWidth}px` : '0',
          transition: 'margin 300ms ease-in-out'
        }}
      >
        {/* 메인 컨텐츠 */}
        <main className="flex-1 overflow-hidden">
          <div className={`h-full bg-white dark:bg-gray-900 overflow-hidden transition-shadow duration-300 ${isCompactLayout ? '' : 'rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/5 z-40'}`}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard isDarkMode={isDarkMode} />} />
              <Route
                path="/workspace"
                element={
                  <Workspace
                    isDarkMode={isDarkMode}
                    isFocusMode={isFocusMode}
                    isTypewriterMode={isTypewriterMode}
                    onSelectionPreviewChange={onSelectionPreviewChange}
                    onSelectionRangeChange={onSelectionRangeChange}
                    onOpenTaskbar={openTaskbar}
                    onRegisterApi={onRegisterApi}
                    onRegisterTabApi={onRegisterTabApi}
                    isRightSidebarOpen={isRightSidebarOpen}
                    rightSidebarWidth={rightSidebarWidth}
                  />
                }
              />
              <Route
                path="/workspace/upload"
                element={
                  <Workspace
                    isDarkMode={isDarkMode}
                    isFocusMode={isFocusMode}
                    isTypewriterMode={isTypewriterMode}
                    onSelectionPreviewChange={onSelectionPreviewChange}
                    onSelectionRangeChange={onSelectionRangeChange}
                    onOpenTaskbar={openTaskbar}
                    onRegisterApi={onRegisterApi}
                    onRegisterTabApi={onRegisterTabApi}
                    isRightSidebarOpen={isRightSidebarOpen}
                    rightSidebarWidth={rightSidebarWidth}
                  />
                }
              />
              <Route
                path="/workspace/:id"
                element={
                  <Workspace
                    isDarkMode={isDarkMode}
                    isFocusMode={isFocusMode}
                    isTypewriterMode={isTypewriterMode}
                    onSelectionPreviewChange={onSelectionPreviewChange}
                    onSelectionRangeChange={onSelectionRangeChange}
                    onOpenTaskbar={openTaskbar}
                    onRegisterApi={onRegisterApi}
                    onRegisterTabApi={onRegisterTabApi}
                    isRightSidebarOpen={isRightSidebarOpen}
                    rightSidebarWidth={rightSidebarWidth}
                  />
                }
              />
              <Route
                path="/documents"
                element={
                  <Workspace
                    isDarkMode={isDarkMode}
                    isFocusMode={isFocusMode}
                    isTypewriterMode={isTypewriterMode}
                    onSelectionPreviewChange={onSelectionPreviewChange}
                    onSelectionRangeChange={onSelectionRangeChange}
                    onOpenTaskbar={openTaskbar}
                    onRegisterApi={onRegisterApi}
                    onRegisterTabApi={onRegisterTabApi}
                    isRightSidebarOpen={isRightSidebarOpen}
                    rightSidebarWidth={rightSidebarWidth}
                  />
                }
              />
              <Route
                path="/documents/:id"
                element={
                  <Workspace
                    isDarkMode={isDarkMode}
                    isFocusMode={isFocusMode}
                    isTypewriterMode={isTypewriterMode}
                    onSelectionPreviewChange={onSelectionPreviewChange}
                    onSelectionRangeChange={onSelectionRangeChange}
                    onOpenTaskbar={openTaskbar}
                    onRegisterApi={onRegisterApi}
                    onRegisterTabApi={onRegisterTabApi}
                    isRightSidebarOpen={isRightSidebarOpen}
                    rightSidebarWidth={rightSidebarWidth}
                  />
                }
              />
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
                    isFocusMode={isFocusMode}
                    isTypewriterMode={isTypewriterMode}
                    onToggleFocusMode={toggleFocusMode}
                    onToggleTypewriterMode={toggleTypewriterMode}
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
        onClearSelection={() => {
          // Non-destructive clear: collapse editor selection and clear UI highlight
          console.log('App: onClearSelection called, workspaceApiRef =', workspaceApiRef.current);
          try {
            // Ask editor to collapse its selection (no deletion) if available
            if (workspaceApiRef.current?.collapseSelection) {
              workspaceApiRef.current.collapseSelection();
              console.log('App: collapseSelection called on editor');
            }
          } catch (e) {
            console.warn('App: collapseSelection call failed', e);
          }
          // Clear App-level preview state and editor highlight
          clearSelection();
          try {
            workspaceApiRef.current?.clearHighlight?.();
            console.log('App: clearHighlight called successfully');
          } catch (e) {
            console.error('App: clearHighlight call failed', e);
          }
        }}
        onReplaceSelection={(newText: string) => {
          console.log('App: onReplaceSelection called, workspaceApiRef =', workspaceApiRef.current, 'newText=', newText);
          // Ask the workspace/editor to replace the selected text. If the
          // editor API is not yet available, queue the replacement and notify
          // the user.
          if (workspaceApiRef.current && workspaceApiRef.current.replaceSelection) {
            try {
              workspaceApiRef.current.replaceSelection(newText);
            } catch (e) {
              console.error('App: replaceSelection call failed', e);
              toast.error('텍스트 적용에 실패했습니다. 콘솔을 확인하세요.');
            }
          } else {
            console.warn('App: replaceSelection called but editor API not ready; queuing replacement');
            pendingReplacementRef.current = newText;
            toast('편집기가 준비되지 않았습니다. 열려있는 문서에 제안사항을 적용하면 자동으로 반영됩니다.');
          }
          // Clear selection state in App and hide highlight
          clearSelection();
          try {
            workspaceApiRef.current?.clearHighlight?.();
          } catch (e) {
            console.error('App: clearHighlight call failed', e);
          }
        }}
        onHighlightSelection={(from: number, to: number) => {
          console.log('App: onHighlightSelection called', { from, to, api: workspaceApiRef.current });
          try {
            workspaceApiRef.current?.highlightSelection?.(from, to);
          } catch (e) {
            console.error('App: highlightSelection call failed', e);
          }
        }}
        onClearHighlight={() => {
          workspaceApiRef.current?.clearHighlight?.();
        }}
        onFocusDocument={(name: string | undefined | null) => focusDocumentByName(name)}
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
