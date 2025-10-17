import React, { useState, forwardRef, useImperativeHandle, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
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
import { marked } from 'marked';
import { saveDocument, getDocument, Document } from '../utils/db';
import { researchTopic, analyzeText, generatePersonaFeedback, answerQuestion } from '../utils/ai';
import toast from 'react-hot-toast';
import RenameModal from './RenameModal';
import { 
  TypeBold, 
  TypeItalic, 
  TypeStrikethrough, 
  TypeH1, 
  TypeH2, 
  TypeH3, 
  ListUl, 
  ListOl, 
  ListCheck, 
  Link45deg, 
  Image as ImageIcon,
  Code,
  Quote,
  Dash,
  CheckSquare
} from 'react-bootstrap-icons';

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
}

const Editor = forwardRef<{ handleSave: () => void }, EditorProps>(({ documentId, onSave, onDirtyChange }, ref) => {
  const [title, setTitle] = useState('Untitled Document');
  const [aiResponse, setAiResponse] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0);
  const [selectedTextForAI, setSelectedTextForAI] = useState<{ from: number; to: number; text: string } | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [showImageUrlModal, setShowImageUrlModal] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [showLinkUrlModal, setShowLinkUrlModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [persona, setPersona] = useState('');

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

  const markdownToHtml = (markdown: string): string => {
    // 단락 단위로 분리
    const paragraphs = markdown.split(/\n\n+/).filter(p => p.trim());

    return paragraphs.map(paragraph => {
      // 각 단락 내에서 리스트 그룹화
      const lines = paragraph.split('\n');
      let html = '';
      let currentListType = null;
      let listItems = [];

      for (const line of lines) {
        const trimmed = line.trim();

        // 빈 줄 스킵
        if (!trimmed) continue;

        // 리스트 아이템 확인
        const ulMatch = trimmed.match(/^(\*|\-) (.+)$/);
        const olMatch = trimmed.match(/^(\d+)\. (.+)$/);

        if (ulMatch) {
          // UL 리스트 처리
          if (currentListType !== 'ul') {
            // 이전 리스트 닫기
            if (currentListType === 'ol') {
              html += `<ol>${listItems.map(item => `<li>${item}</li>`).join('')}</ol>`;
              listItems = [];
            }
            currentListType = 'ul';
          }
          // 마크다운 요소 변환 후 추가
          const processedItem = ulMatch[2]
            .replace(/\*\*([^*\r\n]+?)\*\*/g, '<strong>$1</strong>')
            .replace(/(^|[^*])\*([^*\r\n]+?)\*([^*]|$)/g, '$1<em>$2</em>$3')
            .replace(/`([^`]+)`/g, '<code>$1</code>');
          listItems.push(processedItem);
        } else if (olMatch) {
          // OL 리스트 처리
          if (currentListType !== 'ol') {
            // 이전 리스트 닫기
            if (currentListType === 'ul') {
              html += `<ul>${listItems.map(item => `<li>${item}</li>`).join('')}</ul>`;
              listItems = [];
            }
            currentListType = 'ol';
          }
          // 마크다운 요소 변환 후 추가
          const processedItem = olMatch[2]
            .replace(/\*\*([^*\r\n]+?)\*\*/g, '<strong>$1</strong>')
            .replace(/(^|[^*])\*([^*\r\n]+?)\*([^*]|$)/g, '$1<em>$2</em>$3')
            .replace(/`([^`]+)`/g, '<code>$1</code>');
          listItems.push(processedItem);
        } else {
          // 리스트가 끝났으면 리스트 HTML 생성
          if (currentListType) {
            if (currentListType === 'ul') {
              html += `<ul>${listItems.map(item => `<li>${item}</li>`).join('')}</ul>`;
            } else {
              html += `<ol>${listItems.map(item => `<li>${item}</li>`).join('')}</ol>`;
            }
            listItems = [];
            currentListType = null;
          }

          // 일반 텍스트 처리
          let processedLine = trimmed
            // 헤딩
            .replace(/^### (.+)$/, '<h3>$1</h3>')
            .replace(/^## (.+)$/, '<h2>$1</h2>')
            .replace(/^# (.+)$/, '<h1>$1</h1>')
            // 굵은 글씨
            .replace(/\*\*([^*\r\n]+?)\*\*/g, '<strong>$1</strong>')
            // 기울임
            .replace(/(^|[^*])\*([^*\r\n]+?)\*([^*]|$)/g, '$1<em>$2</em>$3')
            // 인라인 코드
            .replace(/`([^`]+)`/g, '<code>$1</code>');

          html += processedLine;
        }
      }

      // 마지막 리스트 처리
      if (currentListType) {
        if (currentListType === 'ul') {
          html += `<ul>${listItems.map(item => `<li>${item}</li>`).join('')}</ul>`;
        } else {
          html += `<ol>${listItems.map(item => `<li>${item}</li>`).join('')}</ol>`;
        }
      }

      // 헤딩인 경우 그대로 반환, 아니면 <p>로 감싸기
      if (html.match(/^<h[1-6]>.*<\/h[1-6]>$/)) {
        return html;
      } else {
        return `<p>${html}</p>`;
      }
    }).join('');
  };

  const htmlToMarkdown = (html: string): string => {
    // 간단한 HTML을 마크다운으로 변환
    return html
      .replace(/<h3>(.*?)<\/h3>/gi, '### $1')
      .replace(/<h2>(.*?)<\/h2>/gi, '## $1')
      .replace(/<h1>(.*?)<\/h1>/gi, '# $1')
      .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<em>(.*?)<\/em>/gi, '*$1*')
      .replace(/<s>(.*?)<\/s>/gi, '~~$1~~')
      .replace(/<code>(.*?)<\/code>/gi, '`$1`')
      .replace(/<\/p><p>/gi, '\n\n')
      .replace(/<br>/gi, '\n')
      .replace(/<p>(.*?)<\/p>/gi, '$1');
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

  const handleSave = async () => {
    if (!editor) return;

    const htmlContent = editor.getHTML();
    const markdownContent = htmlToMarkdown(htmlContent);

    const doc: Document = {
      id: documentId || Date.now().toString(),
      title,
      content: markdownContent,
      contentType: 'markdown',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await saveDocument(doc);
    onSave?.(doc);
    onDirtyChange?.(false);
    toast.success('저장이 완료되었습니다');
  };

  const handleAIResearch = async () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to);
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
    const selectedText = editor.state.doc.textBetween(from, to);
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
    const selectedText = editor.state.doc.textBetween(from, to);
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
    const selectedText = editor.state.doc.textBetween(from, to);
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
  }));

  if (!editor) {
    return null;
  }

  return (
    <div className="editor-container">
      <div className="editor-header">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="title-input"
          placeholder="Document Title"
        />
        <button onClick={handleSave} className="save-btn">저장</button>
      </div>
      <div className="toolbar">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`btn ${editor.isActive('bold') ? 'active' : ''}`}
          title="굵게 (Ctrl+B)"
        >
          <TypeBold size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`btn ${editor.isActive('italic') ? 'active' : ''}`}
          title="기울임 (Ctrl+I)"
        >
          <TypeItalic size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`btn ${editor.isActive('strike') ? 'active' : ''}`}
          title="취소선"
        >
          <TypeStrikethrough size={16} />
        </button>
        <div className="toolbar-separator"></div>
        <button
          onClick={() => {
            editor?.chain().focus().toggleHeading({ level: 1 }).run();
          }}
          className={`btn ${editor?.isActive('heading', { level: 1 }) ? 'active' : ''}`}
          title="제목 1"
        >
          <TypeH1 size={16} />
        </button>
        <button
          onClick={() => {
            editor?.chain().focus().toggleHeading({ level: 2 }).run();
          }}
          className={`btn ${editor?.isActive('heading', { level: 2 }) ? 'active' : ''}`}
          title="제목 2"
        >
          <TypeH2 size={16} />
        </button>
        <button
          onClick={() => {
            editor?.chain().focus().toggleHeading({ level: 3 }).run();
          }}
          className={`btn ${editor?.isActive('heading', { level: 3 }) ? 'active' : ''}`}
          title="제목 3"
        >
          <TypeH3 size={16} />
        </button>
        <div className="toolbar-separator"></div>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`btn ${editor.isActive('bulletList') ? 'active' : ''}`}
          title="글머리 기호 목록"
        >
          <ListUl size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`btn ${editor.isActive('orderedList') ? 'active' : ''}`}
          title="번호 목록"
        >
          <ListOl size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={`btn ${editor.isActive('taskList') ? 'active' : ''}`}
          title="체크리스트"
        >
          <CheckSquare size={16} />
        </button>
        <div className="toolbar-separator"></div>
        <button
          onClick={handleLinkInsert}
          className={`btn ${editor.isActive('link') ? 'active' : ''}`}
          title="링크"
        >
          <Link45deg size={16} />
        </button>
        <button
          onClick={() => {
            setImageUrl('');
            setShowImageUrlModal(true);
          }}
          className="btn"
          title="이미지 삽입"
        >
          <ImageIcon size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`btn ${editor.isActive('codeBlock') ? 'active' : ''}`}
          title="코드 블록"
        >
          <Code size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`btn ${editor.isActive('blockquote') ? 'active' : ''}`}
          title="인용구"
        >
          <Quote size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="btn"
          title="구분선"
        >
          <Dash size={16} />
        </button>

        
        <div className="toolbar-separator"></div>
     {/* AI 버튼 바 */}
      <div className="ai-button-bar">
        <button onClick={handleAIResearch} className={`ai-btn ${isAiLoading ? 'loading' : ''}`} disabled={isAiLoading}>
          {isAiLoading ? '🔄 연구 중...' : '연구'}
        </button>
        <button onClick={handleAIAnalyze} className={`ai-btn ${isAiLoading ? 'loading' : ''}`} disabled={isAiLoading}>
          {isAiLoading ? '🔄 분석 중...' : '분석'}
        </button>
        <button onClick={handleAIPersonaFeedback} className={`ai-btn ${isAiLoading ? 'loading' : ''}`} disabled={isAiLoading}>
          {isAiLoading ? '🔄 피드백 중...' : '피드백'}
        </button>
        <button onClick={handleAIAnswer} className={`ai-btn ${isAiLoading ? 'loading' : ''}`} disabled={isAiLoading}>
          {isAiLoading ? '🔄 답변 중...' : '답변'}
        </button>
      </div>
      </div>
      <div className="editor-content-wrapper" onClick={() => editor?.commands.focus()}>
        {!isEditorReady ? (
          <div className="editor-loading">
            <div className="loading-spinner"></div>
            <p>에디터를 로딩 중...</p>
          </div>
        ) : (
          <EditorContent editor={editor} className="editor-content" />
        )}
        {showSlashMenu && isEditorReady && (
          <div
            className="slash-menu"
            style={{
              position: 'absolute',
              top: slashMenuPosition.top,
              left: slashMenuPosition.left,
              zIndex: 9999,
            }}
          >
            {slashMenuItems.map((item, index) => (
              <div
                key={index}
                className={`slash-menu-item ${index === selectedMenuIndex ? 'selected' : ''}`}
                onClick={() => handleSlashMenuSelect(item)}
              >
                <span className="slash-menu-icon">{item.icon}</span>
                <span className="slash-menu-label">{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {isAiLoading && (
        <div className="ai-response">
          <h3>AI 응답 생성 중...</h3>
          <div className="ai-response-content">
            <div className="loading-indicator">
              <div className="loading-spinner"></div>
              <p>AI가 응답을 생성하고 있습니다. 잠시만 기다려주세요.</p>
            </div>
          </div>
        </div>
      )}
      {aiResponse && (
        <div className="ai-response">
          <h3>AI 응답:</h3>
          <div className="ai-response-content" dangerouslySetInnerHTML={{ __html: markdownToHtml(aiResponse) }} />
          <div className="response-actions">
            <button onClick={applyAIResponse} className="btn" disabled={isAiLoading}>에디터에 적용</button>
            <button onClick={copyAIResponse} className="btn" disabled={isAiLoading}>복사</button>
            <button onClick={() => setAiResponse('')} className="btn" disabled={isAiLoading}>닫기</button>
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
    </div>
  );
});

export default Editor;
