import React, { useState, forwardRef, useImperativeHandle, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import RenameModal from './ui/shared/RenameModal';
import TabCloseConfirmModal from './ui/shared/TabCloseConfirmModal';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Heading from '@tiptap/extension-heading';
import { BulletList } from '@tiptap/extension-bullet-list';
import { OrderedList } from '@tiptap/extension-ordered-list';
import { ListItem } from '@tiptap/extension-list-item';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { Extension } from '@tiptap/core';
import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { marked } from 'marked';
import { saveDocument, getDocument, deleteDocument, Document } from '../utils/db';
import { researchTopic, analyzeText, generatePersonaFeedback, answerQuestion, analyzeImage, analyzePDFPages } from '../utils/ai';
import toast from 'react-hot-toast';
import TurndownService from 'turndown';
import TabHeader from './Editor/TabHeader';
import HeaderMenu from './Editor/HeaderMenu';
import LeftSidebar from './Editor/LeftSidebar';
import FloatingToolbar from './Editor/FloatingToolbar';
import { DocumentTab } from './Editor/types';
import { 
  Robot,
  X,
  PlusLg,
} from 'react-bootstrap-icons';
import DocumentListSidebar, { DocumentListSidebarRef } from './Editor/DocumentListSidebar';

// AI 선택 하이라이트를 위한 Mark 확장
const AISelectionHighlight = Extension.create({
  name: 'aiSelectionHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, old) {
            // 트랜잭션에서 AI 선택 범위를 가져옴
            const aiSelection = tr.getMeta('aiSelection');
            if (aiSelection) {
              const { from, to } = aiSelection;
              if (from !== to) {
                const decoration = Decoration.inline(from, to, {
                  class: 'ai-selection-highlight',
                });
                return DecorationSet.create(tr.doc, [decoration]);
              }
            }
            // aiSelection이 null이면 하이라이트 제거
            if (aiSelection === null) {
              return DecorationSet.empty;
            }
            // 그 외의 경우 기존 decoration 유지 (mapping 적용)
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

// 마크다운 붙여넣기 확장
const MarkdownPasteExtension = Extension.create({
  name: 'markdownPaste',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          // 텍스트를 붙여넣을 때 실행되는 함수
          transformPastedText(text: string) {
            // 붙여넣은 텍스트가 마크다운을 포함하는지 확인
            const hasMarkdown = /\*\*.*\*\*|_.*_|`.*`|\[.*\]\(.*\)|\n\n/.test(text);
            
            if (hasMarkdown) {
              // 마크다운이 포함되어 있다면 HTML로 변환
              const html = marked.parse(text) as string;
              return html;
            }
            
            // 마크다운이 없으면 원본 텍스트 반환
            return text;
          },
        },
      }),
    ];
  },
});

interface EditorProps {
  documentId?: string;
  onSave?: (doc: Document) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onSelectionPreviewChange?: (preview: string | null) => void;
  onSelectionRangeChange?: (range: { from: number; to: number } | null) => void;
  onOpenTaskbar?: () => void;
}

