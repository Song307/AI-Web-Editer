import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ClipboardCheck, Gear, Plus, Trash3, Folder, Database, Palette, MenuButton, X, Robot, ChatDots } from 'react-bootstrap-icons';
import { Document } from '../../utils/db';

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  language: 'ko' | 'en';
  documents: Document[];
  createNewDocument: () => void;
  handleRenameStart: (doc: Document) => void;
  handleDelete: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
  language,
  documents,
  createNewDocument,
  handleRenameStart,
  handleDelete,
}) => {
  const navigate = useNavigate();

  return (
    <>
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`bg-white dark:bg-gray-800 rounded-xl shadow-xl flex flex-col border border-gray-200 dark:border-gray-700 backdrop-blur-xl overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent transition-all duration-300 ${
        isSidebarOpen ? 'p-6' : 'p-3'
      } ${isSidebarOpen ? 'relative z-50' : 'relative z-30'}`}>
        {/* Sidebar Toggle Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="flex items-center justify-center w-8 h-8 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-none rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-200 dark:hover:bg-gray-600 hover:scale-105"
            title={isSidebarOpen ? (language === 'ko' ? '사이드바 닫기' : 'Close Sidebar') : (language === 'ko' ? '사이드바 열기' : 'Open Sidebar')}
          >
            {isSidebarOpen ? <X size={16} /> : <MenuButton size={16} />}
          </button>
        </div>

        {/* Icon Navigation */}
        <div className={`flex flex-col gap-2 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700 ${
          !isSidebarOpen ? 'items-center' : ''
        }`}>
          <button
            onClick={() => {
              navigate('/workspace');
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium text-left rounded-lg cursor-pointer transition-all duration-300 ${
              window.location.pathname === '/workspace'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            } ${!isSidebarOpen ? 'w-full justify-center px-2 py-4' : ''}`}
            title={language === 'ko' ? '워크스페이스' : 'Workspace'}
          >
            <Folder size={isSidebarOpen ? 18 : 24} />
            {isSidebarOpen && <span>{language === 'ko' ? '워크스페이스' : 'Workspace'}</span>}
          </button>
          <button
            onClick={() => {
              navigate('/documents');
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium text-left rounded-lg cursor-pointer transition-all duration-300 ${
              (window.location.pathname.startsWith('/documents') || window.location.pathname === '/')
                ? 'bg-indigo-600 text-white'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            } ${!isSidebarOpen ? 'w-full justify-center px-2 py-4' : ''}`}
            title={language === 'ko' ? '문서' : 'Documents'}
          >
            <FileText size={isSidebarOpen ? 18 : 24} />
            {isSidebarOpen && <span>{language === 'ko' ? '문서' : 'Documents'}</span>}
          </button>
          <button
            onClick={() => {
              navigate('/ai-assistant');
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium text-left rounded-lg cursor-pointer transition-all duration-300 ${
              window.location.pathname === '/ai-assistant'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            } ${!isSidebarOpen ? 'w-full justify-center px-3 py-4' : ''}`}
            title={language === 'ko' ? 'AI 어시스턴트' : 'AI Assistant'}
          >
            <ChatDots size={isSidebarOpen ? 18 : 24} />
            {isSidebarOpen && <span>{language === 'ko' ? 'AI 어시스턴트' : 'AI Assistant'}</span>}
          </button>
          <button
            onClick={() => {
              navigate('/clipboard');
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium text-left rounded-lg cursor-pointer transition-all duration-300 ${
              window.location.pathname === '/clipboard'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            } ${!isSidebarOpen ? 'w-full justify-center px-3 py-4' : ''}`}
            title={language === 'ko' ? '클립보드' : 'Clipboard'}
          >
            <ClipboardCheck size={isSidebarOpen ? 18 : 24} />
            {isSidebarOpen && <span>{language === 'ko' ? '클립보드' : 'Clipboard'}</span>}
          </button>
          <button
            onClick={() => {
              navigate('/storage');
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium text-left rounded-lg cursor-pointer transition-all duration-300 ${
              window.location.pathname === '/storage'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            } ${!isSidebarOpen ? 'w-full justify-center px-3 py-4' : ''}`}
            title={language === 'ko' ? '저장공간' : 'Storage'}
          >
            <Database size={isSidebarOpen ? 18 : 24} />
            {isSidebarOpen && <span>{language === 'ko' ? '저장공간' : 'Storage'}</span>}
          </button>
          <button
            onClick={() => {
              navigate('/image-editor');
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium text-left rounded-lg cursor-pointer transition-all duration-300 ${
              window.location.pathname === '/image-editor'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            } ${!isSidebarOpen ? 'w-full justify-center px-3 py-4' : ''}`}
            title={language === 'ko' ? '이미지 편집기' : 'Image Editor'}
          >
            <Palette size={isSidebarOpen ? 18 : 24} />
            {isSidebarOpen && <span>{language === 'ko' ? '이미지 편집기' : 'Image Editor'}</span>}
          </button>
          <button
            onClick={() => {
              navigate('/ai-secretary');
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium text-left rounded-lg cursor-pointer transition-all duration-300 ${
              window.location.pathname === '/ai-secretary'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            } ${!isSidebarOpen ? 'w-full justify-center px-3 py-4' : ''}`}
            title={language === 'ko' ? 'AI 비서' : 'AI Secretary'}
          >
            <Robot size={isSidebarOpen ? 18 : 24} />
            {isSidebarOpen && <span>{language === 'ko' ? 'AI 비서' : 'AI Secretary'}</span>}
          </button>
          <button
            onClick={() => {
              navigate('/settings');
              if (window.innerWidth < 768) setIsSidebarOpen(false);
            }}
            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium text-left rounded-lg cursor-pointer transition-all duration-300 ${
              window.location.pathname === '/settings'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            } ${!isSidebarOpen ? 'w-full justify-center px-3 py-4' : ''}`}
            title={language === 'ko' ? '환경설정' : 'Settings'}
          >
            <Gear size={isSidebarOpen ? 18 : 24} />
            {isSidebarOpen && <span>{language === 'ko' ? '환경설정' : 'Settings'}</span>}
          </button>
        </div>

        {/* Document List - Only show when sidebar is open */}
        {(window.location.pathname.startsWith('/documents') || window.location.pathname === '/') && isSidebarOpen && (
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
                className="flex items-center justify-between p-2 mb-2 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setTimeout(() => {
                    navigate(`/documents/${doc.id}`);
                  }, 0);
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {doc.title}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {new Date(doc.updatedAt).toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                <div className="flex gap-1 ml-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRenameStart(doc);
                    }}
                    className="p-1 text-gray-600 dark:text-gray-400 hover:text-blue-500 transition-colors"
                    title={language === 'ko' ? '이름 변경' : 'Rename'}
                  >
                    <Gear size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(doc.id);
                    }}
                    className="p-1 text-gray-600 dark:text-gray-400 hover:text-red-500 transition-colors"
                    title={language === 'ko' ? '삭제' : 'Delete'}
                  >
                    <Trash3 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;