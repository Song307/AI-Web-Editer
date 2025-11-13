import React from 'react';
import { X, ChevronDown, List } from 'react-bootstrap-icons';
import { Editor } from '@tiptap/react';

interface LeftSidebarProps {
  isOpen: boolean;
  activeTab: 'search' | 'toc' | null;
  searchQuery: string;
  searchResults: Array<{ index: number; text: string }>;
  currentSearchIndex: number;
  tableOfContents: Array<{ level: number; text: string; pos: number }>;
  editor: Editor | null;
  onClose: () => void;
  onSearchChange: (query: string) => void;
  onSearchNavigation: (direction: 'next' | 'prev') => void;
  onSearchResultClick: (index: number) => void;
  onTocItemClick: (pos: number) => void;
}

const LeftSidebar: React.FC<LeftSidebarProps> = ({
  isOpen,
  activeTab,
  searchQuery,
  searchResults,
  currentSearchIndex,
  tableOfContents,
  editor,
  onClose,
  onSearchChange,
  onSearchNavigation,
  onSearchResultClick,
  onTocItemClick,
}) => {
  return (
    <div className={`flex-shrink-0 h-full bg-white dark:bg-gray-800 transition-all duration-300 ${
      isOpen ? 'w-80 border-r-2 border-gray-300 dark:border-gray-700' : 'w-0'
    } overflow-hidden flex flex-col`}>
      {isOpen && (
        <>
          {/* 사이드바 헤더 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {activeTab === 'search' ? '검색' : '목차'}
            </h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-all"
            >
              <X size={20} />
            </button>
          </div>

          {/* 검색 탭 컨텐츠 */}
          {activeTab === 'search' && (
            <>
              {/* 검색 입력 */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="텍스트 검색..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                
                {/* 검색 결과 카운트 */}
                {searchResults.length > 0 && (
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {currentSearchIndex + 1} / {searchResults.length} 결과
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => onSearchNavigation('prev')}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-all"
                        title="이전"
                      >
                        <ChevronDown size={16} className="rotate-180" />
                      </button>
                      <button
                        onClick={() => onSearchNavigation('next')}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-all"
                        title="다음"
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 검색 결과 목록 */}
              <div className="flex-1 overflow-y-auto p-4">
                {searchQuery && searchResults.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                    검색 결과가 없습니다.
                  </p>
                )}
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    onClick={() => onSearchResultClick(index)}
                    className={`p-3 mb-2 rounded-lg cursor-pointer transition-all ${
                      index === currentSearchIndex
                        ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-500'
                        : 'bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent'
                    }`}
                  >
                    <p className="text-sm text-gray-700 dark:text-gray-300 break-words">
                      {result.text}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 목차 탭 컨텐츠 */}
          {activeTab === 'toc' && (
            <div className="flex-1 overflow-y-auto">
              {tableOfContents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full px-4">
                  <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                    <List size={32} className="text-gray-400 dark:text-gray-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    목차가 비어있습니다
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                    제목을 추가하면 자동으로 표시됩니다
                  </p>
                </div>
              ) : (
                <div className="py-2">
                  {tableOfContents.map((heading, index) => (
                    <div
                      key={index}
                      onClick={() => onTocItemClick(heading.pos)}
                      className={`
                        flex items-center px-4 py-2.5 cursor-pointer transition-all
                        hover:bg-gray-50 dark:hover:bg-gray-700/50
                        border-l-3 hover:border-l-4
                        ${heading.level === 1 
                          ? 'border-l-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/20' 
                          : heading.level === 2 
                          ? 'border-l-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/20 ml-4' 
                          : 'border-l-gray-300 dark:border-l-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 ml-8'}
                      `}
                    >
                      {/* 제목 */}
                      <p className={`
                        flex-1 truncate transition-colors
                        ${heading.level === 1 
                          ? 'text-sm font-bold text-gray-900 dark:text-gray-100' 
                          : heading.level === 2 
                          ? 'text-sm font-medium text-gray-800 dark:text-gray-200' 
                          : 'text-sm text-gray-700 dark:text-gray-400'}
                      `}>
                        {heading.text || '(제목 없음)'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LeftSidebar;
