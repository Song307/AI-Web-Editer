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
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { marked } from 'marked';
import mermaid from 'mermaid';
import { InlineMath, BlockMath } from 'react-katex';
import Modal from 'react-modal';
import { Table as TableExtension } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import { saveDocument, getDocument, deleteDocument, Document } from '../utils/db';
import PDFViewer from './tools/PDFViewer';
import { researchTopic, analyzeText, generatePersonaFeedback, answerQuestion, analyzeImage, analyzePDFPages } from '../utils/ai';
import toast from 'react-hot-toast';
import TurndownService from 'turndown';
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
            // 그 외의 경우 기존 decoration 유지
            return old;
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

// 마크다운 붙여넣기 및 렌더링 확장 (표, 수식, 머메이드, 동영상 지원)
const MarkdownPasteExtension = Extension.create({
  name: 'markdownPaste',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          transformPastedText(text: string) {
            // 표, 수식, 머메이드, 동영상 등 확장 마크다운 파싱
            let html = marked.parse(text) as string;

            // 수식: $...$ (인라인), $$...$$ (블록)
            html = html.replace(/\$\$(.+?)\$\$/gs, (m, eq) => `<div class="math-block">${eq}</div>`);
            html = html.replace(/\$(.+?)\$/g, (m, eq) => `<span class="math-inline">${eq}</span>`);

            // Mermaid: ```mermaid ... ```
            html = html.replace(/<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g, (m, code) => `<div class="mermaid-block">${code}</div>`);

            // 동영상: iframe 태그 허용
            // 이미 marked가 iframe을 HTML로 변환하므로 별도 처리 불필요

            return html;
          },
        },
      }),
    ];
  },
});

// Focus/Typewriter plugin key
const focusPluginKey = new PluginKey('focusModePlugin');

