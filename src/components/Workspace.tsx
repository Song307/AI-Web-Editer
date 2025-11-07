import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { House, Plus, X, FileText, Image as ImageIcon, FileEarmarkPdf } from 'react-bootstrap-icons';
import Editor from './Editor';
import ImageViewer from './tools/ImageViewer';
import PDFViewer from './tools/PDFViewer';
import { getDocument } from '../utils/db';
import toast from 'react-hot-toast';

interface Tab {
  id: string;
  title: string;
  type: 'document' | 'image' | 'pdf' | 'video';
  documentId?: number;
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
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    // URL에서 문서 ID를 받아서 탭 열기
    if (id && id !== 'new') {
      loadDocument(parseInt(id));
    } else if (id === 'new') {
      // 새 파일 생성 모달 표시
      setShowNewFileModal(true);
    }
  }, [id]);

  const loadDocument = async (docId: number) => {
    try {
      const doc = await getDocument(docId.toString());
      if (doc) {
        // 이미 열려있는 탭인지 확인
        const existingTab = tabs.find(tab => tab.documentId === docId);
        if (existingTab) {
          setActiveTabId(existingTab.id);
        } else {
          // 새 탭 추가
          const newTab: Tab = {
            id: `doc-${docId}-${Date.now()}`,
            title: doc.title,
            type: 'document',
            documentId: docId,
            content: doc
          };
          setTabs(prev => [...prev, newTab]);
          setActiveTabId(newTab.id);
        }
      }
    } catch (error) {
      console.error('Failed to load document:', error);
      toast.error('문서를 불러올 수 없습니다.');
    }
  };

  const handleHomeClick = () => {
    navigate('/dashboard');
  };

  const handleNewFileClick = () => {
    setShowNewFileModal(true);
  };

  const handleCloseTab = (tabId: string) => {
    const tabIndex = tabs.findIndex(tab => tab.id === tabId);
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    setTabs(newTabs);

    // 닫은 탭이 활성 탭이었다면 다른 탭 활성화
    if (activeTabId === tabId && newTabs.length > 0) {
      if (tabIndex > 0) {
        setActiveTabId(newTabs[tabIndex - 1].id);
      } else {
        setActiveTabId(newTabs[0].id);
      }
    } else if (newTabs.length === 0) {
      setActiveTabId(null);
      // 탭이 없으면 대시보드로 이동
      navigate('/dashboard');
    }
  };

  const handleCreateFile = (fileType: 'document' | 'image' | 'pdf') => {
    const newTab: Tab = {
      id: `new-${fileType}-${Date.now()}`,
      title: `새 ${fileType === 'document' ? '문서' : fileType === 'image' ? '이미지' : 'PDF'}`,
      type: fileType
    };
    setTabs(prev => [...prev, newTab]);
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

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* 탭 헤더 */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center h-12">
          {/* 홈 버튼 */}
          <button
            onClick={handleHomeClick}
            className="px-4 h-full flex items-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border-r border-gray-200 dark:border-gray-700"
            title="대시보드로 이동"
          >
            <House size={18} className="text-gray-600 dark:text-gray-400" />
          </button>

          {/* 탭 목록 */}
          <div className="flex-1 flex items-center overflow-x-auto">
            {tabs.map(tab => (
              <div
                key={tab.id}
                className={`h-full flex items-center px-4 border-r border-gray-200 dark:border-gray-700 cursor-pointer group min-w-[120px] max-w-[200px] ${
                  activeTabId === tab.id
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-750'
                }`}
                onClick={() => setActiveTabId(tab.id)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {getTabIcon(tab.type)}
                  <span className="text-sm truncate">{tab.title}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTab(tab.id);
                  }}
                  className="ml-2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* 새 파일 버튼 */}
          <button
            onClick={handleNewFileClick}
            className="px-4 h-full flex items-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border-l border-gray-200 dark:border-gray-700"
            title="새 파일"
          >
            <Plus size={18} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

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
