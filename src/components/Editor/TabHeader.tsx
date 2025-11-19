import React from 'react';
import { House, PlusLg, X } from 'react-bootstrap-icons';
import { DocumentTab } from './types';

interface TabHeaderProps {
  tabs: DocumentTab[];
  activeTabId: string;
  onTabClick: (id: string) => void;
  onCloseTab: (id: string, e: React.MouseEvent) => void;
  onAddTab: () => void;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onHomeClick?: () => void;
  onOpenTaskbar?: () => void;
}

const TabHeader: React.FC<TabHeaderProps> = ({
  tabs,
  activeTabId,
  onTabClick,
  onCloseTab,
  onAddTab,
  onDragStart,
  onDragOver,
  onDragEnd,
  onHomeClick,
  onOpenTaskbar,
}) => {
  return (
    <div className="flex-shrink-0 border-b-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center overflow-x-auto">
          {/* 홈 아이콘 - 좌측 끝 */}
          <button
            className="flex items-center justify-center p-2 mr-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
            title="홈"
            onClick={() => onHomeClick && onHomeClick()}
          >
            <House size={20} />
          </button>
          
          {/* 탭들 */}
          {tabs.map((tab) => (
            <div
              key={tab.id}
              draggable
              onDragStart={() => onDragStart(tab.id)}
              onDragOver={(e) => onDragOver(e, tab.id)}
              onDragEnd={onDragEnd}
              onClick={() => onTabClick(tab.id)}
              className={`
                group flex items-center gap-2 px-4 py-3 cursor-move transition-all relative
                ${tab.id === activeTabId 
                  ? 'bg-gray-100 dark:bg-gray-700 border-b-2 border-blue-500' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-750'
                }
              `}
            >
              <span className={`text-sm max-w-[150px] truncate ${
                tab.id === activeTabId 
                  ? 'font-semibold text-gray-900 dark:text-gray-100' 
                  : 'text-gray-700 dark:text-gray-300'
              }`}>
                {tab.title}
              </span>
              
              {/* 닫기 버튼 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('X button clicked for tab:', tab.id);
                  onCloseTab(tab.id, e);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-all"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          
          {/* 새 탭 추가 버튼 */}
          <button
            onClick={onAddTab}
            className="flex items-center gap-1 px-3 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-750 transition-all"
            title="새 탭"
          >
            <PlusLg size={16} />
          </button>
        </div>

        {/* AI 채팅 버튼 - 우측 끝 */}
        {onOpenTaskbar && (
          <button
            onClick={onOpenTaskbar}
            className="flex items-center justify-center p-2 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
            title="AI 채팅 열기"
            aria-label="Open AI chat"
          >
            <svg
              className="w-5 h-5 text-gray-700 dark:text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default TabHeader;
