import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { House, Plus, X, FileText, Image as ImageIcon, FileEarmarkPdf } from 'react-bootstrap-icons';
import Editor from './Editor';
import TabHeader from './Editor/TabHeader';
import ImageViewer from './tools/ImageViewer';
import PDFViewer from './tools/PDFViewer';
import { getDocument } from '../utils/db';
import toast from 'react-hot-toast';

interface Tab {
  id: string;
  title: string;
  type: 'document' | 'image' | 'pdf' | 'video';
  documentId?: string;
  content?: any;
}

interface WorkspaceProps {
  isDarkMode: boolean;
  onSelectionPreviewChange?: (preview: string | null) => void;
  onSelectionRangeChange?: (range: { from: number; to: number } | null) => void;
  onOpenTaskbar?: () => void;
}

const Workspace: React.FC<WorkspaceProps> = ({
  isDarkMode,
  onSelectionPreviewChange,
  onSelectionRangeChange,
  onOpenTaskbar,
}) => {
  // taskList: canonical list of workspace tasks (persisted to cookie)
  const [taskList, setTaskList] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  // Keep a ref to the latest taskList so unmount cleanup can log the current value
  type TaskListRefType = Tab[];
  const taskListRef = React.useRef<TaskListRefType | null>(null as any);
  React.useEffect(() => {
    taskListRef.current = taskList;
  }, [taskList]);
  // Guard set for documentIds currently being loaded to avoid duplicate load flows
  const loadingIdsRef = useRef<Set<string>>(new Set());
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // Quick mount log to help debug blank screen when DevTools console is empty
  // Log on initial mount so we always get a trace when Workspace mounts
  useEffect(() => {
    const debugFlag = new URLSearchParams(window.location.search).get('debug');
    try {
      console.groupCollapsed(`[Workspace] mounted — pathname=${window.location.pathname} debug=${debugFlag}`);
      console.log('taskList (snapshot):', taskList);
      console.log('activeTabId (snapshot):', activeTabId);
      console.log('url id param:', id);
      console.groupEnd();
    } catch (err) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When Workspace unmounts (for example navigating to /dashboard), log the latest taskList
  useEffect(() => {
    return () => {
      try {
        console.groupCollapsed(`[Workspace] unmounting — logging final taskList (likely navigation away)`);
        console.log('final taskList (snapshot):', taskListRef.current || []);
        console.log('current pathname at unmount:', window.location.pathname);
        console.groupEnd();
      } catch (err) {}
    };
    // run once on mount to register cleanup on unmount
  }, []);

  // Also log whenever the route id param changes (entering a specific document)
  useEffect(() => {
    try {
      console.groupCollapsed(`[Workspace] route id changed -> id=${id} pathname=${window.location.pathname}`);
      console.log('taskList length:', taskList.length);
      console.log('taskList ids:', taskList.map(t => t.id));
      console.groupEnd();
    } catch (err) {}
    // only run when `id` changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    // URL에서 문서 ID를 받아서 탭 열기
    if (id && id !== 'new') {
      loadDocument(id);
    } else if (id === 'new') {
      // 새 파일 생성 모달 표시
      setShowNewFileModal(true);
    }
  }, [id]);

  // If route id changes (or taskList changes), ensure the tab with the matching documentId becomes active
  useEffect(() => {
    if (!id || id === 'new') return;
    try {
      const matched = taskList.find(t => String(t.documentId) === String(id));
      if (matched) {
        // Activate the matched tab instead of defaulting to the first tab
        if (activeTabId !== matched.id) {
          setActiveTabId(matched.id);
        }

        // If the matched tab has no content (restored from cookie), load it
        if (!matched.content) {
          loadDocument(String(id));
        }
      }
    } catch (err) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, taskList]);

  const loadDocument = async (docId: string) => {
    // avoid duplicate concurrent loads for same id
    if (loadingIdsRef.current.has(docId)) {
      console.log(`[Workspace] loadDocument skipped (already loading) -> docId=${docId}`);
      return;
    }

    loadingIdsRef.current.add(docId);

    try {
      console.groupCollapsed(`[Workspace] loadDocument called -> docId=${docId}`);
      const doc = await getDocument(docId);
      console.log('getDocument result:', doc);

      if (doc) {
        // Use functional update to avoid race/stale state that caused duplicate tabs
        let existingId: string | null = null;
        let createdId: string | null = null;

        setTaskList(prev => {
          const existing = prev.find(task => String(task.documentId) === String(docId));
          if (existing) {
            existingId = existing.id;
            // update the existing task's content/title so the Editor receives the content
            return prev.map(t => t.id === existing.id ? { ...t, content: doc, title: doc.title || t.title } : t);
          }

          // create new task only if not present
          createdId = `doc-${docId}-${Date.now()}`;
          const newTask: Tab = {
            id: createdId,
            title: doc.title,
            type: 'document',
            documentId: docId,
            content: doc
          };
          const next = [...prev, newTask];
          console.log('taskList after push (preview):', next.map(t => ({ id: t.id, documentId: t.documentId, title: t.title })));
          return next;
        });

        if (existingId) {
          setActiveTabId(existingId);
          console.log('Activated existing tab:', existingId);
        } else if (createdId) {
          setActiveTabId(createdId);
          console.log('Created and activated new tab:', createdId);
        }
      } else {
        console.warn(`[Workspace] getDocument returned null for id=${docId}`);
      }
      console.groupEnd();
    } catch (error) {
      console.error('Failed to load document:', error);
      toast.error('문서를 불러올 수 없습니다.');
    } finally {
      loadingIdsRef.current.delete(docId);
    }
  };

  const handleHomeClick = () => {
    navigate('/dashboard');
  };

  const handleNewFileClick = () => {
    setShowNewFileModal(true);
  };

  const handleCloseTab = (tabId: string) => {
    const tabIndex = taskList.findIndex(tab => tab.id === tabId);
    const newTasks = taskList.filter(tab => tab.id !== tabId);
    setTaskList(newTasks);

    // 닫은 탭이 활성 탭이었다면 다른 탭 활성화
    if (activeTabId === tabId && newTasks.length > 0) {
      if (tabIndex > 0) {
        setActiveTabId(newTasks[tabIndex - 1].id);
      } else {
        setActiveTabId(newTasks[0].id);
      }
    } else if (newTasks.length === 0) {
      setActiveTabId(null);
      // 탭이 없으면 대시보드로 이동
      navigate('/dashboard');
    }
  };

  // Drag-reorder handlers for TabHeader
  const handleDragStart = (id: string) => {
    setDraggedTaskId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (!draggedTaskId || draggedTaskId === id) return;
    setTaskList(prev => {
      const draggedItem = prev.find(t => t.id === draggedTaskId);
      if (!draggedItem) return prev;
      const without = prev.filter(t => t.id !== draggedTaskId);
      const idx = without.findIndex(t => t.id === id);
      if (idx === -1) return prev;
      return [...without.slice(0, idx), draggedItem, ...without.slice(idx)];
    });
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
  };

  // When a tab is clicked, navigate to the corresponding document page (or workspace route for unsaved/new tabs)
  const handleTabClick = (tabId: string) => {
    const tab = taskList.find(t => t.id === tabId);
    if (!tab) return;
    // Activate the tab in the SSoT
    setActiveTabId(tabId);

    // If this tab is backed by a persisted document, navigate to /documents/:id
    if (tab.documentId) {
      navigate(`/documents/${tab.documentId}`);
      return;
    }

    // Otherwise, navigate to workspace route for this tab (keeps URL in sync)
    navigate(`/workspace/${tabId}`);
  };

  const handleCreateFile = (fileType: 'document' | 'image' | 'pdf') => {
    const newTab: Tab = {
      id: `new-${fileType}-${Date.now()}`,
      title: `새 ${fileType === 'document' ? '문서' : fileType === 'image' ? '이미지' : 'PDF'}`,
      type: fileType
    };
    setTaskList(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setShowNewFileModal(false);
  };

  const getTabIcon = (type: string) => {
    switch (type) {
      case 'document':
        return <FileText size={14} />;
      case 'image':
        return <ImageIcon size={14} />;
      case 'pdf':
        return <FileEarmarkPdf size={14} />;
      default:
        return <FileText size={14} />;
    }
  };

  const activeTab = taskList.find(tab => tab.id === activeTabId);

  // 렌더 시 로그는 제거하여 콘솔 노이즈를 줄임

  // Map workspace tabs to the shape Editor expects (DocumentTab-like)
  // Map taskList to the shape Editor expects (DocumentTab-like)
  const editorTabs = taskList.map(t => ({
    id: t.id,
    title: t.title,
    content: typeof t.content === 'string' ? t.content : (t.content?.content ?? ''),
    isActive: t.id === activeTabId,
    documentId: t.documentId ? String(t.documentId) : undefined,
  }));

  // Adapter to accept Editor's setTabs updates and map them back to workspace tabs
  // Adapter to accept Editor's setTabs updates and map them back to taskList
  const setTabsFromEditor = (updater: React.SetStateAction<any[]>) => {
    const current = editorTabs;
    const updated = typeof updater === 'function' ? (updater as (prev: any[]) => any[])(current) : updater;

    // Map updated editor tabs back into taskList shape
    const mapped = updated.map((et: any) => {
      const existing = taskList.find(t => t.id === et.id);
      return {
        id: et.id,
        title: et.title || (existing ? existing.title : 'Untitled'),
        type: existing ? existing.type : 'document',
        documentId: et.documentId ?? existing?.documentId,
        content: et.content,
      } as Tab;
    });

    // Preserve tasks that weren't touched by editor updates
    const updatedIds = new Set(mapped.map(m => m.id));
    const preserved = taskList.filter(t => !updatedIds.has(t.id));
    const final = [...preserved, ...mapped];
    setTaskList(final);
  };

  // taskList가 변경될 때마다 로그 남기기
  useEffect(() => {
    // 디버그용 콘솔 출력 제거됨
  }, [taskList]);

  // Persist tabs (current task list) to a cookie whenever tabs change
  useEffect(() => {
    try {
      const minimalTasks = taskList.map(t => ({ id: t.id, title: t.title, type: t.type, documentId: t.documentId }));
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7); // 7 days
      document.cookie = `workspaceTasks=${encodeURIComponent(JSON.stringify(minimalTasks))}; expires=${expirationDate.toUTCString()}; path=/`;
    } catch (err) {
      console.error('Failed to save workspace tasks to cookie', err);
    }
  }, [taskList]);

  // On mount, restore tabs from cookie if no explicit doc id in URL
  // On mount, restore tabs from cookie if workspace has no tasks yet.
  // Use useLayoutEffect so restoration happens before other effects (like route id handling)
  useLayoutEffect(() => {
    // Read cookie regardless of URL id — we want tasks to persist when returning to Workspace
    const cookies = document.cookie.split('; ').reduce<Record<string,string>>((acc, cur) => {
      const [k, v] = cur.split('=');
      acc[k] = v;
      return acc;
    }, {} as Record<string,string>);

    const tasksCookie = cookies['workspaceTasks'];
    if (tasksCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(tasksCookie));
        if (Array.isArray(parsed) && parsed.length > 0 && taskList.length === 0) {
          // Only restore id/title/type/documentId to avoid huge payloads
          const restored: Tab[] = parsed.map((t: any) => ({
            id: t.id,
            title: t.title || 'Untitled',
            type: t.type || 'document',
            documentId: t.documentId,
            content: undefined,
          }));
          setTaskList(restored);
          // Only set active tab if we don't already have one
          if (!activeTabId && restored.length > 0) setActiveTabId(restored[0].id);
        }
      } catch (err) {
        console.error('Failed to parse workspaceTasks cookie', err);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Debug panel when ?debug=1 is present in URL */}
      {new URLSearchParams(window.location.search).get('debug') === '1' && (
        <div className="p-2 bg-black text-white text-xs">
          <strong>WORKSPACE DEBUG</strong>
          <pre className="whitespace-pre-wrap max-h-40 overflow-auto text-left">{JSON.stringify({ taskList, activeTabId, editorTabs }, null, 2)}</pre>
        </div>
      )}

      {/* 탭 헤더 (Workspace 상단에 렌더) */}
      <TabHeader
        tabs={editorTabs as any}
        activeTabId={activeTabId || ''}
        onTabClick={(id: string) => handleTabClick(id)}
        onCloseTab={(id: string, e: React.MouseEvent) => { e.stopPropagation(); handleCloseTab(id); }}
        onAddTab={handleNewFileClick}
        onDragStart={(id: string) => handleDragStart(id)}
        onDragOver={(e: React.DragEvent, id: string) => handleDragOver(e, id)}
        onDragEnd={() => handleDragEnd()}
        onHomeClick={handleHomeClick}
      />

      {/* 탭 컨텐츠 */}
      <div className="flex-1 overflow-hidden">
        {activeTab ? (
          <div className="h-full">
            {activeTab.type === 'document' && (
              <Editor
                onDirtyChange={() => {}}
                onSelectionPreviewChange={onSelectionPreviewChange}
                onSelectionRangeChange={onSelectionRangeChange}
                onOpenTaskbar={onOpenTaskbar}
                onOpenDocument={(docId: string) => loadDocument(docId)}
                tabs={editorTabs}
                setTabs={setTabsFromEditor}
                activeTabId={activeTabId || ''}
                setActiveTabId={(id: string) => setActiveTabId(id)}
                initialContent={typeof activeTab.content === 'string' ? activeTab.content : (activeTab.content?.content ?? '')}
                initialContentType={typeof activeTab.content === 'object' && activeTab.content?.contentType ? activeTab.content.contentType : undefined}
                initialTitle={activeTab.title}
              />
            )}
            {activeTab.type === 'image' && (
              <div className="h-full flex items-center justify-center">
                <p className="text-gray-500">이미지 뷰어 (준비 중)</p>
              </div>
            )}
            {activeTab.type === 'pdf' && (
              <div className="h-full flex items-center justify-center">
                <p className="text-gray-500">PDF 뷰어 (준비 중)</p>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <FileText size={64} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg">열려있는 파일이 없습니다</p>
              <p className="text-sm mt-2">대시보드에서 파일을 선택하거나 새 파일을 만들어보세요</p>
            </div>
          </div>
        )}
      </div>

      {/* 새 파일 모달 */}
      {showNewFileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">새 파일 만들기</h2>
            <div className="space-y-3">
              <button
                onClick={() => handleCreateFile('document')}
                className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left flex items-center gap-3"
              >
                <FileText size={24} className="text-blue-500" />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">문서</div>
                  <div className="text-sm text-gray-500">마크다운 문서 생성</div>
                </div>
              </button>
              <button
                onClick={() => toast('준비 중입니다')}
                className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left flex items-center gap-3 opacity-50 cursor-not-allowed"
              >
                <ImageIcon size={24} className="text-green-500" />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">이미지</div>
                  <div className="text-sm text-gray-500">이미지 파일 (준비 중)</div>
                </div>
              </button>
              <button
                onClick={() => toast('준비 중입니다')}
                className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left flex items-center gap-3 opacity-50 cursor-not-allowed"
              >
                <FileEarmarkPdf size={24} className="text-red-500" />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">PDF</div>
                  <div className="text-sm text-gray-500">PDF 파일 (준비 중)</div>
                </div>
              </button>
            </div>
            <button
              onClick={() => setShowNewFileModal(false)}
              className="mt-4 w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors text-gray-900 dark:text-white"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Workspace;