const Editor = forwardRef<{ handleSave: () => void; saveEditorStateToCookie: () => void; replaceSelection: (text: string) => void; highlightSelection: (from: number, to: number) => void; clearHighlight: () => void }, EditorProps>(({ onSave, onDirtyChange, onSelectionPreviewChange, onSelectionRangeChange, onOpenTaskbar }, ref) => {
  const { id } = useParams<{ id: string }>();
  const documentId = id;
  const [title, setTitle] = useState('Untitled Document');
  const [tabs, setTabs] = useState<DocumentTab[]>([
    { id: '1', title: 'Untitled Document', content: '', isActive: true, documentId: documentId || undefined }
  ]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(() => {
    const saved = localStorage.getItem('isSearchOpen');
    return saved ? JSON.parse(saved) : false;
  });
  const [leftSidebarTab, setLeftSidebarTab] = useState<'search' | 'toc' | null>(() => {
    const saved = localStorage.getItem('leftSidebarTab');
    return saved ? JSON.parse(saved) : null;
  });
  const [isDocumentListOpen, setIsDocumentListOpen] = useState(() => {
    const saved = localStorage.getItem('isDocumentListOpen');
    return saved ? JSON.parse(saved) : false;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ index: number; text: string }>>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [tableOfContents, setTableOfContents] = useState<Array<{ level: number; text: string; pos: number }>>([]);
  const [toolbarOffset, setToolbarOffset] = useState(0);
  const [isToolbarHiddenByWidth, setIsToolbarHiddenByWidth] = useState(false);
  const [aiResponse, setAiResponse] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isTabCloseConfirmModalOpen, setIsTabCloseConfirmModalOpen] = useState(false);
  const [tabToClose, setTabToClose] = useState<string | null>(null);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0);
  const [selectedTextForAI, setSelectedTextForAI] = useState<{ from: number; to: number; text: string } | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [showImageUrlModal, setShowImageUrlModal] = useState(false);

  // DocumentListSidebar ref
  const documentListSidebarRef = useRef<DocumentListSidebarRef>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [showLinkUrlModal, setShowLinkUrlModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [persona, setPersona] = useState('');
  const [activeToolbarMenu, setActiveToolbarMenu] = useState<'text' | 'insert' | 'ai'>('text');
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, // StarterKit의 기본 heading을 비활성화
        bulletList: false, // StarterKit의 기본 bulletList 비활성화
        orderedList: false, // StarterKit의 기본 orderedList 비활성화
        listItem: false, // StarterKit의 기본 listItem 비활성화
      }),
      Heading.configure({
        levels: [1, 2, 3],
      }),
      BulletList.configure({
        keepMarks: true,
        keepAttributes: false,
      }),
      OrderedList.configure({
        keepMarks: true,
        keepAttributes: false,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'link',
        },
      }),
      ListItem,
      Placeholder.configure({
        placeholder: '내용을 입력하세요... ("/"를 눌러 블럭 추가)',
      }),
      MarkdownPasteExtension, // 마크다운 붙여넣기 확장 추가
      AISelectionHighlight, // AI 선택 하이라이트 확장 추가
    ],
    content: '<p></p>',
    onUpdate: ({ editor }) => {
      onDirtyChange?.(true);

      // 슬래시 메뉴가 열려있을 때는 닫기 로직을 실행하지 않음
      // 메뉴는 키보드 이벤트에서만 제어
    },
    onCreate: ({ editor }) => {
      setIsEditorReady(true);
      // 이벤트 리스너는 useEffect에서 추가
    },
    onDestroy: () => {
      // 에디터가 파괴될 때 정리 작업
      // onCreate에서 추가한 이벤트 리스너는 자동으로 정리됨
    },
  });

  const showSlashMenuRef = useRef(showSlashMenu);

  // showSlashMenu 상태가 변경될 때 ref 업데이트
  useEffect(() => {
    showSlashMenuRef.current = showSlashMenu;
  }, [showSlashMenu]);

  useEffect(() => {
    if (isEditorReady && editor?.view?.dom) {
      // 에디터가 완전히 초기화된 후에 이벤트 리스너 추가
      const editorElement = editor.view.dom;
      const handleKeyDown = (event: KeyboardEvent) => {
        // Ctrl+S 또는 Cmd+S (저장 단축키)
        if ((event.ctrlKey || event.metaKey) && (event.key === 's' || event.key === 'S')) {
          event.preventDefault(); // 기본 브라우저 저장 동작 방지
          handleSave(); // 저장 함수 호출
          return;
        }

        // "/" 키 입력 감지 - 항상 메뉴 열기 (앞에 텍스트가 있어도)
        if (event.key === '/') {
          event.preventDefault(); // 기본 동작 방지
          
          // 에디터에 포커스가 없으면 포커스 주기
          if (!editor.isFocused) {
            editor.commands.focus();
          }
          
          setShowSlashMenu(true);
          setSelectedMenuIndex(0);

          // 메뉴 위치는 다음 렌더링에서 계산
          setTimeout(() => {
            if (!editor?.view?.dom) return;

            const editorContainer = editor.view?.dom?.closest('.editor-container') as HTMLElement;
            if (editorContainer) {
              const editorRect = editorContainer.getBoundingClientRect();
              const selection = window.getSelection();
              
              if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                
                // 에디터 컨테이너를 기준으로 한 상대 위치 계산
                const relativeTop = rect.bottom - editorRect.top + 5;
                const relativeLeft = rect.left - editorRect.left;
                
                // TipTap의 좌표 변환을 사용해서 더 정확한 위치 계산
                try {
                  const { from } = editor.state.selection;
                  const editorCoords = editor.view.dom.getBoundingClientRect();
                  
                  // 현재 줄의 시작과 끝 찾기
                  const currentLineStart = editor.state.doc.resolve(from).start();
                  const currentLineEnd = editor.state.doc.resolve(from).end();
                  
                  // 현재 줄의 텍스트 가져오기
                  const currentLineText = editor.state.doc.textBetween(currentLineStart, currentLineEnd);
                  
                  // "/"의 위치를 찾아서 그 바로 아래에 메뉴 표시
                  const slashIndex = currentLineText.lastIndexOf('/');
                  if (slashIndex !== -1) {
                    // "/"가 있는 위치까지의 텍스트로 임시 노드 생성해서 위치 계산
                    const textBeforeSlash = currentLineText.substring(0, slashIndex + 1);
                    
                    // 현재 위치에서 "/"까지의 상대적 위치 계산
                    const slashPos = currentLineStart + slashIndex;
                    const coords = editor.view.coordsAtPos(slashPos);
                    
                    const tipTapTop = coords.bottom - editorCoords.top + 2;
                    const tipTapLeft = Math.max(0, coords.left - editorCoords.left);
                    
                    setSlashMenuPosition({
                      top: tipTapTop,
                      left: tipTapLeft,
                    });
                  } else {
                    // "/"를 찾지 못하면 기본 커서 위치 사용
                    const coords = editor.view.coordsAtPos(from);
                    const tipTapTop = coords.bottom - editorCoords.top + 5;
                    const tipTapLeft = Math.max(0, coords.left - editorCoords.left);
                    
                    setSlashMenuPosition({
                      top: tipTapTop,
                      left: tipTapLeft,
                    });
                  }
                } catch (error) {
                  // 위치가 음수가 되지 않도록 보정
                  const finalTop = Math.max(0, relativeTop);
                  const finalLeft = Math.max(0, relativeLeft);
                  
                  setSlashMenuPosition({
                    top: finalTop,
                    left: finalLeft,
                  });
                }
              } else {
                // 기본 위치 사용 - 에디터 상단 중앙
                const defaultTop = 50;
                const defaultLeft = Math.max(0, editorRect.width / 2 - 100);
                
                setSlashMenuPosition({
                  top: defaultTop,
                  left: defaultLeft,
                });
              }
            }
          }, 10);
        }

        // 스페이스바 입력 감지
        if (event.key === ' ') {
          const { state } = editor;
          const { selection } = state;
          const { $anchor } = selection;

          // 현재 줄의 전체 텍스트 가져오기
          const currentLinePos = $anchor.before($anchor.depth);
          const currentLineText = state.doc.textBetween(currentLinePos, $anchor.pos).trim();

          // 리스트 패턴 감지 및 변환
          if (currentLineText === '-' && !editor.isActive('bulletList')) {
            event.preventDefault();
            
            // "-" 문자를 삭제하고 리스트 생성
            const { $anchor } = editor.state.selection;
            const startOfLine = $anchor.start();
            
            editor.chain()
              .focus()
              .deleteRange({ from: startOfLine, to: startOfLine + 1 }) // "-" 문자 삭제
              .toggleBulletList()
              .run();
          } else if (currentLineText.match(/^\d+\.$/) && !editor.isActive('orderedList')) {
            event.preventDefault();
            
            // 번호와 "." 삭제하고 리스트 생성
            const { $anchor } = editor.state.selection;
            const startOfLine = $anchor.start();
            const numberMatch = currentLineText.match(/^(\d+)\./);
            
            if (numberMatch) {
              const numberLength = numberMatch[1].length + 1; // 숫자 + "."
              
              editor.chain()
                .focus()
                .deleteRange({ from: startOfLine, to: startOfLine + numberLength })
                .toggleOrderedList()
                .run();
            }
          }
        }
      };

      editorElement.addEventListener('keydown', handleKeyDown);

      // cleanup 함수 저장
      (editor as any)._keydownListener = handleKeyDown;

      // cleanup
      return () => {
        editorElement.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isEditorReady, editor]); // showSlashMenu 제거

  // 툴바 위치 계산 - 검색 사이드바와 문서 목록 사이드바 상태에 따라 조정
  useEffect(() => {
    const updateToolbarPosition = () => {
      // 에디터 컨테이너의 실제 너비 확인
      const editorContainer = document.getElementById('editor-container');

      // 왼쪽 사이드바들의 너비 계산 (둘 다 열려있을 수 있음)
      const searchSidebarWidth = isSearchOpen ? 320 : 0;
      const documentListSidebarWidth = isDocumentListOpen ? 320 : 0;
      const sidebarWidth = searchSidebarWidth + documentListSidebarWidth;

      // 화면 전체 너비에서 사이드바 너비를 빼면 에디터 영역의 너비
      const availableWidth = window.innerWidth - sidebarWidth;

      // 에디터 영역의 중앙은 사이드바 너비 + (사용가능한 너비 / 2)
      const editorCenterX = sidebarWidth + (availableWidth / 2);

      // 화면의 중앙
      const viewportCenter = window.innerWidth / 2;

      // 툴바를 이동시켜야 할 거리
      const offset = editorCenterX - viewportCenter;

      setToolbarOffset(offset);

      // 에디터 컨테이너의 실제 너비로 판단 (더 정확함)
      if (editorContainer) {
        const containerWidth = editorContainer.getBoundingClientRect().width;
        setIsToolbarHiddenByWidth(containerWidth < 800);
      } else {
        // fallback: availableWidth에서 좌우 마진 48px 제외
        const editorContentWidth = availableWidth - 48;
        setIsToolbarHiddenByWidth(editorContentWidth < 800);
      }
    };

    // 즉시 한 번 실행
    updateToolbarPosition();

    // transition이 완료된 후에도 한 번 더 실행 (300ms 후)
    const timeoutId = setTimeout(updateToolbarPosition, 350);

    window.addEventListener('resize', updateToolbarPosition);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateToolbarPosition);
    };
  }, [isSearchOpen, isDocumentListOpen]);

  // 목차 실시간 업데이트
  useEffect(() => {
    if (!editor) return;

    const updateTOC = () => {
      const headings: Array<{ level: number; text: string; pos: number }> = [];
      
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          headings.push({
            level: node.attrs.level,
            text: node.textContent,
            pos: pos
          });
        }
      });

      setTableOfContents(headings);
    };

    // 초기 목차 생성
    updateTOC();

    // 에디터 내용 변경 시 목차 업데이트
    const handleUpdate = () => {
      updateTOC();
    };

    editor.on('update', handleUpdate);

    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor]);

  // 쿠키에 에디터 상태 저장
  const saveEditorStateToCookie = () => {
    if (!editor) return;

    const editorState = {
      tabs: tabs.map(tab => ({
        ...tab,
        // 현재 활성 탭이면 최신 에디터 내용으로 업데이트
        content: tab.id === activeTabId ? editor.getHTML() : tab.content
      })),
      activeTabId,
    };

    // 쿠키에 저장 (7일 유효)
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7);
    document.cookie = `editorState=${encodeURIComponent(JSON.stringify(editorState))}; expires=${expirationDate.toUTCString()}; path=/`;
  };

  // 쿠키에서 에디터 상태 로드
  const loadEditorStateFromCookie = () => {
    const cookies = document.cookie.split('; ');
    const editorStateCookie = cookies.find(cookie => cookie.startsWith('editorState='));
    
    if (editorStateCookie) {
      try {
        const editorStateStr = decodeURIComponent(editorStateCookie.split('=')[1]);
        const editorState = JSON.parse(editorStateStr);
        
        if (editorState.tabs && editorState.tabs.length > 0) {
          setTabs(editorState.tabs);
          setActiveTabId(editorState.activeTabId || editorState.tabs[0].id);
          
          // 활성 탭의 내용을 에디터에 로드
          const activeTab = editorState.tabs.find((tab: DocumentTab) => tab.id === editorState.activeTabId);
          if (activeTab && editor) {
            editor.commands.setContent(activeTab.content || '<p></p>');
          }
          return true;
        }
      } catch (error) {
        console.error('쿠키에서 에디터 상태 로드 실패:', error);
      }
    }
    return false;
  };

  // 컴포넌트 마운트 시 쿠키에서 상태 복원
  useEffect(() => {
    if (isEditorReady && editor && !documentId) {
      // documentId가 없을 때만 쿠키에서 복원 (새 문서 작성 중일 때)
      loadEditorStateFromCookie();
    }
  }, [isEditorReady, editor, documentId]);

  // 탭이나 에디터 내용이 변경될 때마다 쿠키에 자동 저장 (디바운스 적용)
  useEffect(() => {
    if (!editor || !isEditorReady) return;

    const timeoutId = setTimeout(() => {
      saveEditorStateToCookie();
    }, 1000); // 1초 디바운스

    return () => clearTimeout(timeoutId);
  }, [tabs, activeTabId, editor?.state.doc, isEditorReady]);

  // 문서 목록 사이드바 상태 변경 시 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('isDocumentListOpen', JSON.stringify(isDocumentListOpen));
  }, [isDocumentListOpen]);

  // 좌측 사이드바 탭 상태 변경 시 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('leftSidebarTab', JSON.stringify(leftSidebarTab));
  }, [leftSidebarTab]);

  // 검색 사이드바 열림/닫힘 상태 변경 시 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('isSearchOpen', JSON.stringify(isSearchOpen));
  }, [isSearchOpen]);

  // 에디터가 준비된 후 문서 로딩
  useEffect(() => {
    if (isEditorReady && editor) {
      if (documentId) {
        getDocument(documentId).then((doc) => {
          if (doc) {
            setTitle(doc.title);
            // 마크다운을 HTML로 변환해서 로드
            const htmlContent = markdownToHtml(doc.content);
            editor.commands.setContent(htmlContent);
            // 첫 번째 탭의 documentId 설정
            setTabs(tabs.map((tab, index) => 
              index === 0 ? { ...tab, documentId: documentId, content: htmlContent, title: doc.title } : tab
            ));
            onDirtyChange?.(false);
          }
        });
      } else {
        setTitle('Untitled Document');
        editor.commands.setContent('');
        onDirtyChange?.(false);
      }
    }
  }, [isEditorReady, editor, documentId, onDirtyChange]);

  // 클릭 아웃사이드 처리 - 슬래시 메뉴 닫기
  useEffect(() => {
    if (!showSlashMenu || !editor?.view?.dom) return;

    let menuJustOpened = true;
    
    // 메뉴가 열린 후 짧은 시간 동안 클릭을 무시
    const timer = setTimeout(() => {
      menuJustOpened = false;
    }, 100);

    const handleClickOutside = (event: MouseEvent) => {
      if (showSlashMenu && !menuJustOpened) {
        const target = event.target as Element;
        const slashMenu = document.querySelector('.slash-menu');
        const editorElement = editor.view.dom;

        // 슬래시 메뉴와 에디터 외부를 클릭한 경우 메뉴 닫기
        if (slashMenu && !slashMenu.contains(target) && editorElement && !editorElement.contains(target)) {
          setShowSlashMenu(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSlashMenu, editor]);

  // 슬래시 메뉴 키보드 네비게이션
  useEffect(() => {
    if (!showSlashMenu || !editor?.view?.dom) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!showSlashMenu) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedMenuIndex(prev =>
            prev < slashMenuItems.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedMenuIndex(prev =>
            prev > 0 ? prev - 1 : slashMenuItems.length - 1
          );
          break;
        case 'Enter':
          event.preventDefault();
          if (slashMenuItems[selectedMenuIndex]) {
            handleSlashMenuSelect(slashMenuItems[selectedMenuIndex]);
          }
          break;
        case 'Escape':
          event.preventDefault();
          setShowSlashMenu(false);
          break;
        case 'Backspace':
        case 'Delete':
          // "/" 문자가 삭제되었는지 확인
          setTimeout(() => {
            if (!editor?.view?.dom) return;

            const { state } = editor;
            const { selection } = state;
            const { $anchor } = selection;
            const currentLineText = $anchor.nodeBefore?.text || '';

            // "/"로 시작하지 않으면 메뉴 닫기
            if (!currentLineText.startsWith('/')) {
              setShowSlashMenu(false);
            }
          }, 10);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSlashMenu, selectedMenuIndex, editor]);

  // 선택된 메뉴 아이템으로 스크롤
  useEffect(() => {
    if (showSlashMenu) {
      const selectedItem = document.querySelector('.slash-menu-item.selected') as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [selectedMenuIndex, showSlashMenu]);

  // 슬래시 메뉴 상태에 따라 에디터 편집 가능 상태 제어
  useEffect(() => {
    if (editor) {
      editor.setEditable(true); // 항상 편집 가능하게 두되, 키보드 이벤트로 제어
    }
  }, [editor]);

  // 슬래시 메뉴가 열려있을 때 텍스트 입력 방지
  useEffect(() => {
    if (!showSlashMenu) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // 메뉴가 열려있는 동안 허용할 키들
      const allowedKeys = [
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', // 방향키
        'Enter', 'Escape', 'Backspace', 'Delete', // 제어키
        'Tab', 'Home', 'End', 'PageUp', 'PageDown' // 이동키
      ];

      // Ctrl/Cmd + 키 조합 허용 (복사, 붙여넣기 등)
      if (event.ctrlKey || event.metaKey) {
        return;
      }

      // 허용되지 않은 키는 막음 (텍스트 입력 방지)
      if (!allowedKeys.includes(event.key) && event.key.length === 1) {
        event.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true); // 캡처 단계에서 이벤트 처리

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [showSlashMenu]);

  // selectionPreviewImage가 변경될 때 부모 컴포넌트에 알림
  useEffect(() => {
    onSelectionPreviewChange?.(selectedTextForAI?.text ?? null);
    onSelectionRangeChange?.(selectedTextForAI ? { from: selectedTextForAI.from, to: selectedTextForAI.to } : null);
  }, [selectedTextForAI, onSelectionPreviewChange, onSelectionRangeChange]);

  // 선택된 영역을 마크다운으로 가져오는 함수
  const getSelectionAsMarkdown = (from: number, to: number): string => {
    if (!editor) return '';
    
    try {
      const results: string[] = [];
      let inHeading = false;
      let headingLevel = 0;
      let inListItem = false;
      let listType = '';
      let listLevel = 0;
      
      editor.state.doc.nodesBetween(from, to, (node, pos) => {
        const nodeStart = pos;
        const nodeEnd = pos + node.nodeSize;
        
        // 선택 범위와 겹치는지 확인
        if (nodeEnd < from || nodeStart > to) {
          return false;
        }
        
        // 블록 시작 처리
        if (node.type.name === 'heading') {
          headingLevel = node.attrs.level || 1;
          inHeading = true;
          results.push('\n' + '#'.repeat(headingLevel) + ' ');
          return true;
        }
        
        if (node.type.name === 'paragraph') {
          if (results.length > 0 && !inListItem && !results[results.length - 1].endsWith('\n\n')) {
            results.push('\n\n');
          }
          return true;
        }
        
        if (node.type.name === 'bulletList') {
          listLevel++;
          listType = 'bullet';
          return true;
        }
        
        if (node.type.name === 'orderedList') {
          listLevel++;
          listType = 'ordered';
          return true;
        }
        
        if (node.type.name === 'listItem') {
          const indent = '  '.repeat(listLevel - 1);
          if (results.length > 0 && !results[results.length - 1].endsWith('\n')) {
            results.push('\n');
          }
          if (listType === 'ordered') {
            results.push(indent + '1. ');
          } else {
            results.push(indent + '- ');
          }
          inListItem = true;
          return true;
        }
        
        if (node.type.name === 'codeBlock') {
          results.push('\n```\n');
          const text = node.textContent;
          results.push(text);
          results.push('\n```\n');
          return false;
        }
        
        if (node.type.name === 'blockquote') {
          results.push('\n> ');
          return true;
        }
        
        if (node.type.name === 'hardBreak') {
          results.push('  \n');
          return false;
        }
        
        // 텍스트 노드 처리
        if (node.isText) {
          const start = Math.max(from, nodeStart);
          const end = Math.min(to, nodeEnd);
          
          if (start < end) {
            let text = node.text?.substring(start - nodeStart, end - nodeStart) || '';
            
            // 마크 적용
            node.marks.forEach((mark: any) => {
              if (mark.type.name === 'bold') {
                text = `**${text}**`;
              } else if (mark.type.name === 'italic') {
                text = `*${text}*`;
              } else if (mark.type.name === 'code') {
                text = `\`${text}\``;
              } else if (mark.type.name === 'link') {
                const href = mark.attrs.href || '';
                text = `[${text}](${href})`;
              } else if (mark.type.name === 'strike') {
                text = `~~${text}~~`;
              }
            });
            
            results.push(text);
          }
        }
        
        // 블록 종료 처리
        if (nodeEnd <= to) {
          if (node.type.name === 'heading') {
            inHeading = false;
            results.push('\n');
          }
          if (node.type.name === 'listItem') {
            inListItem = false;
          }
          if (node.type.name === 'bulletList' || node.type.name === 'orderedList') {
            listLevel--;
            if (listLevel === 0) {
              listType = '';
            }
          }
        }
        
        return true;
      });
      
      return results.join('').trim();
    } catch (error) {
      console.error('Error getting selection as markdown:', error);
      // 실패하면 기본 텍스트 반환
      return editor.state.doc.textBetween(from, to);
    }
  };

  const markdownToHtml = (markdown: string): string => {
    // marked 라이브러리를 사용해서 마크다운을 HTML로 변환
    return marked(markdown) as string;
  };

  const htmlToMarkdown = (html: string): string => {
    // turndown 라이브러리를 사용해서 HTML을 마크다운으로 변환
    const turndownService = new TurndownService();
    return turndownService.turndown(html);
  };

  const slashMenuItems = [
    { label: '제목 1', icon: 'H1', action: () => insertHeading(1) },
    { label: '제목 2', icon: 'H2', action: () => insertHeading(2) },
    { label: '제목 3', icon: 'H3', action: () => insertHeading(3) },
    { label: '코드 블럭', icon: '```', action: () => insertCodeBlock() },
    { label: '인용구', icon: '"', action: () => insertBlockquote() },
    { label: '구분선', icon: '—', action: () => insertHorizontalRule() },
    { label: '글머리 기호 목록', icon: '•', action: () => insertBulletList() },
    { label: '번호 목록', icon: '1.', action: () => insertOrderedList() },
    { label: '체크리스트', icon: '☑', action: () => editor?.chain().focus().toggleTaskList().run() },
    { label: '이미지', icon: '🖼', action: () => handleImageInsert() },
    { label: '링크', icon: '🔗', action: () => handleLinkInsert() },
  ];

  const insertHeading = (level: number) => {
    if (!editor) return;

    const { state } = editor;
    const { selection } = state;
    const { $anchor } = selection;

    // 현재 줄의 시작과 끝 찾기
    const startOfLine = $anchor.start();
    const endOfLine = $anchor.end();

    // "/"로 시작하는 현재 줄을 삭제하고 헤딩 삽입
    editor.chain()
      .focus()
      .deleteRange({ from: startOfLine, to: endOfLine })
      .setHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 })
      .run();

    setShowSlashMenu(false);
  };

  const insertCodeBlock = () => {
    if (!editor) return;

    const { state } = editor;
    const { selection } = state;
    const { $anchor } = selection;

    // 현재 줄의 시작과 끝 찾기
    const startOfLine = $anchor.start();
    const endOfLine = $anchor.end();

    // "/"로 시작하는 현재 줄을 삭제하고 코드블럭 삽입
    editor.chain()
      .focus()
      .deleteRange({ from: startOfLine, to: endOfLine })
      .setCodeBlock()
      .run();

    setShowSlashMenu(false);
  };

  const insertBlockquote = () => {
    if (!editor) return;

    const { state } = editor;
    const { selection } = state;
    const { $anchor } = selection;

    // 현재 줄의 시작과 끝 찾기
    const startOfLine = $anchor.start();
    const endOfLine = $anchor.end();

    // "/"로 시작하는 현재 줄을 삭제하고 인용구 삽입
    editor.chain()
      .focus()
      .deleteRange({ from: startOfLine, to: endOfLine })
      .setBlockquote()
      .run();

    setShowSlashMenu(false);
  };

  const insertHorizontalRule = () => {
    if (!editor) return;

    const { state } = editor;
    const { selection } = state;
    const { $anchor } = selection;

    // 현재 줄의 시작과 끝 찾기
    const startOfLine = $anchor.start();
    const endOfLine = $anchor.end();

    // "/"로 시작하는 현재 줄을 삭제하고 구분선 삽입
    editor.chain()
      .focus()
      .deleteRange({ from: startOfLine, to: endOfLine })
      .setHorizontalRule()
      .run();

    setShowSlashMenu(false);
  };

  const insertBulletList = () => {
    if (!editor) return;

    const { state } = editor;
    const { selection } = state;
    const { $anchor } = selection;

    // 현재 줄의 시작과 끝 찾기
    const startOfLine = $anchor.start();
    const endOfLine = $anchor.end();

    // "/"로 시작하는 현재 줄을 삭제하고 글머리 기호 목록 삽입
    editor.chain()
      .focus()
      .deleteRange({ from: startOfLine, to: endOfLine })
      .toggleBulletList()
      .run();

    setShowSlashMenu(false);
  };

  const insertOrderedList = () => {
    if (!editor) return;

    const { state } = editor;
    const { selection } = state;
    const { $anchor } = selection;

    // 현재 줄의 시작과 끝 찾기
    const startOfLine = $anchor.start();
    const endOfLine = $anchor.end();

    // "/"로 시작하는 현재 줄을 삭제하고 번호 목록 삽입
    editor.chain()
      .focus()
      .deleteRange({ from: startOfLine, to: endOfLine })
      .toggleOrderedList()
      .run();

    setShowSlashMenu(false);
  };

  const handleSlashMenuSelect = (item: typeof slashMenuItems[0]) => {
    item.action();
  };

  // 탭 관리 함수들
  const handleTabClick = (tabId: string) => {
    if (!editor) return;

    // 현재 활성 탭의 내용 저장 (변경사항이 있는 경우에만)
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (currentTab) {
      const currentHtml = editor.getHTML();
      const hasChanges = currentTab.content !== currentHtml;
      
      if (hasChanges) {
        // 변경사항이 있는 경우에만 탭 내용 업데이트
        setTabs(tabs.map(tab => 
          tab.id === currentTab.id 
            ? { 
                ...tab, 
                content: currentHtml,
                isActive: false 
              }
            : { 
                ...tab, 
                isActive: tab.id === tabId 
              }
        ));
      } else {
        // 변경사항이 없는 경우 isActive만 업데이트
        setTabs(tabs.map(tab => ({
          ...tab,
          isActive: tab.id === tabId
        })));
      }
    }

    // 새 탭 활성화
    setActiveTabId(tabId);
    const newActiveTab = tabs.find(t => t.id === tabId);
    
    if (newActiveTab) {
      // 탭 내용 로드
      if (newActiveTab.contentType === 'markdown') {
        // Markdown인 경우 HTML로 변환하여 표시
        try {
          const htmlContent = markdownToHtml(newActiveTab.content);
          editor.commands.setContent(htmlContent);
        } catch (error) {
          console.error('Error rendering markdown:', error);
          editor.commands.setContent(newActiveTab.content);
        }
      } else {
        // HTML인 경우 그대로 표시
        editor.commands.setContent(newActiveTab.content || '');
      }
      
      // 타이틀 업데이트
      setTitle(newActiveTab.title);
      
      // 스크롤 맨 위로 이동
      window.scrollTo(0, 0);
    }
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (tabs.length === 1) {
      toast.error('마지막 탭은 닫을 수 없습니다.');
      return;
    }

    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      // 현재 에디터의 내용 가져오기
      const currentContent = editor?.getHTML() || '';
      
      // 원본 내용과 현재 내용 비교 (앞뒤 공백 제거 후 비교)
      const hasUnsavedChanges = currentContent.trim() !== tab.content.trim();
      
      // 변경사항이 있는 경우에만 확인 모달 표시
      if (hasUnsavedChanges) {
        setTabToClose(tabId);
        setIsTabCloseConfirmModalOpen(true);
        return;
      }
    }

    // 변경사항이 없으면 바로 닫기
    performCloseTab(tabId);
  };

  const performCloseTab = (tabId: string) => {
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);

    // 닫힌 탭이 활성 탭이었다면 인접한 탭 활성화
    if (tabId === activeTabId) {
      const newActiveIndex = tabIndex > 0 ? tabIndex - 1 : 0;
      const newActiveTab = newTabs[newActiveIndex];
      setActiveTabId(newActiveTab.id);
      if (editor) {
        editor.commands.setContent(newActiveTab.content);
        setTitle(newActiveTab.title);
      }
    }

    setTabs(newTabs);
  };

  const handleTabCloseConfirm = (action: 'delete' | 'save' | 'cancel') => {
    if (!tabToClose) return;

    switch (action) {
      case 'delete':
        performCloseTab(tabToClose);
        break;
      case 'save':
        // 저장 기능은 나중에 구현
        performCloseTab(tabToClose);
        break;
      case 'cancel':
        // 아무것도 하지 않음
        break;
    }

    setIsTabCloseConfirmModalOpen(false);
    setTabToClose(null);
  };

  const handleAddTab = () => {
    const newTabId = Date.now().toString();
    const newTab: DocumentTab = {
      id: newTabId,
      title: 'Untitled Document',
      content: '',
      isActive: false
    };

    // 현재 활성 탭의 내용 저장
    if (editor) {
      const htmlContent = editor.getHTML();
      setTabs([
        ...tabs.map(tab => ({ ...tab, content: tab.id === activeTabId ? htmlContent : tab.content, isActive: false })),
        newTab
      ]);
    }

    // 새 탭 활성화
    setActiveTabId(newTabId);
    setTitle('Untitled Document');
    if (editor) {
      editor.commands.setContent('');
    }
  };

  // 탭 제목 변경 시 탭 목록도 업데이트
  useEffect(() => {
    setTabs(tabs.map(tab => 
      tab.id === activeTabId ? { ...tab, title } : tab
    ));
  }, [title]);

  // 드래그 앤 드롭 핸들러
  const handleDragStart = (tabId: string) => {
    setDraggedTabId(tabId);
  };

  const handleDragOver = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();
    
    if (!draggedTabId || draggedTabId === targetTabId) return;

    const draggedIndex = tabs.findIndex(tab => tab.id === draggedTabId);
    const targetIndex = tabs.findIndex(tab => tab.id === targetTabId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newTabs = [...tabs];
    const [draggedTab] = newTabs.splice(draggedIndex, 1);
    newTabs.splice(targetIndex, 0, draggedTab);

    setTabs(newTabs);
  };

  const handleDragEnd = () => {
    setDraggedTabId(null);
  };

  // 검색 기능
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim() || !editor) {
      setSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }

    const content = editor.getText();
    const results: Array<{ index: number; text: string }> = [];
    const lowerQuery = query.toLowerCase();
    let index = 0;

    while (index < content.length) {
      const foundIndex = content.toLowerCase().indexOf(lowerQuery, index);
      if (foundIndex === -1) break;

      const start = Math.max(0, foundIndex - 20);
      const end = Math.min(content.length, foundIndex + query.length + 20);
      const contextText = content.substring(start, end);

      results.push({
        index: foundIndex,
        text: contextText
      });

      index = foundIndex + 1;
    }

    setSearchResults(results);
    setCurrentSearchIndex(0);
  };

  const handleSearchNavigation = (direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;

    let newIndex = currentSearchIndex;
    if (direction === 'next') {
      newIndex = (currentSearchIndex + 1) % searchResults.length;
    } else {
      newIndex = currentSearchIndex === 0 ? searchResults.length - 1 : currentSearchIndex - 1;
    }

    setCurrentSearchIndex(newIndex);
    
    // 에디터에서 해당 위치로 스크롤
    if (editor && searchResults[newIndex]) {
      const pos = searchResults[newIndex].index;
      editor.commands.setTextSelection({ from: pos, to: pos + searchQuery.length });
      editor.commands.focus();
    }
  };

  // 목차 생성 함수
  const generateTableOfContents = () => {
    if (!editor) return [];

    const headings: Array<{ level: number; text: string; pos: number }> = [];
    
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        headings.push({
          level: node.attrs.level,
          text: node.textContent,
          pos: pos
        });
      }
    });

    return headings;
  };

  // 파일 제목 변경 핸들러
  const handleRenameFile = () => {
    setNewTitle(title);
    setIsRenameModalOpen(true);
  };

  // 파일 제목 변경 확인 핸들러
  const handleRenameConfirm = async () => {
    if (newTitle && newTitle !== title) {
      // 제목 업데이트
      setTitle(newTitle);
      
      // 탭 제목도 업데이트
      const updatedTabs = tabs.map(tab => 
        tab.id === activeTabId ? { ...tab, title: newTitle } : tab
      );
      setTabs(updatedTabs);
      
      // 문서 저장
      try {
        const currentTab = updatedTabs.find(tab => tab.id === activeTabId);
        if (currentTab) {
          const markdownContent = editor ? htmlToMarkdown(editor.getHTML()) : '';
          const now = new Date();
          await saveDocument({
            id: documentId || activeTabId,
            title: newTitle,
            content: markdownContent,
            contentType: 'markdown',
            updatedAt: now,
            createdAt: now, // 기존 문서가 있다면 createdAt은 유지되어야 하지만, 간단화를 위해 현재 시간으로 설정
          });
          toast.success('파일 제목이 변경되어 저장되었습니다.');
        }
      } catch (error) {
        console.error('파일 저장 중 오류 발생:', error);
        toast.error('파일 저장 중 오류가 발생했습니다.');
      }
    }
    setIsRenameModalOpen(false);
  };

  // 파일 제목 변경 취소 핸들러
  const handleRenameCancel = () => {
    setIsRenameModalOpen(false);
  };

  // 파일 내보내기 핸들러
  const handleExportFile = () => {
    const content = editor?.getHTML() || '';
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'untitled'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('파일이 다운로드되었습니다.');
  };

  // 파일 복사하기 핸들러
  const handleDuplicateFile = () => {
    const newTab = {
      id: Date.now().toString(),
      title: `${title} (복사본)`,
      content: editor?.getHTML() || '',
      isActive: true
    };
    
    setTabs(prevTabs => 
      prevTabs.map(tab => ({ ...tab, isActive: false }))
        .concat(newTab)
    );
    setActiveTabId(newTab.id);
    toast.success('파일이 복사되었습니다.');
  };

  // 파일 삭제하기 핸들러
  const handleDeleteFile = () => {
    if (tabs.length <= 1) {
      toast.error('마지막 탭은 삭제할 수 없습니다.');
      return;
    }

    const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
    const newTabs = tabs.filter(tab => tab.id !== activeTabId);
    
    // 삭제 후 활성화할 탭 결정 (이전 탭 또는 다음 탭)
    let newActiveTabId = '';
    if (currentIndex > 0) {
      newActiveTabId = tabs[currentIndex - 1].id;
    } else if (tabs.length > 1) {
      newActiveTabId = tabs[1].id;
    }

    setTabs(newTabs);
    setActiveTabId(newActiveTabId);
    toast.success('파일이 삭제되었습니다.');
  };

  const handleSave = async () => {
    if (!editor) return;

    try {
      // Get the current tab to check content type
      const currentTab = tabs.find(tab => tab.id === activeTabId);
      if (!currentTab) {
        toast.error('저장할 탭을 찾을 수 없습니다.');
        return;
      }
      
      // Get content based on type
      let contentToSave: string;
      if (currentTab.contentType === 'markdown') {
        // For markdown, convert HTML back to markdown for storage
        const htmlContent = editor.getHTML();
        contentToSave = htmlToMarkdown(htmlContent);
      } else {
        // For HTML, store as is
        contentToSave = editor.getHTML();
      }

      // Use existing document ID if available, otherwise create new one
      const docId = currentTab.documentId || Date.now().toString();
      
      // Prepare document data
      const now = new Date();
      const doc: Document = {
        id: docId,
        title: title || 'Untitled Document',
        content: contentToSave,
        contentType: currentTab.contentType || 'html',
        createdAt: now,
        updatedAt: now,
      };

      // Save to database
      await saveDocument(doc);
      
      // Update the tab with saved content and document ID
      const updatedTabs = tabs.map(tab => 
        tab.id === activeTabId 
          ? { 
              ...tab, 
              content: contentToSave, 
              title: doc.title, 
              documentId: docId,
              contentType: (currentTab.contentType || 'html') as 'markdown' | 'html'
            }
          : tab
      );
      
      setTabs(updatedTabs);
      
      // Call callbacks
      onSave?.(doc);
      onDirtyChange?.(false);
      
      // Refresh document list
      documentListSidebarRef.current?.refreshDocuments();
      
      toast.success('저장이 완료되었습니다');
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error('저장 중 오류가 발생했습니다.');
    }
  };

  const handleAIResearch = async () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = getSelectionAsMarkdown(from, to);
    if (!selectedText.trim()) {
      toast.error('연구할 텍스트를 선택해주세요.');
      return;
    }

    setSelectedTextForAI({ from, to, text: selectedText });
    setIsAiLoading(true);
    try {
      const response = await researchTopic(selectedText);
      setAiResponse(response);
    } catch (error) {
      console.error('AI research error:', error);
      toast.error('AI 연구에 실패했습니다. API 키가 유효한지 확인해주세요.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAIAnalyze = async () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = getSelectionAsMarkdown(from, to);
    if (!selectedText.trim()) {
      toast.error('분석할 텍스트를 선택해주세요.');
      return;
    }

    setSelectedTextForAI({ from, to, text: selectedText });
    setIsAiLoading(true);
    try {
      const response = await analyzeText(selectedText);
      setAiResponse(response);
    } catch (error) {
      console.error('AI analyze error:', error);
      toast.error('AI 분석에 실패했습니다. API 키가 유효한지 확인해주세요.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAIPersonaFeedback = async () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = getSelectionAsMarkdown(from, to);
    if (!selectedText.trim()) {
      toast.error('피드백을 받을 텍스트를 선택해주세요.');
      return;
    }

    // 선택된 텍스트 저장
    setSelectedTextForAI({ from, to, text: selectedText });
    // 페르소나 입력 모달 열기
    setPersona('');
    setShowPersonaModal(true);
  };

  const handleAIAnswer = async () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = getSelectionAsMarkdown(from, to);
    if (!selectedText.trim()) {
      toast.error('답변을 받을 질문을 선택해주세요.');
      return;
    }

    setSelectedTextForAI({ from, to, text: selectedText });
    setIsAiLoading(true);
    try {
      const response = await answerQuestion(selectedText);
      setAiResponse(response);
    } catch (error) {
      console.error('AI answer error:', error);
      toast.error('AI 답변에 실패했습니다. API 키가 유효한지 확인해주세요.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleImageInsert = () => {
    if (!editor) return;

    // 이미지 URL 입력 모달 열기
    setShowImageUrlModal(true);
  };

  const handleImageUrlConfirm = () => {
    if (!editor || !imageUrl.trim()) return;

    // 이미지 삽입 - TipTap Image 확장 사용
    editor.chain().focus().insertContent({
      type: 'image',
      attrs: {
        src: imageUrl.trim(),
      },
    }).run();

    // 모달 닫기 및 상태 초기화
    setShowImageUrlModal(false);
    setImageUrl('');
  };

  const handleImageUrlCancel = () => {
    setShowImageUrlModal(false);
    setImageUrl('');
  };

  const handleLinkUrlConfirm = () => {
    if (!editor || !linkUrl.trim()) return;

    // 선택된 텍스트 확인
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to);

    // 선택된 텍스트가 있으면 그 텍스트에 링크 적용, 없으면 URL을 텍스트로 사용
    const linkText = selectedText || linkUrl.trim();

    if (selectedText) {
      // 선택된 텍스트에 링크 적용
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl.trim() }).run();
    } else {
      // 새 텍스트 삽입 후 링크 적용
      editor.chain().focus().insertContent({
        type: 'text',
        text: linkText,
        marks: [{
          type: 'link',
          attrs: { href: linkUrl.trim() },
        }],
      }).run();
    }

    // 모달 닫기 및 상태 초기화
    setShowLinkUrlModal(false);
    setLinkUrl('');
  };

  const handleLinkUrlCancel = () => {
    setShowLinkUrlModal(false);
    setLinkUrl('');
  };

  const handlePersonaConfirm = async () => {
    if (!persona.trim() || !selectedTextForAI) return;

    setIsAiLoading(true);
    setShowPersonaModal(false);
    
    try {
      const response = await generatePersonaFeedback(selectedTextForAI.text, persona.trim());
      setAiResponse(response);
    } catch (error) {
      console.error('AI feedback error:', error);
      toast.error('AI 피드백에 실패했습니다. API 키가 유효한지 확인해주세요.');
    } finally {
      setIsAiLoading(false);
      setPersona('');
    }
  };

  const handlePersonaCancel = () => {
    setShowPersonaModal(false);
    setPersona('');
  };

  const handleLinkInsert = () => {
    if (!editor) return;

    // 선택된 텍스트 확인
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to);

    // 링크 모달 열기
    setLinkUrl('');
    setShowLinkUrlModal(true);
  };

  const copyAIResponse = () => {
    navigator.clipboard.writeText(aiResponse).then(() => {
      toast.success('AI 응답이 클립보드에 복사되었습니다.');
    }).catch(err => {
      console.error('클립보드 복사 실패:', err);
      toast.error('복사에 실패했습니다.');
    });
  };

  const applyAIResponse = () => {
    if (!editor || !aiResponse || !selectedTextForAI) return;

    const htmlContent = markdownToHtml(aiResponse);

    // 선택된 텍스트를 AI 응답으로 교체
    editor.chain()
      .setTextSelection({ from: selectedTextForAI.from, to: selectedTextForAI.to })
      .insertContent(htmlContent)
      .run();

    setAiResponse('');
    setSelectedTextForAI(null);
    toast.success('AI 응답이 적용되었습니다.');
  };

  useImperativeHandle(ref, () => ({
    handleSave,
    saveEditorStateToCookie,
    replaceSelection: (text: string) => {
      if (editor) {
        editor.chain().focus().insertContent(text).run();
      }
    },
    highlightSelection: (from: number, to: number) => {
      if (editor) {
        // AI 선택 범위를 트랜잭션 메타데이터로 전달
        const tr = editor.state.tr.setMeta('aiSelection', { from, to });
        editor.view.dispatch(tr);
      }
    },
    clearHighlight: () => {
      if (editor) {
        // 하이라이트 제거
        const tr = editor.state.tr.setMeta('aiSelection', null);
        editor.view.dispatch(tr);
      }
    },
  }));

  if (!editor) {
    return null;
  }

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* 탭 헤더 */}
      <TabHeader
        tabs={tabs}
        activeTabId={activeTabId}
        onTabClick={handleTabClick}
        onCloseTab={(id, e) => handleCloseTab(id, e)}
        onAddTab={handleAddTab}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      />
      
      {/* 헤더 메뉴 */}
      <HeaderMenu
        onSave={handleSave}
        leftSidebarTab={leftSidebarTab}
        onSearchClick={() => {
          if (leftSidebarTab === 'search') {
            setLeftSidebarTab(null);
            setIsSearchOpen(false);
          } else {
            setLeftSidebarTab('search');
            setIsSearchOpen(true);
          }
        }}
        onTocClick={() => {
          if (leftSidebarTab === 'toc') {
            setLeftSidebarTab(null);
            setIsSearchOpen(false);
          } else {
            setLeftSidebarTab('toc');
            setIsSearchOpen(true);
          }
        }}
        onRenameFile={handleRenameFile}
        onExportFile={handleExportFile}
        onDuplicateFile={handleDuplicateFile}
        onDeleteFile={handleDeleteFile}
        isDocumentListOpen={isDocumentListOpen}
        onDocumentListToggle={() => setIsDocumentListOpen(!isDocumentListOpen)}
      />
      
      {/* 메인 컨텐츠 영역 - 좌측 사이드바와 에디터 */}
      <div className="flex-1 flex relative min-h-0">
        {/* 문서 목록 사이드바 */}
        <DocumentListSidebar
          ref={documentListSidebarRef}
          isOpen={isDocumentListOpen}
          onClose={() => setIsDocumentListOpen(false)}
          onDocumentSelect={async (doc) => {
            try {
              // Check if the document is already open in a tab
              const existingTab = tabs.find(tab => tab.documentId === doc.id);
              
              if (existingTab) {
                // If the document is already open, switch to that tab
                setTabs(prevTabs => 
                  prevTabs.map(tab => ({
                    ...tab,
                    isActive: tab.id === existingTab.id
                  }))
                );
                setActiveTabId(existingTab.id);
                setTitle(doc.title || 'Untitled Document');
                
                // Load the document content
                const loadedDoc = await getDocument(doc.id);
                if (loadedDoc && editor) {
                  // Convert markdown to HTML if needed
                  const content = loadedDoc.contentType === 'markdown' 
                    ? markdownToHtml(loadedDoc.content) 
                    : loadedDoc.content;
                  editor.commands.setContent(content);
                }
              } else {
                // If the document is not open, load it and create a new tab
                const loadedDoc = await getDocument(doc.id);
                
                if (loadedDoc) {
                  const newTabId = Date.now().toString();
                  const newTab = {
                    id: newTabId,
                    title: loadedDoc.title || 'Untitled Document',
                    content: loadedDoc.content,
                    isActive: true,
                    documentId: loadedDoc.id
                  };
                  
                  // Add the new tab and make it active
                  setTabs(prevTabs => [
                    ...prevTabs.map(tab => ({ ...tab, isActive: false })),
                    newTab
                  ]);
                  
                  setActiveTabId(newTabId);
                  setTitle(loadedDoc.title || 'Untitled Document');
                  
                  // Set the editor content
                  if (editor) {
                    // Convert markdown to HTML if needed
                    const content = loadedDoc.contentType === 'markdown' 
                      ? markdownToHtml(loadedDoc.content) 
                      : loadedDoc.content;
                    editor.commands.setContent(content);
                  }
                }
              }
              
              // Keep the document list open after selection
              // Removed: setIsDocumentListOpen(false);
            } catch (error) {
              console.error('Error loading document:', error);
              toast.error('문서를 불러오는 중 오류가 발생했습니다.');
            }
          }}
          onDocumentDelete={async (docId) => {
            try {
              // Delete the document from the database
              await deleteDocument(docId);
              
              // If the deleted document is currently open, close its tab
              if (tabs.some(tab => tab.documentId === docId)) {
                const tabToRemove = tabs.find(tab => tab.documentId === docId);
                if (tabToRemove) {
                  // If it's the active tab, switch to another tab
                  if (activeTabId === tabToRemove.id) {
                    const currentIndex = tabs.findIndex(tab => tab.id === tabToRemove.id);
                    let newActiveTabId = '';
                    
                    if (tabs.length > 1) {
                      if (currentIndex > 0) {
                        newActiveTabId = tabs[currentIndex - 1].id;
                      } else if (tabs.length > 1) {
                        newActiveTabId = tabs[1].id;
                      }
                    }
                    
                    setActiveTabId(newActiveTabId);
                  }
                  
                  // Remove the tab
                  setTabs(prevTabs => prevTabs.filter(tab => tab.id !== tabToRemove.id));
                }
              }
              
              toast.success('문서가 삭제되었습니다.');
            } catch (error) {
              console.error('문서 삭제 중 오류 발생:', error);
              toast.error('문서 삭제 중 오류가 발생했습니다.');
            }
          }}
        />
        
        {/* 검색/목차 사이드바 */}
        <LeftSidebar
          isOpen={isSearchOpen}
          activeTab={leftSidebarTab}
          searchQuery={searchQuery}
          searchResults={searchResults}
          currentSearchIndex={currentSearchIndex}
          tableOfContents={tableOfContents}
          editor={editor}
          onClose={() => {
            setIsSearchOpen(false);
            setLeftSidebarTab(null);
          }}
          onSearchChange={handleSearch}
          onSearchNavigation={handleSearchNavigation}
          onSearchResultClick={(index) => {
            setCurrentSearchIndex(index);
            if (editor && searchResults[index]) {
              const pos = searchResults[index].index;
              editor.commands.setTextSelection({ from: pos, to: pos + searchQuery.length });
              editor.commands.focus();
            }
          }}
          onTocItemClick={(pos) => {
            if (editor) {
              editor.commands.setTextSelection({ from: pos, to: pos });
              editor.commands.focus();
            }
          }}
        />
      
        {/* 에디터 영역 */}
        <div 
          id="editor-container" 
          className="flex-1 mx-6 mt-4 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg flex flex-col focus-within:ring-1 focus-within:ring-opacity-30 focus-within:ring-blue-300 dark:focus-within:ring-blue-700 focus-within:border-blue-300 dark:focus-within:border-blue-500 mb-6 transition-all duration-200 min-h-0"
          style={{'--tw-ring-color': 'rgba(99, 102, 241, 0.3)'} as React.CSSProperties}
        >
        
          {/* 에디터 컨텐츠 영역 */}
          <div className="flex-1 min-h-0 cursor-text relative overflow-y-auto" onClick={() => editor?.commands.focus()}>
        {!isEditorReady ? (
          <div className="flex flex-col items-center justify-center h-full p-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">에디터를 로딩 중...</p>
          </div>
        ) : (
          <EditorContent 
            editor={editor} 
            className="h-full [&_.ProseMirror]:outline-none [&_.ProseMirror]:leading-relaxed [&_.ProseMirror]:text-sm sm:[&_.ProseMirror]:text-base [&_.ProseMirror]:max-w-none [&_.ProseMirror]:border-0 [&_.ProseMirror]:focus:outline-none [&_.ProseMirror]:p-6 [&_.ProseMirror]:min-h-full [&_.ProseMirror]:overflow-y-visible [&_.ProseMirror]:pb-32" 
          />
        )}
        
        {showSlashMenu && isEditorReady && (
          <div
            className="absolute bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg py-2 z-50 max-h-64 overflow-y-auto"
            style={{
              top: slashMenuPosition.top,
              left: slashMenuPosition.left,
            }}
          >
            {slashMenuItems.map((item, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  index === selectedMenuIndex ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                }`}
                onClick={() => handleSlashMenuSelect(item)}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
      </div>

      {/* 파일 이름 변경 모달 */}
      <RenameModal
        isOpen={isRenameModalOpen}
        title="파일 이름 변경"
        label="새 파일 이름"
        placeholder="파일 이름을 입력하세요"
        value={newTitle}
        onChange={setNewTitle}
        onConfirm={handleRenameConfirm}
        onCancel={handleRenameCancel}
      />

      {/* 탭 닫기 확인 모달 */}
      <TabCloseConfirmModal
        isOpen={isTabCloseConfirmModalOpen}
        onDelete={() => handleTabCloseConfirm('delete')}
        onSave={() => handleTabCloseConfirm('save')}
        onCancel={() => handleTabCloseConfirm('cancel')}
      />

      {isAiLoading && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-6 mb-4 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            {/* 애니메이션 아이콘 */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full opacity-20 animate-ping"></div>
              <div className="relative p-3 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full">
                <Robot className="w-6 h-6 text-white animate-pulse" />
              </div>
            </div>
            
            {/* 로딩 메시지 */}
            <div className="flex-1">
              <p className="text-gray-900 dark:text-gray-100 font-semibold m-0 mb-1">
                AI가 응답을 생성하고 있습니다
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-sm m-0">
                잠시만 기다려주세요...
              </p>
            </div>
            
            {/* 점 애니메이션 */}
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      )}
      {aiResponse && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-6 mb-4 backdrop-blur-sm">
          {/* 헤더 영역 */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg">
                <Robot className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 m-0">
                AI 응답
              </h3>
            </div>
            <button 
              onClick={() => setAiResponse('')} 
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              disabled={isAiLoading}
            >
              <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* 컨텐츠 영역 */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 mb-4">
            <div className="text-gray-800 dark:text-gray-200 prose dark:prose-invert max-w-none prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-code:text-purple-600 dark:prose-code:text-purple-400" 
                 dangerouslySetInnerHTML={{ __html: markdownToHtml(aiResponse) }} />
          </div>
          
          {/* 액션 버튼 영역 */}
          <div className="flex gap-2">
            <button 
              onClick={applyAIResponse} 
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg text-sm font-semibold cursor-pointer transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm flex items-center justify-center gap-2" 
              disabled={isAiLoading}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              에디터에 적용
            </button>
            <button 
              onClick={copyAIResponse} 
              className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-semibold cursor-pointer transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm flex items-center justify-center gap-2" 
              disabled={isAiLoading}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              복사
            </button>
          </div>
        </div>
      )}
      <RenameModal
        title="이미지 URL 입력"
        label="이미지 URL"
        placeholder="https://example.com/image.jpg"
        value={imageUrl}
        isOpen={showImageUrlModal}
        onChange={setImageUrl}
        onConfirm={handleImageUrlConfirm}
        onCancel={handleImageUrlCancel}
      />
      <RenameModal
        title="링크 URL 입력"
        label="링크 URL"
        placeholder="https://example.com"
        value={linkUrl}
        isOpen={showLinkUrlModal}
        onChange={setLinkUrl}
        onConfirm={handleLinkUrlConfirm}
        onCancel={handleLinkUrlCancel}
      />
      <RenameModal
        title="페르소나 입력"
        label="페르소나"
        placeholder='예: "경험 많은 편집자", "마케팅 전문가"'
        value={persona}
        isOpen={showPersonaModal}
        onChange={setPersona}
        onConfirm={handlePersonaConfirm}
        onCancel={handlePersonaCancel}
      />
      
      {/* 플로팅 툴바 - 하단 중앙 고정 (Figma 스타일) - 메뉴 기반 */}
      <FloatingToolbar
        editor={editor}
        isVisible={isToolbarVisible}
        isHiddenByWidth={isToolbarHiddenByWidth}
        activeMenu={activeToolbarMenu}
        toolbarOffset={toolbarOffset}
        isAiLoading={isAiLoading}
        onMenuChange={setActiveToolbarMenu}
        onToggleVisibility={setIsToolbarVisible}
        onLinkInsert={handleLinkInsert}
        onImageInsert={() => {
          setImageUrl('');
          setShowImageUrlModal(true);
        }}
        onAIResearch={handleAIResearch}
        onAIAnalyze={handleAIAnalyze}
        onAIPersonaFeedback={handleAIPersonaFeedback}
        onAIAnswer={handleAIAnswer}
      />
      
      {/* AI 요청 버튼 - 화면 우측 하단 고정 (플로팅 툴바와 같은 높이) */}
      <button
        onClick={() => {
          // AI 버튼 클릭 시 선택된 텍스트를 캡처해서 Taskbar에 전달
          if (editor) {
            try {
              const { from, to } = editor.state.selection;
              const selectedText = getSelectionAsMarkdown(from, to);
              if (selectedText && selectedText.trim()) {
                setSelectedTextForAI({ from, to, text: selectedText });
                onSelectionPreviewChange?.(selectedText);
                onSelectionRangeChange?.({ from, to });
                // AI 버튼 클릭 시 하이라이트 표시
                if (editor) {
                  const tr = editor.state.tr.setMeta('aiSelection', { from, to });
                  editor.view.dispatch(tr);
                }
              } else {
                setSelectedTextForAI(null);
                onSelectionPreviewChange?.(null);
                onSelectionRangeChange?.(null);
              }
            } catch (e) {
              setSelectedTextForAI(null);
              onSelectionPreviewChange?.(null);
              onSelectionRangeChange?.(null);
            }
          }
          onOpenTaskbar?.();
        }}
        className="fixed bottom-12 right-12 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-full p-4 shadow-lg transition-all hover:scale-110 hover:shadow-xl z-50"
        title="AI 어시스턴트"
      >
        <Robot size={24} />
      </button>
    </div>
  );
});

export default Editor;
