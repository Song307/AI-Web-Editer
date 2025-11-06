import React, { useState, forwardRef, useImperativeHandle, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
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
import { researchTopic, analyzeText, generatePersonaFeedback, answerQuestion, analyzeImage, analyzePDFPages } from '../utils/ai';
import toast from 'react-hot-toast';
import RenameModal from './UI/shared/RenameModal';
import AIPopup from './UI/shared/AIPopup';
import TurndownService from 'turndown';
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
  CheckSquare,
  Robot
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

const Editor = forwardRef<{ handleSave: () => void }, EditorProps>(({ onSave, onDirtyChange }, ref) => {
  const { id } = useParams<{ id: string }>();
  const documentId = id;
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
  const [showAIPopup, setShowAIPopup] = useState(false);
  const [selectionPreviewImage, setSelectionPreviewImage] = useState<string | null>(null);

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

  // AI 팝업 메시지 핸들러
  const handleAIPopupMessage = async (message: string, files?: Array<{name: string; type: 'image' | 'pdf'; data: string; size: number; pageCount?: number}>): Promise<string> => {
    try {
      // 파일이 있는 경우 멀티모달 분석
      if (files && files.length > 0) {
        const imageFiles = files.filter(f => f.type === 'image');
        const pdfFiles = files.filter(f => f.type === 'pdf');
        
        let response = '';
        
        // 이미지 분석
        for (const imageFile of imageFiles) {
          const imageResponse = await analyzeImage(imageFile.data, message);
          response += `\n\n### ${imageFile.name} 분석:\n${imageResponse}`;
        }
        
        // PDF 분석
        for (const pdfFile of pdfFiles) {
          try {
            // JSON 문자열에서 페이지 이미지 배열 파싱
            const pageImages = JSON.parse(pdfFile.data) as string[];
            const pdfResponse = await analyzePDFPages(pageImages, message);
            response += `\n\n### ${pdfFile.name} 분석 (${pdfFile.pageCount}페이지):\n${pdfResponse}`;
          } catch (error) {
            console.error('PDF parsing error:', error);
            response += `\n\n### ${pdfFile.name}: PDF 분석 중 오류가 발생했습니다.`;
          }
        }
        
        return response.trim() || '파일 분석을 완료했습니다.';
      }
      
      // 파일이 없는 경우 기존 텍스트 기반 처리
      const documentContext = editor?.getText() || '';
      const contextualPrompt = documentContext 
        ? `문서 컨텍스트:\n${documentContext.slice(0, 500)}...\n\n사용자 질문: ${message}`
        : message;

      // 간단한 질문-답변 형식으로 처리
      const response = await answerQuestion(contextualPrompt);
      return response;
    } catch (error) {
      console.error('AI popup message error:', error);
      throw new Error('AI 응답 생성 중 오류가 발생했습니다.');
    }
  };

  // AI 팝업 열기: 현재 선택된 텍스트가 있으면 preview로 전달
  const openAIPopup = () => {
    setSelectionPreviewImage(null);

    if (editor) {
      try {
        const { from, to } = editor.state.selection;
        const selectedText = editor.state.doc.textBetween(from, to);
        if (selectedText && selectedText.trim()) {
          setSelectedTextForAI({ from, to, text: selectedText });

          // Get HTML with styling from editor
          const selectedHTML = editor.view.domAtPos(from).node.parentElement?.innerHTML || '';
          
          // Try to get styled HTML fragment
          setTimeout(() => {
            try {
              const sel = window.getSelection();
              if (!sel || sel.rangeCount === 0) {
                setSelectionPreviewImage(null);
                return;
              }

              const range = sel.getRangeAt(0);
              const fragment = range.cloneContents();
              const tempDiv = document.createElement('div');
              tempDiv.appendChild(fragment);
              const styledHTML = tempDiv.innerHTML;
              
              // Store the styled HTML as preview
              if (styledHTML && styledHTML.trim()) {
                setSelectionPreviewImage(styledHTML);
              } else {
                setSelectionPreviewImage(null);
              }
            } catch (err) {
              // fallback to text preview only
              setSelectionPreviewImage(null);
            }
          }, 10);
        } else {
          setSelectedTextForAI(null);
        }
      } catch (e) {
        setSelectedTextForAI(null);
      }
    }

    setShowAIPopup(true);
  };

  const clearSelection = () => {
    setSelectionPreviewImage(null);
    setSelectedTextForAI(null);
  };

  useImperativeHandle(ref, () => ({
    handleSave,
  }));

  if (!editor) {
    return null;
  }

  return (
    <div className="flex-1 flex flex-col relative overflow-visible pb-6 min-h-0">
      {/* 헤더 영역 - 고정 */}
      <div className="flex-shrink-0 flex items-center mb-4 gap-3 px-6 pt-5">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 text-xl font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 outline-none transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          placeholder="Document Title"
        />
        <button onClick={handleSave} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md font-semibold cursor-pointer transition-all hover:transform hover:-translate-y-0.5">저장</button>
      </div>
      
      {/* 에디터 영역 - 툴바 포함 */}
      <div className="flex-1 mx-6 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden flex flex-col focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 mb-6">
        
        {/* 툴바 영역 - 에디터 내부 상단 */}
        <div className="flex-shrink-0 flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md cursor-pointer text-sm font-medium transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-500 hover:text-blue-600 ${
            editor.isActive('bold') ? 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600' : ''
          }`}
          title="굵게 (Ctrl+B)"
        >
          <TypeBold size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md cursor-pointer text-sm font-medium transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-500 hover:text-blue-600 ${
            editor.isActive('italic') ? 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600' : ''
          }`}
          title="기울임 (Ctrl+I)"
        >
          <TypeItalic size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md cursor-pointer text-sm font-medium transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-500 hover:text-blue-600 ${
            editor.isActive('strike') ? 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600' : ''
          }`}
          title="취소선"
        >
          <TypeStrikethrough size={16} />
        </button>
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2"></div>
        <button
          onClick={() => {
            editor?.chain().focus().toggleHeading({ level: 1 }).run();
          }}
          className={`px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md cursor-pointer text-sm font-medium transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-500 hover:text-blue-600 ${
            editor?.isActive('heading', { level: 1 }) ? 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600' : ''
          }`}
          title="제목 1"
        >
          <TypeH1 size={16} />
        </button>
        <button
          onClick={() => {
            editor?.chain().focus().toggleHeading({ level: 2 }).run();
          }}
          className={`px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md cursor-pointer text-sm font-medium transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-500 hover:text-blue-600 ${
            editor?.isActive('heading', { level: 2 }) ? 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600' : ''
          }`}
          title="제목 2"
        >
          <TypeH2 size={16} />
        </button>
        <button
          onClick={() => {
            editor?.chain().focus().toggleHeading({ level: 3 }).run();
          }}
          className={`px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md cursor-pointer text-sm font-medium transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-500 hover:text-blue-600 ${
            editor?.isActive('heading', { level: 3 }) ? 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600' : ''
          }`}
          title="제목 3"
        >
          <TypeH3 size={16} />
        </button>
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2"></div>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md cursor-pointer text-sm font-medium transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-500 hover:text-blue-600 ${
            editor.isActive('bulletList') ? 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600' : ''
          }`}
          title="글머리 기호 목록"
        >
          <ListUl size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md cursor-pointer text-sm font-medium transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-500 hover:text-blue-600 ${
            editor.isActive('orderedList') ? 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600' : ''
          }`}
          title="번호 목록"
        >
          <ListOl size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={`px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md cursor-pointer text-sm font-medium transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-500 hover:text-blue-600 ${
            editor.isActive('taskList') ? 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600' : ''
          }`}
          title="체크리스트"
        >
          <CheckSquare size={16} />
        </button>
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2"></div>
        <button
          onClick={handleLinkInsert}
          className={`px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md cursor-pointer text-sm font-medium transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-500 hover:text-blue-600 ${
            editor.isActive('link') ? 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600' : ''
          }`}
          title="링크"
        >
          <Link45deg size={16} />
        </button>
        <button
          onClick={() => {
            setImageUrl('');
            setShowImageUrlModal(true);
          }}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md cursor-pointer text-sm font-medium transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-500 hover:text-blue-600"
          title="이미지 삽입"
        >
          <ImageIcon size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md cursor-pointer text-sm font-medium transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-500 hover:text-blue-600 ${
            editor.isActive('codeBlock') ? 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600' : ''
          }`}
          title="코드 블록"
        >
          <Code size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md cursor-pointer text-sm font-medium transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-500 hover:text-blue-600 ${
            editor.isActive('blockquote') ? 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600' : ''
          }`}
          title="인용구"
        >
          <Quote size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md cursor-pointer text-sm font-medium transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-500 hover:text-blue-600"
          title="구분선"
        >
          <Dash size={16} />
        </button>

        
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2"></div>
     {/* AI 버튼 바 */}
      <div className="flex gap-2">
        <button onClick={handleAIResearch} className={`px-3 py-1.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-md text-sm font-medium cursor-pointer transition-all hover:from-purple-600 hover:to-purple-700 hover:transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none ${isAiLoading ? 'animate-pulse' : ''}`} disabled={isAiLoading}>
          {isAiLoading ? '🔄 연구 중...' : '연구'}
        </button>
        <button onClick={handleAIAnalyze} className={`px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-md text-sm font-medium cursor-pointer transition-all hover:from-blue-600 hover:to-blue-700 hover:transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none ${isAiLoading ? 'animate-pulse' : ''}`} disabled={isAiLoading}>
          {isAiLoading ? '🔄 분석 중...' : '분석'}
        </button>
        <button onClick={handleAIPersonaFeedback} className={`px-3 py-1.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-md text-sm font-medium cursor-pointer transition-all hover:from-green-600 hover:to-green-700 hover:transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none ${isAiLoading ? 'animate-pulse' : ''}`} disabled={isAiLoading}>
          {isAiLoading ? '🔄 피드백 중...' : '피드백'}
        </button>
        <button onClick={handleAIAnswer} className={`px-3 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-md text-sm font-medium cursor-pointer transition-all hover:from-orange-600 hover:to-orange-700 hover:transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none ${isAiLoading ? 'animate-pulse' : ''}`} disabled={isAiLoading}>
          {isAiLoading ? '🔄 답변 중...' : '답변'}
        </button>
      </div>
      </div>
      
      {/* 에디터 컨텐츠 영역 - 툴바 아래 */}
      <div className="flex-1 min-h-0 cursor-text relative overflow-y-auto" onClick={() => editor?.commands.focus()}>
        {!isEditorReady ? (
          <div className="flex flex-col items-center justify-center h-full p-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">에디터를 로딩 중...</p>
          </div>
        ) : (
          <EditorContent 
            editor={editor} 
            className="h-full [&_.ProseMirror]:outline-none [&_.ProseMirror]:leading-relaxed [&_.ProseMirror]:text-sm sm:[&_.ProseMirror]:text-base [&_.ProseMirror]:max-w-none [&_.ProseMirror]:border-0 [&_.ProseMirror]:focus:outline-none [&_.ProseMirror]:p-6 [&_.ProseMirror]:min-h-full [&_.ProseMirror]:overflow-y-visible [&_.ProseMirror]:pb-16" 
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
      
      {/* AI 팝업 */}
      <AIPopup
        isOpen={showAIPopup}
        onClose={() => setShowAIPopup(false)}
        onSendMessage={handleAIPopupMessage}
        selectionPreview={selectionPreviewImage ?? selectedTextForAI?.text ?? null}
        isLoading={isAiLoading}
        onClearSelection={clearSelection}
      />
      
      {/* AI 요청 버튼 - 화면 우측 하단 고정 */}
      <button
        onClick={openAIPopup}
        className="fixed bottom-12 right-12 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-full p-4 shadow-lg transition-all hover:scale-110 hover:shadow-xl z-50"
        title="AI 어시스턴트"
      >
        <Robot size={24} />
      </button>
    </div>
  );
});

export default Editor;
