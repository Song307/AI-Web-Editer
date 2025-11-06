import React from 'react';

interface TaskbarProps {
  isRightSidebarOpen: boolean;
  rightSidebarWidth: number;
  isResizingRight: boolean;
  onClose: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

const Taskbar: React.FC<TaskbarProps> = ({
  isRightSidebarOpen,
  rightSidebarWidth,
  isResizingRight,
  onClose,
  onMouseDown,
}) => {
  return (
    <div
      className={`fixed top-0 right-0 h-screen bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out z-50 flex ${
        isRightSidebarOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{
        width: `${rightSidebarWidth}px`,
        transition: isResizingRight ? 'none' : 'transform 300ms ease-in-out'
      }}
    >
      {/* 리사이저 */}
      <div
        className="w-1 hover:w-2 bg-transparent hover:bg-blue-500 cursor-col-resize transition-all flex-shrink-0 relative group"
        onMouseDown={onMouseDown}
      >
        <div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-1 h-12 bg-blue-500 rounded-full"></div>
        </div>
      </div>

      <div className="flex flex-col h-full flex-1 min-w-0">
        {/* 사이드바 헤더 - 버튼 공간 확보 */}
        <div className="relative pt-20 px-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          {/* X 버튼 - 우측 상단 고정 */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-lg transition-colors"
            title="사이드바 닫기"
          >
            <svg
              className="w-6 h-6 text-gray-600 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            작업 공간
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            여기에 사이드바 컨텐츠를 추가하세요
          </p>
        </div>

        {/* 사이드바 내용 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* 예시 컨텐츠 영역 */}
          <div className="space-y-3">
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                섹션 1
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                여기에 내용을 추가하세요.
              </p>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                섹션 2
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                여기에 내용을 추가하세요.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Taskbar;