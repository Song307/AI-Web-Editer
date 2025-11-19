import React, { useState, useRef, useEffect } from 'react';
import { Floppy, Search, List, ThreeDots, Pencil, Download, Files, Trash, QuestionCircle, Folder } from 'react-bootstrap-icons';
import DocumentListSidebar from './DocumentListSidebar';

interface HeaderMenuProps {
  onSave: () => void;
  leftSidebarTab: 'search' | 'toc' | null;
  onSearchClick: () => void;
  onTocClick: () => void;
  onRenameFile?: () => void;
  onExportFile?: () => void;
  onDuplicateFile?: () => void;
  onDeleteFile?: () => void;
  onSummarize?: (length?: 'short' | 'medium' | 'long') => void;
  onRewrite?: (tone?: string) => void;
  isDocumentListOpen?: boolean;
  onDocumentListToggle?: () => void;
}

const HeaderMenu: React.FC<HeaderMenuProps> = ({
  onSave,
  leftSidebarTab,
  onSearchClick,
  onTocClick,
  onSummarize = () => {},
  onRewrite = () => {},
  onRenameFile = () => {},
  onExportFile = () => {},
  onDuplicateFile = () => {},
  onDeleteFile = () => {},
  isDocumentListOpen = false,
  onDocumentListToggle = () => {},
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // Document list state is now controlled by parent
  const menuRef = useRef<HTMLDivElement>(null);

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleRename = () => {
    setIsMenuOpen(false);
    onRenameFile();
  };

  const handleExport = () => {
    setIsMenuOpen(false);
    onExportFile();
  };

  const handleDuplicate = () => {
    setIsMenuOpen(false);
    onDuplicateFile();
  };

  const handleDelete = () => {
    if (window.confirm('정말로 이 파일을 삭제하시겠습니까?')) {
      setIsMenuOpen(false);
      onDeleteFile();
    }
  };
  const toggleDocumentList = () => {
    onDocumentListToggle();
  };

  return (
    <div>
    <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-1">
        <div className="flex items-center justify-between">
        {/* 좌측 버튼들 */}
        <div className="flex items-center gap-2">
          {/* 문서 목록 토글 버튼 */}
          <div className="tooltip-container tooltip-top">
            <button
              onClick={toggleDocumentList}
              className={`p-1.5 rounded-lg transition-all ${
                isDocumentListOpen
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
              title="문서 목록"
            >
              <Folder size={18} />
            </button>
            <span className="tooltip-text">문서 목록</span>
          </div>
          
          {/* 저장 버튼 */}
          <div className="tooltip-container tooltip-top">
            <button
              onClick={onSave}
              className="p-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-all"
            >
              <Floppy size={18} />
            </button>
            <span className="tooltip-text">저장</span>
          </div>
          
          {/* 검색 버튼 */}
          <div className="tooltip-container tooltip-top">
            <button
              onClick={onSearchClick}
              className={`p-1.5 rounded-lg transition-all ${
                leftSidebarTab === 'search'
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <Search size={18} />
            </button>
            <span className="tooltip-text">검색 (Ctrl+F)</span>
          </div>
          
          {/* 목차 버튼 */}
          <div className="tooltip-container tooltip-top">
            <button
              onClick={onTocClick}
              className={`p-1.5 rounded-lg transition-all ${
                leftSidebarTab === 'toc'
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <List size={18} />
            </button>
            <span className="tooltip-text">목차</span>
          </div>
          
          {/* 튜토리얼 버튼 */}
          <div className="tooltip-container tooltip-top">
            <button
              onClick={() => {/* 튜토리얼 기능은 나중에 구현 */}}
              className="p-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-all"
            >
              <QuestionCircle size={18} />
            </button>
            <span className="tooltip-text">도움말 - 구현예정</span>
          </div>

          {/* 요약 버튼 */}
          <div className="tooltip-container tooltip-top">
            {/* 요약 버튼: 클릭시 길이 선택 메뉴 표시 */}
            <SummaryButton onSummarize={onSummarize} />
          </div>

          {/* 리라이트/톤 변환 버튼 */}
          <div className="tooltip-container tooltip-top">
            <RewriteButton onRewrite={onRewrite} />
          </div>
        </div>
      
        {/* 우측 - ... 메뉴 버튼 */}
          <div className="relative" ref={menuRef}>
          <button
            onClick={toggleMenu}
            className={`p-1.5 rounded-lg transition-all ${
              isMenuOpen
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
            title="더보기"
          >
            <ThreeDots size={18} />
          </button>
          
          {/* 드롭다운 메뉴 */}
          {isMenuOpen && (
            <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700">
              <button
                onClick={handleRename}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="파일 제목 변경"
              >
                <Pencil size={16} className="mr-2" />
                파일 제목 변경
              </button>
              <button
                onClick={handleExport}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="파일 내보내기"
              >
                <Download size={16} className="mr-2" />
                파일 내보내기
              </button>
              <button
                onClick={handleDuplicate}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="파일 복사하기"
              >
                <Files size={16} className="mr-2" />
                파일 복사하기
              </button>
              <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
              <button
                onClick={handleDelete}
                className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                title="파일 삭제하기"
              >
                <Trash size={16} className="mr-2" />
                파일 삭제하기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
      
      {/* 문서 목록 사이드바는 이제 부모 컴포넌트에서 렌더링됨 */}
    </div>
  );
};

// 분리된 요약 버튼 컴포넌트 (길이 선택 메뉴 포함)
const SummaryButton: React.FC<{ onSummarize?: (length?: 'short'|'medium'|'long') => void }> = ({ onSummarize }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(s => !s)}
        className="p-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-all"
        title="선택 영역 또는 문서 요약"
      >
        <Files size={18} />
      </button>
      <span className="tooltip-text">요약</span>
      {open && (
        <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700">
          <button className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => { onSummarize && onSummarize('short'); setOpen(false); }}>짧게 (1-2문장)</button>
          <button className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => { onSummarize && onSummarize('medium'); setOpen(false); }}>보통 (3-4문장)</button>
          <button className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => { onSummarize && onSummarize('long'); setOpen(false); }}>자세히 (단락)</button>
        </div>
      )}
    </div>
  );
};

// 간단한 리라이트 버튼 (톤 선택 메뉴 포함)
const RewriteButton: React.FC<{ onRewrite?: (tone?: string) => void }> = ({ onRewrite }) => {
  const [open, setOpen] = React.useState(false);
  const options = [
    { key: 'business', label: '비즈니스(공식적)' },
    { key: 'friendly', label: '친근한(캐주얼)' },
    { key: 'concise', label: '간결하게' },
    { key: 'expand', label: '자세히(확장)' },
    { key: 'casual', label: '일상적(편한말)' },
    { key: 'academic', label: '학술적' },
  ];

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(s => !s)}
        className="p-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-all"
        title="선택 영역 또는 문서 리라이트/톤 변환"
      >
        <Pencil size={18} />
      </button>
      <span className="tooltip-text">리라이트</span>
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700">
          {options.map(o => (
            <button key={o.key} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => { onRewrite && onRewrite(o.key); setOpen(false); }}>{o.label}</button>
          ))}
        </div>
      )}
    </div>
  );
};

export default HeaderMenu;
