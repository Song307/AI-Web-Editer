import React from 'react';
import { Editor } from '@tiptap/react';
import {
  Fonts,
  Plus,
  ChevronDown,
  ThreeDots,
  TypeBold,
  TypeItalic,
  TypeStrikethrough,
  TypeH1,
  TypeH2,
  TypeH3,
  ListUl,
  ListOl,
  CheckSquare,
  Link45deg,
  Image,
  Code,
  Quote,
  Dash,
} from 'react-bootstrap-icons';

interface FloatingToolbarProps {
  editor: Editor;
  isVisible: boolean;
  isHiddenByWidth: boolean;
  activeMenu: 'text' | 'insert';
  toolbarOffset: number;
  onMenuChange: (menu: 'text' | 'insert') => void;
  onToggleVisibility: (visible: boolean) => void;
  onLinkInsert: () => void;
  onImageInsert: () => void;
  // Taskbar position props
  isRightSidebarOpen?: boolean;
  rightSidebarWidth?: number;
}

const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  editor,
  isVisible,
  isHiddenByWidth,
  activeMenu,
  toolbarOffset,
  onMenuChange,
  onToggleVisibility,
  onLinkInsert,
  onImageInsert,
  isRightSidebarOpen = false,
  rightSidebarWidth = 320,
}) => {
  if (isHiddenByWidth) {
    return null;
  }

  // 테스크바가 열려있으면 툴바 위치 조정
  const taskbarOffset = isRightSidebarOpen ? -(rightSidebarWidth / 2) : 0;

  return (
    <div 
      className="fixed bottom-12 z-40 max-w-[95vw] transition-all duration-300"
      style={{
        left: '50%',
        transform: `translateX(calc(-50% + ${toolbarOffset + taskbarOffset}px))`
      }}
    >
      {isVisible ? (
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-2 border-gray-300 dark:border-gray-700 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] px-4 py-2 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* 좌측 메뉴 영역 */}
          <div className="flex items-center gap-2">
            <div className="tooltip-container">
              <button
                onClick={() => onMenuChange('text')}
                className={`p-2 rounded-lg cursor-pointer text-sm font-medium transition-all ${
                  activeMenu === 'text' 
                    ? 'bg-blue-500 text-white' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Fonts size={20} />
              </button>
              <span className="tooltip-text">텍스트</span>
            </div>
            <div className="tooltip-container">
              <button
                onClick={() => onMenuChange('insert')}
                className={`p-2 rounded-lg cursor-pointer text-sm font-medium transition-all ${
                  activeMenu === 'insert' 
                    ? 'bg-blue-500 text-white' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Plus size={20} />
              </button>
              <span className="tooltip-text">삽입</span>
            </div>
          </div>
          
          {/* 구분선 */}
          <div className="w-px h-8 bg-gray-300 dark:bg-gray-600"></div>
          
          {/* 우측 하위 도구 영역 */}
          <div className="flex items-center gap-2">
            {/* 텍스트 메뉴 */}
            {activeMenu === 'text' && (
              <>
                <div className="tooltip-container">
                  <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`p-2 rounded-lg cursor-pointer text-sm font-medium transition-all text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      editor.isActive('bold') ? 'bg-blue-500 text-white hover:bg-blue-600' : ''
                    }`}
                  >
                    <TypeBold size={18} />
                  </button>
                  <span className="tooltip-text">굵게 (Ctrl+B)</span>
                </div>
                <div className="tooltip-container">
                  <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`p-2 rounded-lg cursor-pointer text-sm font-medium transition-all text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      editor.isActive('italic') ? 'bg-blue-500 text-white hover:bg-blue-600' : ''
                    }`}
                  >
                    <TypeItalic size={18} />
                  </button>
                  <span className="tooltip-text">기울임 (Ctrl+I)</span>
                </div>
                <div className="tooltip-container">
                  <button
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    className={`p-2 rounded-lg cursor-pointer text-sm font-medium transition-all text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      editor.isActive('strike') ? 'bg-blue-500 text-white hover:bg-blue-600' : ''
                    }`}
                  >
                    <TypeStrikethrough size={18} />
                  </button>
                  <span className="tooltip-text">취소선</span>
                </div>
                
                <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                
                <div className="tooltip-container">
                  <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={`p-2 rounded-lg cursor-pointer text-sm font-medium transition-all text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      editor.isActive('heading', { level: 1 }) ? 'bg-blue-500 text-white hover:bg-blue-600' : ''
                    }`}
                  >
                    <TypeH1 size={18} />
                  </button>
                  <span className="tooltip-text">제목 1</span>
                </div>
                <div className="tooltip-container">
                  <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={`p-2 rounded-lg cursor-pointer text-sm font-medium transition-all text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      editor.isActive('heading', { level: 2 }) ? 'bg-blue-500 text-white hover:bg-blue-600' : ''
                    }`}
                  >
                    <TypeH2 size={18} />
                  </button>
                  <span className="tooltip-text">제목 2</span>
                </div>
                <div className="tooltip-container">
                  <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    className={`p-2 rounded-lg cursor-pointer text-sm font-medium transition-all text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      editor.isActive('heading', { level: 3 }) ? 'bg-blue-500 text-white hover:bg-blue-600' : ''
                    }`}
                  >
                    <TypeH3 size={18} />
                  </button>
                  <span className="tooltip-text">제목 3</span>
                </div>
              </>
            )}
            
            {/* 삽입 메뉴 */}
            {activeMenu === 'insert' && (
              <>
                <div className="tooltip-container">
                  <button
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`p-2 rounded-lg cursor-pointer text-sm font-medium transition-all text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      editor.isActive('bulletList') ? 'bg-blue-500 text-white hover:bg-blue-600' : ''
                    }`}
                  >
                    <ListUl size={18} />
                  </button>
                  <span className="tooltip-text">글머리 기호 목록</span>
                </div>
                <div className="tooltip-container">
                  <button
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={`p-2 rounded-lg cursor-pointer text-sm font-medium transition-all text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      editor.isActive('orderedList') ? 'bg-blue-500 text-white hover:bg-blue-600' : ''
                    }`}
                  >
                    <ListOl size={18} />
                  </button>
                  <span className="tooltip-text">번호 목록</span>
                </div>
                <div className="tooltip-container">
                  <button
                    onClick={() => editor.chain().focus().toggleTaskList().run()}
                    className={`p-2 rounded-lg cursor-pointer text-sm font-medium transition-all text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      editor.isActive('taskList') ? 'bg-blue-500 text-white hover:bg-blue-600' : ''
                    }`}
                  >
                    <CheckSquare size={18} />
                  </button>
                  <span className="tooltip-text">체크리스트</span>
                </div>
                
                <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                
                <div className="tooltip-container">
                  <button
                    onClick={onLinkInsert}
                    className={`p-2 rounded-lg cursor-pointer text-sm font-medium transition-all text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      editor.isActive('link') ? 'bg-blue-500 text-white hover:bg-blue-600' : ''
                    }`}
                  >
                    <Link45deg size={18} />
                  </button>
                  <span className="tooltip-text">링크</span>
                </div>
                <div className="tooltip-container">
                  <button
                    onClick={onImageInsert}
                    className="p-2 rounded-lg cursor-pointer text-sm font-medium transition-all text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Image size={18} />
                  </button>
                  <span className="tooltip-text">이미지 삽입</span>
                </div>
                <div className="tooltip-container">
                  <button
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    className={`p-2 rounded-lg cursor-pointer text-sm font-medium transition-all text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      editor.isActive('codeBlock') ? 'bg-blue-500 text-white hover:bg-blue-600' : ''
                    }`}
                  >
                    <Code size={18} />
                  </button>
                  <span className="tooltip-text">코드 블록</span>
                </div>
                <div className="tooltip-container">
                  <button
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    className={`p-2 rounded-lg cursor-pointer text-sm font-medium transition-all text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      editor.isActive('blockquote') ? 'bg-blue-500 text-white hover:bg-blue-600' : ''
                    }`}
                  >
                    <Quote size={18} />
                  </button>
                  <span className="tooltip-text">인용구</span>
                </div>
                <div className="tooltip-container">
                  <button
                    onClick={() => editor.chain().focus().setHorizontalRule().run()}
                    className="p-2 rounded-lg cursor-pointer text-sm font-medium transition-all text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Dash size={18} />
                  </button>
                  <span className="tooltip-text">구분선</span>
                </div>
                {/* 표 삽입 */}
                <div className="tooltip-container">
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('openTableInsertModal'))}
                    className="p-2 rounded-lg cursor-pointer text-sm font-medium transition-all text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <span style={{fontWeight:'bold'}}>표</span>
                  </button>
                  <span className="tooltip-text">표 삽입</span>
                </div>
                {/* 수식 삽입 (모달) */}
                <div className="tooltip-container">
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('openEquationModal'))}
                    className="p-2 rounded-lg cursor-pointer text-sm font-medium transition-all text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <span style={{fontWeight:'bold'}}>$</span>
                  </button>
                  <span className="tooltip-text">수식 입력</span>
                </div>
                {/* 머메이드 다이어그램 삽입 */}
                <div className="tooltip-container">
                  <button
                    onClick={() => editor.chain().focus().insertContent('<pre><code class="language-mermaid">graph TD;\nA-->B;\nA-->C;</code></pre>')}
                    className="p-2 rounded-lg cursor-pointer text-sm font-medium transition-all text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <span style={{fontWeight:'bold'}}>Mermaid</span>
                  </button>
                  <span className="tooltip-text">다이어그램</span>
                </div>
                {/* 동영상(iframe) 삽입 */}
                <div className="tooltip-container">
                  <button
                    onClick={() => editor.chain().focus().insertContent('<iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ" frameborder="0" allowfullscreen></iframe>')}
                    className="p-2 rounded-lg cursor-pointer text-sm font-medium transition-all text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <span style={{fontWeight:'bold'}}>🎬</span>
                  </button>
                  <span className="tooltip-text">동영상</span>
                </div>
              </>
            )}
          </div>
          
          {/* 우측 끝 구분선 */}
          <div className="w-px h-8 bg-gray-300 dark:bg-gray-600"></div>
          
          {/* 툴바 숨기기 버튼 */}
          <div className="tooltip-container">
            <button
              onClick={() => onToggleVisibility(false)}
              className="p-2 rounded-lg cursor-pointer text-sm font-medium transition-all text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ChevronDown size={18} />
            </button>
            <span className="tooltip-text">툴바 숨기기</span>
          </div>
        </div>
      ) : (
        /* 툴바 숨김 상태 - ... 버튼만 표시 */
        <div className="tooltip-container">
          <button
            onClick={() => onToggleVisibility(true)}
            className="p-2 cursor-pointer text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-all hover:scale-110 animate-in fade-in zoom-in-50 duration-300"
          >
            <ThreeDots size={24} />
          </button>
          <span className="tooltip-text">툴바 표시</span>
        </div>
      )}
    </div>
  );
};

export default FloatingToolbar;