// Extension to manage dimming/undimming decorations for focus mode
const FocusModeExtension = Extension.create({
  name: 'focusModeExtension',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: focusPluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, old, oldState, newState) {
            const meta = tr.getMeta(focusPluginKey as any);
            if (meta && meta.activeRange) {
              const { from, to } = meta.activeRange;
              // dim entire doc
              const dimAll = Decoration.inline(0, newState.doc.content.size, { class: 'pm-dimmed' });
              // undim active range
              const undim = Decoration.inline(from, to, { class: 'pm-undim' });
              return DecorationSet.create(newState.doc, [dimAll, undim]);
            }
            if (meta && meta.clear) {
              return DecorationSet.empty;
            }
            return old;
          },
        },
        props: {
          decorations(state) {
            // @ts-ignore - plugin instance provided by ProseMirror
            return this.getState(state);
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
  onOpenDocument?: (docId: string) => void;
  onApiReady?: (api: { replaceSelection: (text: string) => void; highlightSelection: (from: number, to: number) => void; clearHighlight: () => void }) => void;
  // optional inputs from Workspace to ensure content displays when Workspace drives tabs
  initialContent?: string;
  initialContentType?: 'markdown' | 'html';
  initialTitle?: string;
  tabs?: any[];
  activeTabId?: string;
  setTabs?: React.Dispatch<React.SetStateAction<any[]>>;
  setActiveTabId?: (id: string) => void;
  file?: File;
  // Taskbar position props for dynamic toolbar positioning
  isRightSidebarOpen?: boolean;
  rightSidebarWidth?: number;
  isFocusMode?: boolean;
  isTypewriterMode?: boolean;
}

const Editor = forwardRef<{ handleSave: () => void; saveEditorStateToCookie: () => void; replaceSelection: (text: string) => void; highlightSelection: (from: number, to: number) => void; clearHighlight: () => void }, EditorProps>(({ onSave, onDirtyChange, onSelectionPreviewChange, onSelectionRangeChange, onOpenTaskbar, onOpenDocument, onApiReady, initialContent, initialContentType, initialTitle, tabs: externalTabs, activeTabId: externalActiveTabId, setTabs: externalSetTabs, setActiveTabId: externalSetActiveTabId, file, isRightSidebarOpen = false, rightSidebarWidth = 320, isFocusMode = false, isTypewriterMode = false }, ref) => {
  const { id } = useParams<{ id: string }>();
  const documentId = id;
  const [title, setTitle] = useState('Untitled Document');
  const [tabs, setTabs] = useState<DocumentTab[]>(() => {
    if (externalTabs && externalTabs.length > 0) {
      return externalTabs;
    }
    return [
      { id: '1', title: 'Untitled Document', content: '', isActive: true, documentId: documentId || undefined }
    ];
  });
  const [activeTabId, setActiveTabId] = useState(() => {
    return externalActiveTabId || '1';
  });
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
  const [highlightDisabled, setHighlightDisabled] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [showImageUrlModal, setShowImageUrlModal] = useState(false);

  // DocumentListSidebar ref
  const documentListSidebarRef = useRef<DocumentListSidebarRef>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [showLinkUrlModal, setShowLinkUrlModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  // Table hover controls (add row/column) overlay
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const [showTableControls, setShowTableControls] = useState(false);
  const [tableControlPos, setTableControlPos] = useState<{
    rightLeft: number;
    rightTop: number;
    bottomLeft: number;
    bottomTop: number;
  } | null>(null);
  const [hoveredCellRect, setHoveredCellRect] = useState<DOMRect | null>(null);
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [persona, setPersona] = useState('');
  const [activeToolbarMenu, setActiveToolbarMenu] = useState<'text' | 'insert' | 'ai'>('text');
  const [isToolbarVisible, setIsToolbarVisible] = useState(() => {
    // 로컬 스토리지에서 툴바 표시 상태 불러오기, 기본값은 true
    const saved = localStorage.getItem('isToolbarVisible');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // 툴바 표시 상태를 로컬 스토리지에 저장
  useEffect(() => {
    localStorage.setItem('isToolbarVisible', JSON.stringify(isToolbarVisible));
  }, [isToolbarVisible]);

  // externalTabs와 externalActiveTabId가 변경될 때 내부 상태 동기화
  useEffect(() => {
    if (externalTabs && externalTabs.length > 0) {
      setTabs(externalTabs);
    }
  }, [externalTabs]);

  useEffect(() => {
    if (externalActiveTabId && externalActiveTabId !== activeTabId) {
      setActiveTabId(externalActiveTabId);
    }
  }, [externalActiveTabId]);

  const [isPdfFile, setIsPdfFile] = useState(false);
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [isEquationModalOpen, setIsEquationModalOpen] = useState(false);
  const [isTableInsertModalOpen, setIsTableInsertModalOpen] = useState(false);

  // 선택 메뉴 상태
  const [showSelectionMenu, setShowSelectionMenu] = useState(false);
  const [selectionMenuPos, setSelectionMenuPos] = useState({ x: 0, y: 0 });
  const [selectedTextForContext, setSelectedTextForContext] = useState('');
  const [showMenuPopup, setShowMenuPopup] = useState(false);
  const [showTranslationModal, setShowTranslationModal] = useState(false);
  const [translationResult, setTranslationResult] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      Heading.configure({ levels: [1, 2, 3] }),
      BulletList.configure({ keepMarks: true, keepAttributes: false }),
      OrderedList.configure({ keepMarks: true, keepAttributes: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: true, allowBase64: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'link' } }),
      ListItem,
      Placeholder.configure({ placeholder: '내용을 입력하세요... ("/"를 눌러 블럭 추가)' }),
      MarkdownPasteExtension,
  AISelectionHighlight,
  FocusModeExtension,
      // 표 확장: @tiptap/extension-table
      TableExtension.configure({
        resizable: true,
        HTMLAttributes: {
          // table-fixed + w-full: make table occupy the full content width
          // border on table + borders on cells to ensure a clear outline and grid
          class: 'w-full table-fixed border-collapse border border-gray-200 dark:border-gray-700 my-4 rounded-md overflow-hidden',
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: 'border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          // give header cells full borders so outer outline is visible
          class: 'px-4 py-2 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 font-medium',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          // ensure each cell has a full bor  der so vertical and horizontal lines show
          class: 'px-4 py-2 border border-gray-200 dark:border-gray-700',
        },
      }),
      // 수식/머메이드/동영상은 렌더링에서 처리
    ],
    content: '<p></p>',
    onUpdate: ({ editor }) => { onDirtyChange?.(true); },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;

      // Handle selection menu only when a non-empty selection exists
      if (from === to) {
        setShowSelectionMenu(false);
        setShowMenuPopup(false);
      } else {
        const selectedText = editor.state.doc.textBetween(from, to);
        if (!selectedText.trim()) {
          setShowSelectionMenu(false);
        } else {
          setSelectedTextForContext(selectedText);
          // 선택된 텍스트의 좌표 가져오기
          try {
            const coords = editor.view.coordsAtPos(from);
            setSelectionMenuPos({
              x: coords.left - 10, // 약간 왼쪽으로
              y: coords.top - 30, // 위쪽으로
            });
            setShowSelectionMenu(true);
          } catch (e) {
            console.error('Selection menu position error:', e);
            setShowSelectionMenu(false);
          }
        }
      }

      // Focus Mode: dim when focus mode is enabled. Apply only after the user
      // has explicitly interacted (clicked) so that initially entering a document
      // does NOT dim everything. If there's a selection, undim that selection;
      // if there's only a caret (from === to) undim the current block.
      try {
        if (isFocusMode && editor.view && userInteractedRef.current) {
          if (from === to) {
            const { $from } = editor.state.selection as any;
            const start = $from.start($from.depth);
            const end = $from.end($from.depth);
            const tr = editor.state.tr.setMeta(focusPluginKey as any, { activeRange: { from: start, to: end } });
            editor.view.dispatch(tr);
          } else {
            const tr = editor.state.tr.setMeta(focusPluginKey as any, { activeRange: { from, to } });
            editor.view.dispatch(tr);
          }
        } else if (editor.view) {
          // Clear decorations when not focus-mode or before user interacted
          const tr = editor.state.tr.setMeta(focusPluginKey as any, { clear: true });
          editor.view.dispatch(tr);
        }
      } catch (err) {
        console.error('Focus mode plugin error:', err);
      }

      // Typewriter Mode: keep the active line vertically centered
      try {
        if (isTypewriterMode && editor.view) {
          const pos = editor.state.selection.from;
          const coords = editor.view.coordsAtPos(pos);
          const scroller = editor.view.dom.parentElement as HTMLElement | null;
          if (coords && scroller) {
            const target = coords.top + scroller.scrollTop - scroller.clientHeight / 2;
            scroller.scrollTo({ top: target, behavior: 'smooth' });
          }
        }
      } catch (err) {
        console.error('Typewriter mode scroll error:', err);
      }
    },
    onFocus: ({ editor }) => {
      try {
        if (isFocusMode && editor.view && userInteractedRef.current) {
          const { from, to } = editor.state.selection;
          if (from === to) {
            const { $from } = editor.state.selection as any;
            const start = $from.start($from.depth);
            const end = $from.end($from.depth);
            const tr = editor.state.tr.setMeta(focusPluginKey as any, { activeRange: { from: start, to: end } });
            editor.view.dispatch(tr);
          } else {
            const tr = editor.state.tr.setMeta(focusPluginKey as any, { activeRange: { from, to } });
            editor.view.dispatch(tr);
          }
        }
      } catch (err) {
        console.error('Focus mode onFocus error:', err);
      }
    },
    onBlur: ({ editor }) => {
      try {
        if (editor.view) {
          const tr = editor.state.tr.setMeta(focusPluginKey as any, { clear: true });
          editor.view.dispatch(tr);
          // reset user interaction so re-entering does not auto-apply focus decorations
          userInteractedRef.current = false;
        }
      } catch (err) {
        console.error('Focus mode onBlur error:', err);
      }
    },
    onCreate: ({ editor }) => { setIsEditorReady(true); },
    onDestroy: () => {},
  });
  // Track whether the user has interacted (clicked/touched) inside the editor.
  // We only apply focus-mode dimming after an explicit user interaction so that
  // entering a document does not immediately dim everything.
  const userInteractedRef = useRef(false);

  useEffect(() => {
    if (!editor || !editor.view) return;
    const node = editor.view.dom as HTMLElement;
    const onPointerDown = () => {
      userInteractedRef.current = true;
    };
    node.addEventListener('pointerdown', onPointerDown);
    return () => {
      node.removeEventListener('pointerdown', onPointerDown);
    };
  }, [editor]);
// 마크다운 렌더링 컴포넌트 (표, 수식, 머메이드, 동영상, 코드)
const MarkdownRenderer = ({ html }: { html: string }) => {
  // 수식 렌더링
  const renderMath = (node: Element) => {
    if (node.classList.contains('math-block')) {
      return <BlockMath math={node.textContent || ''} />;
    }
    if (node.classList.contains('math-inline')) {
      return <InlineMath math={node.textContent || ''} />;
    }
    return null;
  };

  // Mermaid 렌더링 (노션 스타일: 코드/렌더링 토글)
  const MermaidRenderer = ({ code }: { code: string }) => {
    const [showCode, setShowCode] = useState(false);
    const [svg, setSvg] = useState('');
    useEffect(() => {
      if (!showCode) {
        try {
          mermaid.render('mermaid-svg-' + Math.random(), code).then((result) => {
            setSvg(result.svg);
          });
        } catch (error) {
          console.error('Mermaid rendering error:', error);
          setSvg('<div class="text-red-500">다이어그램 렌더링 오류</div>');
        }
      }
    }, [code, showCode]);
    return (
      <div className="mermaid-block">
        <div className="flex gap-2 mb-2">
          <button onClick={() => setShowCode(false)} className={!showCode ? 'font-bold' : ''}>다이어그램</button>
          <button onClick={() => setShowCode(true)} className={showCode ? 'font-bold' : ''}>코드</button>
        </div>
        {showCode ? (
          <SyntaxHighlighter language="mermaid">{code}</SyntaxHighlighter>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        )}
      </div>
    );
  };

  // 동영상 렌더링
  const renderIframe = (node: Element) => {
    if (node.tagName === 'IFRAME') {
      return (
        <iframe
          src={node.getAttribute('src') || ''}
          width={node.getAttribute('width') || '560'}
          height={node.getAttribute('height') || '315'}
          frameBorder={node.getAttribute('frameborder') || '0'}
          allowFullScreen
          title="Embedded content"
        />
      );
    }
    return null;
  };

  // 표 렌더링 (Notion 스타일)
  const renderTable = (node: Element) => {
    if (node.tagName === 'TABLE') {
      const rows = Array.from(node.children).filter(child => child.tagName === 'TR');
      if (rows.length === 0) return null;

      const headerRow = rows[0];
      const bodyRows = rows.slice(1);

      return (
        <div className="my-8 not-prose">
          {/* wrapper: use group so hover can reveal controls */}
          <div className="overflow-visible rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-sm relative group notion-table-wrapper">
            <table className="w-full border-collapse notion-table">
              {headerRow && (
                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b-2 border-gray-300 dark:border-gray-600">
                  <tr>
                    {Array.from(headerRow.children).map((cell, j) => (
                      <th key={j} className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100 first:pl-6 last:pr-6 border-r border-gray-300 dark:border-gray-600 last:border-r-0">
                        {cell.textContent}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              {bodyRows.length > 0 && (
                <tbody>
                  {bodyRows.map((row, i) => (
                    <tr key={i} className="group border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                      {Array.from(row.children).map((cell, j) => (
                        <td key={j} className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 first:pl-6 last:pr-6 border-r border-gray-200 dark:border-gray-700 last:border-r-0">
                          <div className="flex items-center min-h-[2rem]">
                            <span className="flex-1">{cell.textContent}</span>
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                  {/* 새 행 추가 버튼 */}
                  <tr className="border-t border-dashed border-gray-400 dark:border-gray-500">
                    <td colSpan={headerRow.children.length} className="px-4 py-3">
                      <button className="flex items-center space-x-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-150">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-sm">새 행 추가</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              )}
            </table>

            {/* Bottom border area: a border-like area under the table for hover controls */}
            <div className="border-t-2 border-gray-300 dark:border-gray-600 mt-2 pt-2 pb-2 flex justify-end group">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!editor) return;
                  const wrapper = (e.currentTarget as HTMLElement).closest('.notion-table-wrapper');
                  const tableEl = wrapper?.querySelector('table');
                  // pick a cell from the last row
                  const rows = tableEl?.querySelectorAll('tr');
                  const lastRow = rows && rows.length ? rows[rows.length - 1] : null;
                  const cell = lastRow?.querySelector('td,th');
                  if (!cell) return;
                  try {
                    const posInfo = (editor.view as any).posAtDOM(cell, 0);
                    if (!posInfo || typeof posInfo.pos !== 'number') return;
                    editor.chain().focus().setTextSelection({ from: posInfo.pos, to: posInfo.pos }).addRowAfter().run();
                  } catch (err) {
                    console.error('Failed to add row', err);
                  }
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 w-8 h-8 bg-gray-800/90 text-white rounded-md flex items-center justify-center shadow-md border border-gray-700"
                title="행 추가"
              >
                <span className="text-lg font-semibold">+</span>
              </button>
            </div>

          </div>
        </div>
      );
    }
    return null;
  };

  // HTML 파싱 및 각 기능별 렌더링
  const parseHtml = (html: string) => {
    const container = document.createElement('div');
    container.innerHTML = html;
    const nodes: React.ReactNode[] = [];
    container.childNodes.forEach((node) => {
      if (node.nodeType === 1) {
        const el = node as Element;
        if (el.classList.contains('math-block') || el.classList.contains('math-inline')) nodes.push(renderMath(el));
        else if (el.classList.contains('mermaid-block')) nodes.push(<MermaidRenderer code={el.textContent || ''} />);
        else if (el.tagName === 'IFRAME') nodes.push(renderIframe(el));
        else if (el.tagName === 'TABLE') nodes.push(renderTable(el));
        else nodes.push(React.createElement(el.tagName.toLowerCase(), {}, el.textContent));
      } else if (node.nodeType === 3) {
        nodes.push(node.textContent);
      }
    });
    return nodes;
  };

  return <div>{parseHtml(html)}</div>;
};

// 수식 입력 모달 (Word/한글 스타일)
const EquationInputModal = ({ isOpen, onClose, onInsert }: { isOpen: boolean; onClose: () => void; onInsert: (latex: string, isBlock: boolean) => void }) => {
  const [input, setInput] = useState('');
  const [isBlock, setIsBlock] = useState(false);
  return (
    <Modal isOpen={isOpen} onRequestClose={onClose} contentLabel="수식 입력" style={{ content: { maxWidth: 500, margin: 'auto' } }}>
      <h2>수식 입력 (LaTeX)</h2>
      <div className="mb-4">
        <label className="flex items-center gap-2">
          <input type="radio" checked={!isBlock} onChange={() => setIsBlock(false)} />
          인라인 수식 ($...$)
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={isBlock} onChange={() => setIsBlock(true)} />
          블록 수식 ($$...$$)
        </label>
      </div>
      <input value={input} onChange={e => setInput(e.target.value)} className="w-full border p-2 mb-2" placeholder="예: E=mc^2" />
      <div className="border p-2 mb-2 min-h-[40px] flex items-center justify-center">
        {input && (isBlock ? <BlockMath math={input} /> : <InlineMath math={input} />)}
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose}>취소</button>
        <button onClick={() => { onInsert(input, isBlock); onClose(); setInput(''); }} className="bg-blue-500 text-white px-3 py-1 rounded">삽입</button>
      </div>
    </Modal>
  );
};

const TableInsertModal = ({ isOpen, onClose, onInsert }: { isOpen: boolean; onClose: () => void; onInsert: (rows: number, cols: number) => void }) => {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);

  const handleInsert = () => {
    onInsert(rows, cols);
    onClose();
    setRows(3);
    setCols(3);
  };

  return (
    <Modal isOpen={isOpen} onRequestClose={onClose} contentLabel="표 삽입" style={{ content: { maxWidth: 400, margin: 'auto' } }}>
      <h2 className="text-lg font-semibold mb-4">표 크기 설정</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">행 수</label>
          <input
            type="number"
            min="1"
            max="20"
            value={rows}
            onChange={(e) => setRows(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">열 수</label>
          <input
            type="number"
            min="1"
            max="20"
            value={cols}
            onChange={(e) => setCols(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="text-sm text-gray-600">
          {rows}행 × {cols}열 표가 생성됩니다.
        </div>
      </div>
      <div className="flex gap-2 justify-end mt-6">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          취소
        </button>
        <button
          onClick={handleInsert}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
        >
          표 삽입
        </button>
      </div>
    </Modal>
  );
};

  // If Workspace is providing tabs/activeTabId, treat them as the single source of truth.
  const currentTabs = externalTabs ?? tabs;
  const currentActiveTabId = externalActiveTabId ?? activeTabId;

  const updateTabs = (updater: React.SetStateAction<any[]>) => {
    if (externalSetTabs) {
      externalSetTabs(updater as any);
    } else {
      setTabs(prev => typeof updater === 'function' ? (updater as (prev: any[]) => any[])(prev) : updater as any[]);
    }
  };

  const updateActiveTabId = (id: string) => {
    if (externalSetActiveTabId) externalSetActiveTabId(id);
    else setActiveTabId(id);
  };

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
      // 에디터가 준비되지 않았으면 실행하지 않음
      if (!isEditorReady) return;

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
        const shouldHide = containerWidth < 500;
        setIsToolbarHiddenByWidth(shouldHide);
      } else {
        // fallback: availableWidth에서 좌우 마진 48px 제외
        const editorContentWidth = availableWidth - 48;
        const shouldHide = editorContentWidth < 500;
        setIsToolbarHiddenByWidth(shouldHide);
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
  }, [isSearchOpen, isDocumentListOpen, isEditorReady]);

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
      tabs: (currentTabs || []).map((tab: any) => ({
        ...tab,
        // 현재 활성 탭이면 최신 에디터 내용으로 업데이트
        content: tab.id === currentActiveTabId ? editor.getHTML() : tab.content
      })),
      activeTabId: currentActiveTabId,
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
          updateTabs(editorState.tabs);
          updateActiveTabId(editorState.activeTabId || editorState.tabs[0].id);
          
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

  // Mermaid 초기화
  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: 'default' });
  }, []);

  // 수식 모달 이벤트 리스너
  useEffect(() => {
    const handleOpenEquationModal = () => {
      setIsEquationModalOpen(true);
    };

    window.addEventListener('openEquationModal', handleOpenEquationModal);
    return () => {
      window.removeEventListener('openEquationModal', handleOpenEquationModal);
    };
  }, []);

  // 표 삽입 모달 이벤트 리스너
  useEffect(() => {
    const handleOpenTableInsertModal = () => {
      setIsTableInsertModalOpen(true);
    };

    window.addEventListener('openTableInsertModal', handleOpenTableInsertModal);
    return () => {
      window.removeEventListener('openTableInsertModal', handleOpenTableInsertModal);
    };
  }, []);

  // Mouse tracking for table controls overlay
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    let lastTable: HTMLElement | null = null;

    const onMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const cell = target.closest('td,th') as HTMLElement | null;
      if (!cell) {
        if (lastTable) {
          lastTable = null;
          setShowTableControls(false);
          setTableControlPos(null);
          setHoveredCellRect(null);
        }
        return;
      }

      const table = cell.closest('table') as HTMLElement | null;
      if (!table) return;
      lastTable = table;
      const tableRect = table.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();

      // compute button positions relative to container
      const rightLeft = Math.round(tableRect.right - containerRect.left - 20);
      const rightTop = Math.round(tableRect.top - containerRect.top + tableRect.height / 2 - 16);
      const bottomLeft = Math.round(tableRect.left - containerRect.left + tableRect.width / 2 - 16);
      const bottomTop = Math.round(tableRect.bottom - containerRect.top - 20);

      setTableControlPos({ rightLeft, rightTop, bottomLeft, bottomTop });
      setHoveredCellRect(cellRect);
      setShowTableControls(true);
    };

    const onLeave = () => {
      setShowTableControls(false);
      setTableControlPos(null);
      setHoveredCellRect(null);
    };

    container.addEventListener('mousemove', onMove);
    container.addEventListener('mouseleave', onLeave);
    return () => {
      container.removeEventListener('mousemove', onMove);
      container.removeEventListener('mouseleave', onLeave);
    };
  }, [editorContainerRef]);

  // 표 삽입 핸들러
  const handleTableInsert = (rows: number, cols: number) => {
    if (!editor) return;

    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: false }).run();
  };

  // 수식 삽입 핸들러
  const handleEquationInsert = (latex: string, isBlock: boolean = false) => {
    if (!editor) return;
    editor.chain().focus().insertContent({ type: isBlock ? 'mathBlock' : 'mathInline', attrs: { latex } }).run();
  };

  // 선택 메뉴 핸들러
  const handleSelectionMenu = () => {
    setShowMenuPopup(true);
  };

  const handleSelectionMenuClose = () => {
    setShowMenuPopup(false);
  };

  // 선택 메뉴 옵션 핸들러들
  const handleTranslate = async () => {
    if (!selectedTextForContext) return;
    console.log('번역 요청:', selectedTextForContext);
    // AI로 번역 요청 (영어 -> 한국어 가정)
    const prompt = `다음 텍스트를 한국어로 번역하세요. 짧고 직접적인 번역만 제공하세요: "${selectedTextForContext}"`;
    try {
      const response = await answerQuestion(prompt);
      console.log('번역 응답:', response);
      setTranslationResult(response);
      setShowTranslationModal(true);
      console.log('모달 열기 시도');
    } catch (error) {
      console.error('번역 실패:', error);
      toast.error('번역 실패: ' + (error as Error).message);
    }
    handleSelectionMenuClose();
  };

  const handleAIRequest = () => {
    if (!selectedTextForContext) return;
    setSelectedTextForAI({ from: 0, to: 0, text: selectedTextForContext }); // 임시
    setHighlightDisabled(false);
    onOpenTaskbar?.();
    handleSelectionMenuClose();
  };

  const handleHyperlink = () => {
    if (!selectedTextForContext) return;
    setLinkUrl('');
    setShowLinkUrlModal(true);
    handleSelectionMenuClose();
  };

  const handleCopy = async () => {
    if (!selectedTextForContext) return;
    try {
      await navigator.clipboard.writeText(selectedTextForContext);
      toast.success('복사되었습니다');
    } catch (error) {
      toast.error('복사 실패');
    }
    handleSelectionMenuClose();
  };

  const handleDelete = () => {
    if (!editor) return;
    editor.chain().focus().deleteSelection().run();
    handleSelectionMenuClose();
  };

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
      // If Workspace passed an initialContent (active tab content), prefer that immediately
      if (initialContent != null) {
        if (initialContentType === 'markdown') {
          try {
            editor.commands.setContent(marked(initialContent) as string);
          } catch (err) {
            console.error('초기 마크다운 변환 실패:', err);
            editor.commands.setContent(initialContent);
          }
        } else {
          editor.commands.setContent(initialContent);
        }
        if (initialTitle) setTitle(initialTitle);
        return;
      }
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

  // 선택 메뉴 이벤트 리스너 제거 (onSelectionUpdate에서 처리)

  // 파일 업로드 처리
  useEffect(() => {
    if (file && editor) {
      const fileType = file.type;
      const fileName = file.name;
      
      if (fileType === 'application/pdf') {
        // PDF 파일 처리
        const reader = new FileReader();
        reader.onload = (e) => {
          const pdfDataUrl = e.target?.result as string;
          setPdfData(pdfDataUrl);
          setIsPdfFile(true);
          setUploadedFileName(fileName);
          setTitle(fileName);
        };
        reader.readAsDataURL(file);
      } else if (fileType.startsWith('image/')) {
        // 이미지 파일 처리
        const reader = new FileReader();
        reader.onload = (e) => {
          const imageData = e.target?.result as string;
          const imageHtml = `<div class="image-container">
            <img src="${imageData}" alt="${fileName}" style="max-width: 100%; height: auto;" />
            <p>이미지 파일: ${fileName}</p>
          </div>`;
          editor.commands.setContent(imageHtml);
          setTitle(fileName);
          setIsPdfFile(false);
          setPdfData(null);
        };
        reader.readAsDataURL(file);
      }
    }
  }, [file, editor]);

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
    console.log('Editor: useEffect triggered by selectedTextForAI change, selectedTextForAI =', selectedTextForAI);
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
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });

    // 기본적으로 표를 마크다운으로 변환하도록 설정
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
    const currentTab = currentTabs.find((t: any) => t.id === currentActiveTabId);
    if (currentTab) {
      const currentHtml = editor.getHTML();
      const hasChanges = (currentTab.content || '') !== currentHtml;
      
      if (hasChanges) {
        // 변경사항이 있는 경우에만 탭 내용 업데이트
        updateTabs((prev: any[]) => (prev || currentTabs).map(tab => 
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
        updateTabs((prev: any[]) => (prev || currentTabs).map(tab => ({
          ...tab,
          isActive: tab.id === tabId
        })));
      }
    }

    // 새 탭 활성화
    updateActiveTabId(tabId);
    const newActiveTab = (currentTabs || []).find((t: any) => t.id === tabId);
    
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
    if ((currentTabs || []).length === 1) {
      toast.error('마지막 탭은 닫을 수 없습니다.');
      return;
    }

    const tab = (currentTabs || []).find((t: any) => t.id === tabId);
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
    const tabIndex = (currentTabs || []).findIndex((t: any) => t.id === tabId);
    const newTabs = (currentTabs || []).filter((t: any) => t.id !== tabId);

    // 닫힌 탭이 활성 탭이었다면 인접한 탭 활성화
    if (tabId === currentActiveTabId) {
      const newActiveIndex = tabIndex > 0 ? tabIndex - 1 : 0;
      const newActiveTab = newTabs[newActiveIndex];
      if (newActiveTab) {
        updateActiveTabId(newActiveTab.id);
        if (editor) {
          editor.commands.setContent(newActiveTab.content || '');
          setTitle(newActiveTab.title);
        }
      } else {
        updateActiveTabId('');
      }
    }

    updateTabs(newTabs);
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
      updateTabs((prev: any[]) => (prev || currentTabs).map(tab => ({ ...tab, content: tab.id === currentActiveTabId ? htmlContent : tab.content, isActive: false })).concat(newTab));
    }

    // 새 탭 활성화
    updateActiveTabId(newTabId);
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
      const updatedTabs = (currentTabs || []).map((tab: any) => 
        tab.id === currentActiveTabId ? { ...tab, title: newTitle } : tab
      );
      updateTabs(updatedTabs);
      
      // 문서 저장
      try {
  const currentTab = updatedTabs.find((tab: any) => tab.id === currentActiveTabId);
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
    updateTabs((prev: any[]) => (prev || currentTabs).map((tab: any) => ({ ...tab, isActive: false })).concat(newTab));
    updateActiveTabId(newTab.id);
    toast.success('파일이 복사되었습니다.');
  };

  // 파일 삭제하기 핸들러
  const handleDeleteFile = () => {
    if ((currentTabs || []).length <= 1) {
      toast.error('마지막 탭은 삭제할 수 없습니다.');
      return;
    }
    const currentIndex = (currentTabs || []).findIndex((tab: any) => tab.id === currentActiveTabId);
    const newTabs = (currentTabs || []).filter((tab: any) => tab.id !== currentActiveTabId);
    
    // 삭제 후 활성화할 탭 결정 (이전 탭 또는 다음 탭)
    let newActiveTabId = '';
    if (currentIndex > 0) {
      newActiveTabId = (currentTabs || [])[currentIndex - 1].id;
      newActiveTabId = (currentTabs || [])[1].id;
    }
    updateTabs(newTabs);
    updateActiveTabId(newActiveTabId);
    toast.success('파일이 삭제되었습니다.');
  };

  const handleSave = async () => {
    if (!editor) return;

    try {
      // Get the current tab to check content type
      const currentTab = (currentTabs || []).find((tab: any) => tab.id === currentActiveTabId);
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
      const updatedTabs = (currentTabs || []).map((tab: any) => 
        tab.id === currentActiveTabId 
          ? { 
              ...tab, 
              content: contentToSave, 
              title: doc.title, 
              documentId: docId,
              contentType: (currentTab.contentType || 'html') as 'markdown' | 'html'
            }
          : tab
      );
      
      updateTabs(updatedTabs);
      
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
      console.log('Editor: clearHighlight called, selectedTextForAI before =', selectedTextForAI);
      if (editor) {
        // 하이라이트 제거
        const tr = editor.state.tr.setMeta('aiSelection', null);
        editor.view.dispatch(tr);
        console.log('Editor: clearHighlight dispatched transaction');
        // 선택된 텍스트 상태도 초기화
        setSelectedTextForAI(null);
        setHighlightDisabled(true);
        console.log('Editor: setSelectedTextForAI(null) and setHighlightDisabled(true) called');
      } else {
        console.log('Editor: clearHighlight called but editor is null');
      }
    },
  }));

  // Editor API가 준비되면 부모에게 알림
  useEffect(() => {
    if (onApiReady && ref && typeof ref === 'object' && 'current' in ref && ref.current) {
      console.log('Editor: onApiReady called with API:', ref.current);
      onApiReady(ref.current);
    }
  }, [onApiReady]);

  if (!editor) {
    return null;
  }

  // PDF 파일인 경우 PDFViewer 표시
  if (isPdfFile && pdfData) {
    return (
      <div className="h-full flex flex-col relative overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <PDFViewer 
            pdfData={pdfData} 
            fileName={uploadedFileName}
            toolbarVisible={true}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* Tab header is rendered at Workspace level now (moved out of Editor) */}
      
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
            // If parent provided a direct handler to open documents (Workspace), delegate to it so Workspace remains SSoT.
            if (onOpenDocument) {
              try {
                onOpenDocument(String(doc.id));
              } catch (e) {
                console.error('onOpenDocument handler failed:', e);
              }
              return;
            }
            try {
              // Check if the document is already open in a tab
              const existingTab = (currentTabs || []).find((tab: any) => String(tab.documentId) === String(doc.id));
              
              if (existingTab) {
                // If the document is already open, switch to that tab
                updateTabs((prev: any[]) => (prev || currentTabs).map((tab: any) => ({
                  ...tab,
                  isActive: tab.id === existingTab.id
                })));
                updateActiveTabId(existingTab.id);
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
                  updateTabs((prev: any[]) => (prev || currentTabs).map(tab => ({ ...tab, isActive: false })).concat(newTab));
                  
                  updateActiveTabId(newTabId);
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
              if ((currentTabs || []).some((tab: any) => String(tab.documentId) === String(docId))) {
                const tabToRemove = (currentTabs || []).find((tab: any) => String(tab.documentId) === String(docId));
                if (tabToRemove) {
                  // If it's the active tab, switch to another tab
                  if (currentActiveTabId === tabToRemove.id) {
                    const currentIndex = (currentTabs || []).findIndex((tab: any) => tab.id === tabToRemove.id);
                    let newActiveTabId = '';
                    
                    if ((currentTabs || []).length > 1) {
                      if (currentIndex > 0) {
                        newActiveTabId = (currentTabs || [])[currentIndex - 1].id;
                      } else if ((currentTabs || []).length > 1) {
                        newActiveTabId = (currentTabs || [])[1].id;
                      }
                    }
                    
                    updateActiveTabId(newActiveTabId);
                  }
                  
                  // Remove the tab
                  updateTabs((prev: any[]) => (prev || currentTabs).filter((tab: any) => tab.id !== tabToRemove.id));
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
          className="flex-1 mx-6 mt-4 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg flex flex-col focus-within:ring-1 focus-within:ring-opacity-30 focus-within:ring-blue-300 dark:focus-within:ring-blue-700 focus-within:border-blue-300 dark:focus-within:border-blue-500 mb-6 transition-all duration-200 min-h-0 relative"
          style={{'--tw-ring-color': 'rgba(99, 102, 241, 0.3)'} as React.CSSProperties}
        >
        
          {/* 에디터 컨텐츠 영역 */}
          <div ref={editorContainerRef} className="flex-1 min-h-0 cursor-text relative overflow-y-auto" onClick={() => editor?.commands.focus()}>
        {!isEditorReady ? (
          <div className="flex flex-col items-center justify-center h-full p-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">에디터를 로딩 중...</p>
          </div>
        ) : (
          <EditorContent 
            ref={editorContainerRef}
            editor={editor} 
            className="h-full [&_.ProseMirror]:outline-none [&_.ProseMirror]:leading-relaxed [&_.ProseMirror]:text-sm sm:[&_.ProseMirror]:text-base [&_.ProseMirror]:max-w-none [&_.ProseMirror]:border-0 [&_.ProseMirror]:focus:outline-none [&_.ProseMirror]:p-6 [&_.ProseMirror]:min-h-full [&_.ProseMirror]:overflow-y-visible [&_.ProseMirror]:pb-32 [&_.ProseMirror]:text-gray-900 [&_.ProseMirror]:dark:text-gray-100" 
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

        {/* Table controls overlay (add column / add row) */}
        {showTableControls && tableControlPos && (
          <>
            <div
              onClick={async () => {
                if (!editor || !hoveredCellRect) return;
                try {
                  const posInfo = (editor.view as any).posAtCoords({ left: hoveredCellRect.left + 2, top: hoveredCellRect.top + 2 });
                  if (!posInfo || typeof posInfo.pos !== 'number') return;
                  const pos = posInfo.pos;
                  // set selection to the hovered cell and add a column after
                  await editor.chain().focus().setTextSelection({ from: pos, to: pos }).addColumnAfter().run();
                } catch (e) {
                  console.error('add column failed', e);
                }
              }}
              style={{ position: 'absolute', left: tableControlPos.rightLeft, top: tableControlPos.rightTop }}
              className="z-50 w-8 h-8 bg-gray-700 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-600"
              title="열 추가"
            >
              +
            </div>

            <div
              onClick={async () => {
                if (!editor || !hoveredCellRect) return;
                try {
                  const posInfo = (editor.view as any).posAtCoords({ left: hoveredCellRect.left + 2, top: hoveredCellRect.top + 2 });
                  if (!posInfo || typeof posInfo.pos !== 'number') return;
                  const pos = posInfo.pos;
                  // set selection to hovered cell and add a row after
                  await editor.chain().focus().setTextSelection({ from: pos, to: pos }).addRowAfter().run();
                } catch (e) {
                  console.error('add row failed', e);
                }
              }}
              style={{ position: 'absolute', left: tableControlPos.bottomLeft, top: tableControlPos.bottomTop }}
              className="z-50 w-8 h-8 bg-gray-700 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-600"
              title="행 추가"
            >
              +
            </div>
          </>
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
      <EquationInputModal
        isOpen={isEquationModalOpen}
        onClose={() => setIsEquationModalOpen(false)}
        onInsert={handleEquationInsert}
      />
      <TableInsertModal
        isOpen={isTableInsertModalOpen}
        onClose={() => setIsTableInsertModalOpen(false)}
        onInsert={handleTableInsert}
      />
      
      {/* AI 요청 버튼 - 에디터 텍스트박스 우측 하단 고정 */}
      <button
        onClick={() => {
          // AI 버튼 클릭 시 선택된 텍스트를 캡처해서 Taskbar에 전달
          if (editor) {
            try {
              const { from, to } = editor.state.selection;
              const selectedText = getSelectionAsMarkdown(from, to);
              console.log('Editor: AI button clicked, selection:', { from, to, selectedText });
              if (selectedText && selectedText.trim()) {
                setSelectedTextForAI({ from, to, text: selectedText });
                setHighlightDisabled(false); // AI 버튼 클릭 시 하이라이트 활성화
                // AI 버튼 클릭 시 하이라이트 표시
                if (editor) {
                  const tr = editor.state.tr.setMeta('aiSelection', { from, to });
                  editor.view.dispatch(tr);
                }
              } else {
                setSelectedTextForAI(null);
                setHighlightDisabled(true);
              }
            } catch (e) {
              setSelectedTextForAI(null);
              setHighlightDisabled(true);
            }
          }
          onOpenTaskbar?.();
        }}
        className="absolute bottom-12 right-12 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-full p-4 shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl z-50"
        title="AI 어시스턴트"
      >
        <Robot size={24} />
      </button>
      
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
        isRightSidebarOpen={isRightSidebarOpen}
        rightSidebarWidth={rightSidebarWidth}
      />
      
      {/* 선택 메뉴 버튼 */}
      {showSelectionMenu && !showMenuPopup && (
        <div
          className="fixed z-50"
          style={{
            top: selectionMenuPos.y + 'px',
            left: selectionMenuPos.x + 'px',
          }}
        >
          <button
            onClick={handleSelectionMenu}
            className="w-6 h-6 text-gray-800 rounded-full flex items-center justify-center hover:bg-gray-100"
            title="옵션"
          >
            ...
          </button>
        </div>
      )}

      {/* 선택 메뉴 팝업 */}
      {showMenuPopup && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg py-1"
          style={{
            top: selectionMenuPos.y + 30 + 'px', // 버튼 아래에
            left: selectionMenuPos.x + 'px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex">
            <button
              onClick={handleTranslate}
              className="px-3 py-2 text-sm hover:scale-105 hover:shadow-sm transition-all whitespace-nowrap"
            >
              번역
            </button>
            <button
              onClick={handleAIRequest}
              className="px-3 py-2 text-sm hover:scale-105 hover:shadow-sm transition-all whitespace-nowrap"
            >
              AI 요청
            </button>
            <button
              onClick={handleHyperlink}
              className="px-3 py-2 text-sm hover:scale-105 hover:shadow-sm transition-all whitespace-nowrap"
            >
              하이퍼링크
            </button>
            <button
              onClick={handleCopy}
              className="px-3 py-2 text-sm hover:scale-105 hover:shadow-sm transition-all whitespace-nowrap"
            >
              복사
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-2 text-sm hover:scale-105 hover:shadow-sm transition-all whitespace-nowrap"
            >
              삭제
            </button>
          </div>
        </div>
      )}
      
      {/* 번역 모달 */}
      <Modal
        isOpen={showTranslationModal}
        onRequestClose={() => setShowTranslationModal(false)}
        style={{
          content: {
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            marginRight: '-50%',
            transform: 'translate(-50%, -50%)',
            maxWidth: '500px',
            width: '90%',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          },
          overlay: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
          },
        }}
        contentLabel="번역 결과"
      >
        <div>
          <h2 className="text-xl font-bold mb-4">번역 결과</h2>
          <p className="mb-4 whitespace-pre-wrap">{translationResult}</p>
          <button
            onClick={() => setShowTranslationModal(false)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            닫기
          </button>
        </div>
      </Modal>
      
      {/* 클릭 시 메뉴 닫기 */}
      {showMenuPopup && (
        <div
          className="fixed inset-0 z-40"
          onClick={handleSelectionMenuClose}
        />
      )}
    </div>
  );
});

export default Editor;
