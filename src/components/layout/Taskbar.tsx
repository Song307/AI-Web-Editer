import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Paperclip, X, Stars, Trash, Clipboard, ArrowsFullscreen, FileEarmarkPdf, Image as ImageIcon, Wrench, Chat, Code, Translate, FileText, Robot, ChevronDown, ThreeDots, Plus } from 'react-bootstrap-icons';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';
import { generateAIResponse } from '../../utils/ai';
import { saveAIConversation, getAIConversations, getAIConversation, updateAIConversation, deleteAIConversation, AIConversation, AIMessage } from '../../utils/db';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  files?: UploadedFile[];
  tool?: string;
  selectionPreview?: string | null;
  suggestedText?: string | null; // 요청 도구에서 제안된 변경 텍스트
  documentName?: string; // 메시지가 발생한 문서 이름
  applied?: boolean; // 제안사항이 적용되었는지 여부
}

interface UploadedFile {
  name: string;
  type: 'image' | 'pdf';
  data: string;
  size: number;
  pageCount?: number;
}

interface ClipboardItem {
  id: string;
  content: string;
  type: 'text' | 'html' | 'image' | 'pdf';
  timestamp: Date;
  title?: string;
  fileName?: string;
  fileSize?: number;
}

interface TaskbarProps {
  isRightSidebarOpen: boolean,
  rightSidebarWidth: number,
  isResizingRight: boolean,
  onClose: () => void,
  onMouseDown: (e: React.MouseEvent) => void,
  selectionPreview?: string | null,
  selectionRange?: { from: number; to: number } | null,
  onClearSelection?: () => void,
  onReplaceSelection?: (newText: string) => void,
  onHighlightSelection?: (from: number, to: number) => void,
  onClearHighlight?: () => void,
  documentTitle?: string,
  onUndo?: () => void
}

const Taskbar: React.FC<TaskbarProps> = ({
  isRightSidebarOpen,
  rightSidebarWidth,
  isResizingRight,
  onClose,
  onMouseDown,
  selectionPreview = null,
  selectionRange = null,
  onClearSelection,
  onReplaceSelection,
  onHighlightSelection,
  onClearHighlight,
  documentTitle = 'Untitled Document',
  onUndo
}) => {
  const [activeTab, setActiveTab] = useState<'clipboard' | 'aiAssistant'>('aiAssistant');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<AIConversation[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showSessionDropdown, setShowSessionDropdown] = useState(false);
  const [clipboardItems, setClipboardItems] = useState<ClipboardItem[]>([]);
  const [selectedClipboardItem, setSelectedClipboardItem] = useState<ClipboardItem | null>(null);
  const [editingItem, setEditingItem] = useState<ClipboardItem | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isClipboardSelected, setIsClipboardSelected] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string | null>(() => {
    const saved = localStorage.getItem('selectedTool');
    return saved ? saved : null;
  });
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const clipboardTabRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 클립보드 선택 해제 (클립보드 영역 외부 클릭 시)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clipboardTabRef.current && !clipboardTabRef.current.contains(event.target as Node)) {
        setIsClipboardSelected(false);
      }
      if (showSessionDropdown && !(event.target as Element).closest('.session-dropdown')) {
        setShowSessionDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 세션 목록 로드
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const loadedSessions = await getAIConversations();
        setSessions(loadedSessions);
        // 최근 세션이 있으면 로드
        if (loadedSessions.length > 0 && !currentSessionId) {
          const latestSession = loadedSessions[0];
          setCurrentSessionId(latestSession.id);
          setMessages(latestSession.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            files: [], // DB에 저장 안 함
            tool: undefined
          })));
        }
      } catch (error) {
        console.error('세션 로드 실패:', error);
      }
    };
    loadSessions();
  }, []);

  // Ctrl+Z to undo last applied suggestion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        // Find the last applied message and undo it
        const lastAppliedMessage = [...messages].reverse().find(msg => msg.applied);
        if (lastAppliedMessage) {
          setMessages(prevMessages => 
            prevMessages.map(msg => 
              msg.timestamp === lastAppliedMessage.timestamp 
                ? { ...msg, applied: false }
                : msg
            )
          );
          // Call onUndo callback if provided
          if (onUndo) {
            onUndo();
          }
          toast.success('제안사항 적용이 취소되었습니다.');
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [messages, onUndo]);

  // Save selectedTool to localStorage when it changes
  useEffect(() => {
    if (selectedTool !== null) {
      localStorage.setItem('selectedTool', selectedTool);
    } else {
      localStorage.removeItem('selectedTool');
    }
  }, [selectedTool]);

  // AI 기능 핸들러
  const handleAIAction = (action: string) => {
    setSelectedTool(action);
  };

  // 도구 레이블 가져오기
  const getToolLabel = (tool: string) => {
    switch (tool) {
      case 'general':
        return '일반 대화';
      case 'code':
        return '코드 도우미';
      case 'translate':
        return '번역 도구';
      case 'research':
        return '심층 연구';
      case 'analyze':
        return '체계적 분석';
      case 'feedback':
        return '건설적 피드백';
      case 'answer':
        return '명확한 답변';
      case 'request':
        return '요청';
      default:
        return null;
    }
  };

  // 도구 색상 가져오기
  const getToolColor = (tool: string) => {
    switch (tool) {
      case 'research':
        return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20';
      case 'analyze':
        return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
      case 'feedback':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
      case 'answer':
        return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
      case 'request':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
      default:
        return '';
    }
  };

  // 클립보드 관련 함수들
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('클립보드에 복사되었습니다');
    } catch (error) {
      console.error('클립보드 복사 실패:', error);
      toast.error('클립보드 복사에 실패했습니다');
    }
  };

  // 세션 저장
  const saveCurrentSession = async () => {
    if (messages.length === 0) return;

    try {
      const title = messages[0].content.slice(0, 50) + (messages[0].content.length > 50 ? '...' : '');
      const conversation: AIConversation = {
        id: currentSessionId || `session_${Date.now()}`,
        title,
        messages: messages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          timestamp: msg.timestamp
        })),
        createdAt: currentSessionId ? sessions.find(s => s.id === currentSessionId)?.createdAt || new Date() : new Date(),
        updatedAt: new Date()
      };

      await saveAIConversation(conversation);
      setCurrentSessionId(conversation.id);

      // 세션 목록 업데이트
      const updatedSessions = await getAIConversations();
      setSessions(updatedSessions);
    } catch (error) {
      console.error('세션 저장 실패:', error);
    }
  };

  // 새로운 세션 생성
  const createNewSession = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setSelectedTool(null);
    setShowSessionDropdown(false);
  };

  // 세션 선택
  const selectSession = async (sessionId: string) => {
    try {
      const session = await getAIConversation(sessionId);
      if (session) {
        setCurrentSessionId(session.id);
        setMessages(session.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          files: [],
          tool: undefined
        })));
        setShowSessionDropdown(false);
      }
    } catch (error) {
      console.error('세션 로드 실패:', error);
    }
  };

  // 세션 삭제
  const deleteSession = async (sessionId: string) => {
    try {
      await deleteAIConversation(sessionId);
      const updatedSessions = await getAIConversations();
      setSessions(updatedSessions);

      // 현재 세션이 삭제된 경우 새로운 세션으로
      if (currentSessionId === sessionId) {
        createNewSession();
      }
    } catch (error) {
      console.error('세션 삭제 실패:', error);
    }
  };

  // 메시지가 변경될 때 세션 저장
  useEffect(() => {
    if (messages.length > 0) {
      saveCurrentSession();
    }
  }, [messages]);

  // 메뉴바 클립보드에서 데이터 불러오기
  const loadMenubarClipboardItems = () => {
    try {
      const stored = localStorage.getItem('clipboardItems');
      if (stored) {
        const items = JSON.parse(stored).map((item: any) => ({
          id: item.id,
          content: item.content,
          type: item.type,
          timestamp: new Date(item.timestamp),
          fileName: item.fileName,
          fileSize: item.fileSize,
          title: item.type === 'text' ? (item.content.length > 50 ? item.content.substring(0, 50) + '...' : item.content) :
                item.type === 'image' ? (item.fileName || '이미지') :
                item.type === 'pdf' ? (item.fileName || 'PDF 문서') :
                item.content.substring(0, 50) + '...'
        }));
        // 메뉴바 클립보드의 최신 상태로 완전히 동기화
        setClipboardItems(items);
      } else {
        setClipboardItems([]);
      }
    } catch (error) {
      console.error('메뉴바 클립보드 데이터 로드 실패:', error);
      toast.error('클립보드 데이터를 불러올 수 없습니다');
    }
  };

  // 메뉴바 클립보드에 항목 저장
  const saveToMenubarClipboard = (item: ClipboardItem) => {
    try {
      const stored = localStorage.getItem('clipboardItems');
      let items = [];
      if (stored) {
        items = JSON.parse(stored);
      }
      // 메뉴바 클립보드 형식으로 변환
      const menubarItem = {
        id: item.id,
        type: item.type,
        content: item.content,
        timestamp: item.timestamp.toISOString(),
        fileName: item.fileName,
        fileSize: item.fileSize
      };
      items.unshift(menubarItem); // 맨 앞에 추가
      // 최대 50개 유지 (메뉴바 클립보드의 제한)
      if (items.length > 50) {
        items = items.slice(0, 50);
      }
      localStorage.setItem('clipboardItems', JSON.stringify(items));
      // 클립보드 변경 이벤트 발생
      window.dispatchEvent(new CustomEvent('clipboardChanged'));
    } catch (error) {
      console.error('메뉴바 클립보드 저장 실패:', error);
    }
  };

  // 클립보드 데이터 동기화를 위한 이벤트 리스너
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'clipboardItems') {
        loadMenubarClipboardItems();
      }
    };

    const handleClipboardChange = () => {
      loadMenubarClipboardItems();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('clipboardChanged', handleClipboardChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('clipboardChanged', handleClipboardChange);
    };
  }, []);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const newItem: ClipboardItem = {
          id: Date.now().toString(),
          content: text,
          type: 'text',
          timestamp: new Date(),
          title: text.length > 50 ? text.substring(0, 50) + '...' : text
        };
        setClipboardItems(prev => [newItem, ...prev.slice(0, 9)]); // 최대 10개 유지
        saveToMenubarClipboard(newItem); // 메뉴바 클립보드에도 저장
        toast.success('클립보드 내용이 추가되었습니다');
      } else {
        toast('클립보드에 텍스트가 없습니다');
      }
    } catch (error) {
      console.error('클립보드 붙여넣기 실패:', error);
      toast.error('클립보드 내용을 가져올 수 없습니다');
    }
  }, []);

  const handleClipboardHeaderClick = (e: React.MouseEvent) => {
    console.log('Clipboard header clicked, current state:', isClipboardSelected);
    e.stopPropagation();
    setIsClipboardSelected(!isClipboardSelected);
    console.log('New clipboard state:', !isClipboardSelected);
  };

  // 메뉴바 클립보드에서 항목 삭제
  const deleteFromMenubarClipboard = (id: string) => {
    try {
      const stored = localStorage.getItem('clipboardItems');
      if (stored) {
        let items = JSON.parse(stored);
        items = items.filter((item: any) => item.id !== id);
        localStorage.setItem('clipboardItems', JSON.stringify(items));
        // 클립보드 변경 이벤트 발생
        window.dispatchEvent(new CustomEvent('clipboardChanged'));
      }
    } catch (error) {
      console.error('메뉴바 클립보드 삭제 실패:', error);
    }
  };

  const deleteClipboardItem = (id: string) => {
    deleteFromMenubarClipboard(id); // 메뉴바 클립보드에서 삭제 (이벤트 리스너를 통해 로컬 상태도 업데이트됨)
    toast.success('클립보드 항목이 삭제되었습니다');
  };

  // 텍스트 항목 편집 시작
  const startEditingItem = (item: ClipboardItem) => {
    if (item.type === 'text') {
      setEditingItem(item);
      setEditingContent(item.content);
    }
  };

  // 텍스트 항목 편집 저장
  const saveEditingItem = () => {
    if (editingItem) {
      const newContent = editingContent.trim();
      const updatedItem = {
        ...editingItem,
        content: newContent,
        timestamp: new Date(),
        title: newContent.length > 50 ? newContent.substring(0, 50) + '...' : newContent
      };
      
      // 로컬 상태 업데이트
      setClipboardItems(prev => prev.map(item => 
        item.id === editingItem.id ? updatedItem : item
      ));
      
      // 메뉴바 클립보드 업데이트 (전체 항목 교체)
      try {
        const stored = localStorage.getItem('clipboardItems');
        let items = [];
        if (stored) {
          items = JSON.parse(stored);
        }
        
        // 기존 항목을 찾아서 업데이트
        const existingIndex = items.findIndex((item: any) => item.id === editingItem.id);
        if (existingIndex !== -1) {
          // 메뉴바 클립보드 형식으로 변환
          const menubarItem = {
            id: updatedItem.id,
            type: updatedItem.type,
            content: updatedItem.content,
            timestamp: updatedItem.timestamp.toISOString(),
            fileName: updatedItem.fileName,
            fileSize: updatedItem.fileSize
          };
          items[existingIndex] = menubarItem;
        }
        
        localStorage.setItem('clipboardItems', JSON.stringify(items));
        // 클립보드 변경 이벤트 발생
        window.dispatchEvent(new CustomEvent('clipboardChanged'));
      } catch (error) {
        console.error('메뉴바 클립보드 업데이트 실패:', error);
      }
      
      setEditingItem(null);
      setEditingContent('');
    }
  };

  const handlePasteSelectedItem = useCallback(async () => {
    if (!selectedClipboardItem) return;

    try {
      // 시스템 클립보드에 복사
      await navigator.clipboard.writeText(selectedClipboardItem.content);

      // 클립보드 탭에 새로운 항목으로 추가
      const newItem: ClipboardItem = {
        id: Date.now().toString(),
        content: selectedClipboardItem.content,
        type: selectedClipboardItem.type,
        timestamp: new Date(),
        title: selectedClipboardItem.title,
        fileName: selectedClipboardItem.fileName,
        fileSize: selectedClipboardItem.fileSize
      };
      setClipboardItems(prev => [newItem, ...prev.slice(0, 9)]); // 최대 10개 유지
      saveToMenubarClipboard(newItem); // 메뉴바 클립보드에도 저장

      toast.success('클립보드에 복사되고 항목이 추가되었습니다');
    } catch (error) {
      console.error('클립보드 복사 실패:', error);
      toast.error('클립보드 복사에 실패했습니다');
    }
  }, [selectedClipboardItem]);

  // 클립보드 탭이 활성화될 때 메뉴바 클립보드 데이터 로드
  useEffect(() => {
    if (activeTab === 'clipboard') {
      loadMenubarClipboardItems();
    } else {
      // 클립보드 탭에서 벗어나면 선택 해제
      setSelectedClipboardItem(null);
    }
  }, [activeTab]);

  // localStorage 변경 감지 (다른 컴포넌트에서의 클립보드 변경 반영)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'clipboardItems' && activeTab === 'clipboard') {
        loadMenubarClipboardItems();
      }
    };

    const handleCustomClipboardChange = () => {
      if (activeTab === 'clipboard') {
        loadMenubarClipboardItems();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('clipboardItemsChanged', handleCustomClipboardChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('clipboardItemsChanged', handleCustomClipboardChange);
    };
  }, [activeTab]);

  // 클립보드 탭에서 키보드 이벤트 처리
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+V 또는 Cmd+V
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        // 현재 포커스가 에디터에 있는지 확인
        const activeElement = document.activeElement;
        const isEditorFocused = activeElement && (
          activeElement.classList.contains('ProseMirror') ||
          activeElement.closest('.editor-container') ||
          activeElement.closest('[data-editor]') ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.tagName === 'INPUT' ||
          (activeElement as HTMLElement).contentEditable === 'true'
        );

        console.log('Ctrl+V pressed, activeTab:', activeTab, 'isClipboardSelected:', isClipboardSelected, 'isEditorFocused:', isEditorFocused);

        if (activeTab === 'clipboard' && isClipboardSelected && !isEditorFocused) {
          console.log('Pasting to clipboard');
          e.preventDefault();
          if (selectedClipboardItem) {
            handlePasteSelectedItem();
          } else {
            // 클립보드 탭에서 선택된 상태에서만 시스템 클립보드에서 붙여넣기
            pasteFromClipboard();
          }
        } else if (activeTab === 'clipboard' && !isClipboardSelected && !isEditorFocused) {
          // 클립보드 탭이지만 선택되지 않은 상태에서는 붙여넣기 막기 (에디터가 포커스가 아닐 때만)
          console.log('Clipboard not selected, preventing paste');
          e.preventDefault();
        } else if (activeTab !== 'clipboard' && isClipboardSelected) {
          // 다른 탭이지만 클립보드가 선택된 상태에서는 클립보드에 붙여넣기
          console.log('Clipboard selected in other tab, pasting to clipboard');
          e.preventDefault();
          pasteFromClipboard();
        } else {
          console.log('Allowing default paste behavior');
        }
        // 에디터에 포커스가 있거나 클립보드가 선택되지 않았거나 다른 탭에서는 기본 붙여넣기 동작 허용
      }
      // ESC 키로 선택 해제
      else if (e.key === 'Escape') {
        setSelectedClipboardItem(null);
        setIsClipboardSelected(false);
        toast('선택이 해제되었습니다');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTab, selectedClipboardItem, pasteFromClipboard, handlePasteSelectedItem, isClipboardSelected]);

  // Handle sending a message
  const handleSend = async () => {
    if ((!inputValue.trim() && uploadedFiles.length === 0 && !selectionPreview) || isProcessing) return;

    let finalMessage = inputValue.trim();

    // 선택된 도구가 있으면 프롬프트에 추가
    if (selectedTool) {
      let toolPrompt = '';
      switch (selectedTool) {
        case 'general':
          toolPrompt = '';
          break;
        case 'code':
          toolPrompt = '코딩과 관련된 질문입니다. 코드 예제와 함께 자세히 설명해주세요.\n\n';
          break;
        case 'translate':
          toolPrompt = '번역 요청입니다. 자연스럽고 정확한 번역을 제공해주세요.\n\n';
          break;
        case 'analyze':
          toolPrompt = '문서 분석 요청입니다. 내용을 체계적으로 분석하고 요약해주세요.\n\n';
          break;
        case 'image':
          toolPrompt = '이미지 분석 요청입니다. 이미지의 내용을 자세히 설명해주세요.\n\n';
          break;
        case 'request':
          toolPrompt = `텍스트 수정 요청입니다. 사용자가 선택한 텍스트를 다른 내용으로 변경해달라는 요청입니다.

다음 형식으로 응답해주세요:

1. 먼저 요청에 대한 간단한 설명이나 답변
2. 그 다음에 ---구분선---
3. 변경된 텍스트만 (다른 설명 없이 순수 텍스트만)

예시:
이 텍스트를 더 전문적으로 바꿔보겠습니다.

---
더 전문적인 버전의 텍스트가 여기에 옵니다.

응답 형식을 엄격히 지켜주세요. 변경된 텍스트는 ---구분선--- 아래에 순수 텍스트로만 작성해주세요.\n\n`;
          break;
      }
      finalMessage = toolPrompt + finalMessage;
    }

    // 선택된 텍스트가 있으면 프롬프트에 포함
    const composedPrompt = selectionPreview
      ? `선택된 텍스트:\n${selectionPreview}\n\n요청:\n${finalMessage || '첨부된 파일을 분석해주세요.'}`
      : finalMessage || '첨부된 파일을 분석해주세요.';

    const userMessage: Message = {
      role: 'user',
      content: inputValue || '첨부된 파일을 분석해주세요.',
      timestamp: new Date(),
      files: [...uploadedFiles],
      tool: selectedTool || undefined,
      selectionPreview: selectionPreview
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setUploadedFiles([]);
    setSelectedTool(null);
    setIsProcessing(true);

    try {
      const response = await generateAIResponse(composedPrompt);
      
      let aiMessage: Message;
      
      // 요청 도구인 경우 응답 파싱
      if (selectedTool === 'request') {
        const parts = response.split('---');
        if (parts.length >= 2) {
          // 설명 부분과 변경 텍스트 분리
          const explanation = parts[0].trim();
          const suggestedText = parts.slice(1).join('---').trim();
          
          aiMessage = {
            role: 'assistant',
            content: explanation,
            timestamp: new Date(),
            tool: selectedTool || undefined,
            suggestedText: suggestedText
          };
        } else {
          // 구분선이 없는 경우 일반 응답으로 처리
          aiMessage = {
            role: 'assistant',
            content: response,
            timestamp: new Date(),
            tool: selectedTool || undefined
          };
        }
      } else {
        aiMessage = {
          role: 'assistant',
          content: response,
          timestamp: new Date(),
          tool: selectedTool || undefined
        };
      }
      
      setMessages(prev => [...prev, aiMessage]);
      
      // AI 응답 후에도 하이라이트는 유지 (변경사항 적용 시까지)
    } catch (error) {
      console.error('AI 응답 생성 중 오류:', error);
      toast.error('AI 응답을 생성하는 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // 파일 크기 제한 (10MB)
        if (file.size > 10 * 1024 * 1024) {
          alert(`${file.name}은(는) 10MB를 초과합니다.`);
          continue;
        }

        if (file.type.startsWith('image/')) {
          // 이미지 처리
          const reader = new FileReader();
          reader.onload = (e) => {
            const imageData = e.target?.result as string;
            setUploadedFiles(prev => [...prev, {
              name: file.name,
              type: 'image',
              data: imageData,
              size: file.size
            }]);
          };
          reader.readAsDataURL(file);
        } else if (file.type === 'application/pdf') {
          // PDF 처리 (기본 처리 - 실제로는 서버 측에서 처리하는 것이 좋음)
          const reader = new FileReader();
          reader.onload = (e) => {
            const pdfData = e.target?.result as string;
            setUploadedFiles(prev => [...prev, {
              name: file.name,
              type: 'pdf',
              data: pdfData,
              size: file.size,
              pageCount: 1 // 실제 PDF 페이지 수는 서버에서 처리 필요
            }]);
          };
          reader.readAsDataURL(file);
        } else {
          alert(`${file.name}은(는) 지원하지 않는 파일 형식입니다. (이미지 또는 PDF만 가능)`);
        }
      }
    } catch (error) {
      console.error('File upload error:', error);
      alert('파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Remove a file from the upload queue
  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 드래그 앤 드롭 핸들러들
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // relatedTarget이 컨테이너 밖으로 나갔을 때만 false
    const target = e.currentTarget as HTMLElement;
    const related = e.relatedTarget as HTMLElement;
    if (!target.contains(related)) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => 
      file.type.startsWith('image/') || file.type === 'application/pdf'
    );

    if (validFiles.length === 0) {
      alert('이미지 또는 PDF 파일만 업로드할 수 있습니다.');
      return;
    }

    if (validFiles.length + uploadedFiles.length > 10) {
      alert('최대 10개의 파일만 업로드할 수 있습니다.');
      return;
    }

    setIsUploading(true);

    try {
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        
        // 파일 크기 제한 (10MB)
        if (file.size > 10 * 1024 * 1024) {
          alert(`${file.name}은(는) 10MB를 초과합니다.`);
          continue;
        }

        if (file.type.startsWith('image/')) {
          // 이미지 처리
          const reader = new FileReader();
          reader.onload = (e) => {
            const imageData = e.target?.result as string;
            setUploadedFiles(prev => [...prev, {
              name: file.name,
              type: 'image',
              data: imageData,
              size: file.size
            }]);
          };
          reader.readAsDataURL(file);
        } else if (file.type === 'application/pdf') {
          // PDF 처리 (기본 처리 - 실제로는 서버 측에서 처리하는 것이 좋음)
          const reader = new FileReader();
          reader.onload = (e) => {
            const pdfData = e.target?.result as string;
            setUploadedFiles(prev => [...prev, {
              name: file.name,
              type: 'pdf',
              data: pdfData,
              size: file.size,
              pageCount: 1 // 실제 PDF 페이지 수는 서버에서 처리 필요
            }]);
          };
          reader.readAsDataURL(file);
        }
      }
    } catch (error) {
      console.error('File upload error:', error);
      alert('파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  // 메뉴 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setShowAddMenu(false);
      }
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target as Node)) {
        setShowToolsMenu(false);
      }
    };

    if (showAddMenu || showToolsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAddMenu, showToolsMenu]);
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
        {/* 헤더 영역 */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          {/* 탭 메뉴 - 좌측 정렬 */}
          <div className="flex h-full items-stretch">
            <button
              onClick={() => setActiveTab('aiAssistant')}
              className={`px-4 text-sm font-medium transition-colors flex items-center ${
                activeTab === 'aiAssistant'
                  ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              AI 어시스턴트
            </button>
            <button
              onClick={() => setActiveTab('clipboard')}
              className={`px-4 text-sm font-medium transition-colors flex items-center ${
                activeTab === 'clipboard'
                  ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              클립보드
            </button>
          </div>
          
          {/* 우측 버튼들 */}
          <div className="flex items-center gap-2">
            {/* 닫기 버튼 */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="사이드바 닫기"
            >
              <svg
                className="w-5 h-5 text-gray-500 dark:text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 탭 내용 */}
        <div className="flex-1 overflow-visible">
          {activeTab === 'clipboard' && (
            <div 
              ref={clipboardTabRef}
              className="flex flex-col h-full bg-white dark:bg-gray-900"
            >
              {/* 클립보드 헤더 */}
              <div 
                className="p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer"
                onClick={handleClipboardHeaderClick}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    클립보드
                    {isClipboardSelected && (
                      <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full">
                        선택됨
                      </span>
                    )}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        pasteFromClipboard();
                      }}
                      className="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
                      title="클립보드에서 붙여넣기"
                    >
                      붙여넣기
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0">
                  아이템 영역을 클릭하여 클립보드를 선택하세요 · 선택된 상태에서 <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">Ctrl+V</kbd>로 붙여넣기
                </p>
              </div>

              {/* 클립보드 항목들 */}
              <div 
                className={`flex-1 overflow-y-auto p-4 transition-all duration-200 cursor-pointer ${
                  isClipboardSelected 
                    ? 'ring-2 ring-blue-500 ring-inset' 
                    : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClipboardHeaderClick(e);
                }}
              >
                {clipboardItems.length === 0 ? (
                  <div className="text-center py-8">
                    <Clipboard className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      클립보드 항목이 없습니다
                    </p>
                    <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                      각 항목의 복사 버튼을 클릭하여 클립보드에 복사할 수 있습니다
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {clipboardItems.map((item) => {
                      return (
                        <div
                          key={item.id}
                          onClick={() => item.type === 'text' ? startEditingItem(item) : setSelectedClipboardItem(item)}
                          className={`p-3 border rounded-lg transition-colors cursor-pointer ${
                            selectedClipboardItem?.id === item.id
                              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600 ring-2 ring-blue-200 dark:ring-blue-800'
                              : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600'
                          }`}
                        >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            {item.type === 'image' ? (
                              <div className="space-y-2">
                                <img
                                  src={item.content}
                                  alt={item.fileName || '클립보드 이미지'}
                                  className="max-w-full h-20 object-cover rounded border border-gray-200 dark:border-gray-600"
                                />
                                {item.fileName && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {item.fileName}
                                  </p>
                                )}
                              </div>
                            ) : item.type === 'pdf' ? (
                              <div className="flex items-center space-x-2">
                                <FileEarmarkPdf size={20} className="text-red-500" />
                                <div>
                                  <p className="text-sm text-gray-700 dark:text-gray-300">
                                    {item.fileName || 'PDF 문서'}
                                  </p>
                                  {item.fileSize && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {(item.fileSize / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                  )}
                                </div>
                              </div>
                            ) : editingItem?.id === item.id ? (
                              <textarea
                                value={editingContent}
                                onChange={(e) => setEditingContent(e.target.value)}
                                onBlur={saveEditingItem}
                                className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                rows={4}
                                placeholder="텍스트를 입력하세요..."
                                autoFocus
                              />
                            ) : (
                              <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3 whitespace-pre-wrap">
                                {item.content}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1 ml-2">
                            <button
                              onClick={() => copyToClipboard(item.content)}
                              className="p-1 text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors opacity-60 hover:opacity-100"
                              title="복사하기"
                            >
                              <Clipboard size={14} />
                            </button>
                            <button
                              onClick={() => deleteClipboardItem(item.id)}
                              className="p-1 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors opacity-60 hover:opacity-100"
                              title="삭제하기"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {item.timestamp.toLocaleString('ko-KR')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {activeTab === 'aiAssistant' && (
            <div className="flex flex-col h-full bg-white dark:bg-gray-900 max-h-full overflow-y-auto">
              {/* 세션 선택 헤더 */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="relative">
                  <button
                    onClick={() => setShowSessionDropdown(!showSessionDropdown)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className="text-sm text-gray-900 dark:text-white truncate">
                      {currentSessionId ? sessions.find(s => s.id === currentSessionId)?.title || '새 대화' : '새 대화'}
                    </span>
                    <ChevronDown size={16} className="text-gray-500 dark:text-gray-400" />
                  </button>

                  {/* 세션 드롭다운 */}
                  {showSessionDropdown && (
                    <div className="session-dropdown absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-[100] max-h-60 overflow-y-auto">
                      <div className="p-2">
                        <button
                          onClick={createNewSession}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        >
                          <Plus size={14} />
                          새 대화
                        </button>
                      </div>
                      <div className="border-t border-gray-200 dark:border-gray-700">
                        {sessions.map((session) => (
                          <div
                            key={session.id}
                            className={`group relative flex items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer ${
                              currentSessionId === session.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                            }`}
                            onClick={() => selectSession(session.id)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-gray-900 dark:text-white truncate">
                                {session.title}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(session.updatedAt).toLocaleDateString()}
                              </div>
                            </div>
                            {/* 삭제 버튼 - 호버 시 표시 */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSession(session.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-all ml-2"
                            >
                              <Trash size={12} className="text-red-500" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>


              {/* 메시지 영역 */}
              <div 
                ref={dropZoneRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 relative"
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {/* 드래그 오버레이 */}
                {isDragging && (
                  <div 
                    className="absolute inset-0 bg-blue-500/10 dark:bg-blue-400/10 backdrop-blur-sm z-50 rounded-xl border-4 border-dashed border-blue-500 dark:border-blue-400 flex items-center justify-center pointer-events-none"
                  >
                    <div className="text-center">
                      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-blue-500/20 dark:bg-blue-400/20 flex items-center justify-center">
                        <Paperclip size={40} className="text-blue-600 dark:text-blue-400" />
                      </div>
                      <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-2">파일을 여기에 드롭하세요</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">이미지 또는 PDF 파일</p>
                    </div>
                  </div>
                )}
                
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6">
                    <div className="w-16 h-16 mb-4 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                      <Stars size={32} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">AI 어시스턴트와 대화하세요</h3>
                    <p className="text-gray-600 dark:text-gray-400 max-w-md">
                      질문을 입력하거나 파일을 첨부하여 AI의 도움을 받아보세요.
                    </p>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end mb-4' : 'justify-start mb-6'}`}
                    >
                      <div className={`${message.role === 'user' ? 'max-w-[80%] order-2' : 'max-w-full order-1'}`}>
                        {/* AI 아이콘 (AI 메시지일 경우) */}
                        {message.role === 'assistant' && (
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center">
                              <Robot className="w-5 h-5 text-blue-500 mr-2" />
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">AI Assistant</span>
                            </div>
                            {/* 도구 표시 */}
                            {message.tool && (
                              <span className={`text-xs font-medium px-2 py-1 rounded-full ${getToolColor(message.tool)}`}>
                                {getToolLabel(message.tool)}
                              </span>
                            )}
                          </div>
                        )}

                        {/* 메시지 버블 */}
                        <div
                          className={`rounded-xl px-4 py-3 ${
                            message.role === 'user'
                              ? 'max-h-96 overflow-y-auto bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                              : 'text-gray-800 dark:text-gray-200'
                          }`}
                        >
                          {/* 선택된 텍스트 블럭 */}
                          {message.selectionPreview && (
                            <div className={`mb-3 p-3 rounded-lg max-h-20 overflow-y-auto ${
                              message.role === 'user'
                                ? 'bg-gray-200 dark:bg-gray-600 border border-gray-300 dark:border-gray-500'
                                : 'border border-gray-300 dark:border-gray-500'
                            }`}>
                              <div className="text-xs font-medium mb-2 text-gray-600 dark:text-gray-400">
                                선택된 텍스트
                              </div>
                              <div className="text-sm break-words leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                                <ReactMarkdown>{message.selectionPreview}</ReactMarkdown>
                              </div>
                            </div>
                          )}

                          {/* 사용자 메시지 내용 */}
                          <div className="prose prose-sm max-w-none dark:prose-invert
                            [&_p]:mb-3 [&_p]:last:mb-0
                            [&_ul]:mb-3 [&_ol]:mb-3
                            [&_li]:mb-1
                            [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:first:mt-0
                            [&_h2]:text-base [&_h2]:font-bold [&_h2]:mb-2 [&_h2]:mt-3
                            [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1 [&_h3]:mt-2
                            [&_code]:bg-gray-100 [&_code]:dark:bg-gray-700 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono
                            [&_pre]:bg-gray-100 [&_pre]:dark:bg-gray-700 [&_pre]:p-3 [&_pre]:rounded [&_pre]:overflow-x-auto [&_pre]:my-3
                            [&_pre_code]:bg-transparent [&_pre_code]:p-0
                            [&_blockquote]:border-l-4 [&_blockquote]:border-blue-400 [&_blockquote]:dark:border-blue-600 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-4 [&_blockquote]:text-gray-600 [&_blockquote]:dark:text-gray-400 [&_blockquote]:bg-blue-50/50 [&_blockquote]:dark:bg-blue-900/20 [&_blockquote]:py-2 [&_blockquote]:rounded-r
                            [&_a]:text-blue-600 [&_a]:dark:text-blue-400 [&_a]:underline [&_a]:font-medium [&_a]:hover:text-blue-700
                            [&_hr]:border-gray-300 [&_hr]:dark:border-gray-600 [&_hr]:my-6
                            [&_table]:border-collapse [&_table]:w-full [&_table]:my-4
                            [&_th]:border [&_th]:border-gray-300 [&_th]:dark:border-gray-600 [&_th]:bg-gray-100 [&_th]:dark:bg-gray-800 [&_th]:px-3 [&_th]:py-2 [&_th]:font-bold [&_th]:text-left
                            [&_td]:border [&_td]:border-gray-300 [&_td]:dark:border-gray-600 [&_td]:px-3 [&_td]:py-2">
                            <ReactMarkdown
                              components={{
                                pre: ({ node, children, ...props }) => {
                                  // children에서 순수 텍스트만 추출하는 함수
                                  const extractText = (element: any): string => {
                                    if (typeof element === 'string') {
                                      return element;
                                    }
                                    if (Array.isArray(element)) {
                                      return element.map(extractText).join('');
                                    }
                                    if (element?.props?.children) {
                                      return extractText(element.props.children);
                                    }
                                    return '';
                                  };

                                  const codeContent = extractText(children);

                                  return (
                                    <div className="relative group my-4">
                                      <pre {...props} className="bg-gray-900 dark:bg-gray-950 p-4 rounded-lg overflow-x-auto border border-gray-700">
                                        {children}
                                      </pre>
                                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(codeContent).then(() => {
                                              toast.success('코드가 복사되었습니다!');
                                            }).catch(() => {
                                              toast.error('복사에 실패했습니다.');
                                            });
                                          }}
                                          className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs flex items-center gap-1 transition-colors"
                                          title="복사"
                                        >
                                          <Clipboard size={14} />
                                        </button>
                                        <button
                                          onClick={() => setExpandedCode(codeContent)}
                                          className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs flex items-center gap-1 transition-colors"
                                          title="확대"
                                        >
                                          <ArrowsFullscreen size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                },
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>

                          {/* 첨부 파일 표시 */}
                          {message.files && message.files.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {message.files.map((file, fileIndex) => (
                                <div
                                  key={fileIndex}
                                  className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                                >
                                  {file.type === 'image' ? (
                                    <>
                                      <ImageIcon size={16} className="text-blue-500 flex-shrink-0" />
                                      <img
                                        src={file.data}
                                        alt={file.name}
                                        className="w-12 h-12 object-cover rounded"
                                      />
                                    </>
                                  ) : (
                                    <FileEarmarkPdf size={16} className="text-red-500 flex-shrink-0" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                      {file.name}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {(file.size / 1024).toFixed(1)} KB
                                      {file.pageCount && ` • ${file.pageCount} 페이지`}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 제안된 텍스트 표시 (요청 도구) */}
                          {message.role === 'assistant' && message.suggestedText && (
                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                제안된 변경사항
                              </div>
                              <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded-lg">
                                <div className="text-sm break-words text-gray-900 dark:text-gray-100 mb-3 prose prose-sm dark:prose-invert max-w-none">
                                  <ReactMarkdown>{message.suggestedText}</ReactMarkdown>
                                </div>
                                <div className="bg-blue-50 dark:bg-blue-900/20 flex items-center justify-between px-3 py-1 pt-1 border-t border-gray-200 dark:border-gray-600 rounded-b-lg -m-2 mt-3">
                                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                    <FileText size={12} />
                                    {message.documentName || documentTitle}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {message.applied ? (
                                      <span className="text-xs font-medium text-green-600 dark:text-green-400">
                                        적용됨.
                                      </span>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => {
                                            if (onReplaceSelection && message.suggestedText) {
                                              onReplaceSelection(message.suggestedText);
                                              toast.success('텍스트가 변경되었습니다.');
                                            }
                                            if (onClearHighlight) {
                                              onClearHighlight();
                                            }
                                            // 메시지 상태 업데이트
                                            setMessages(prevMessages => 
                                              prevMessages.map(msg => 
                                                msg.timestamp === message.timestamp 
                                                  ? { ...msg, applied: true }
                                                  : msg
                                              )
                                            );
                                          }}
                                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors"
                                        >
                                          수락
                                        </button>
                                        <button
                                          onClick={() => {
                                            toast.success('변경사항이 거절되었습니다.');
                                            if (onClearHighlight) {
                                              onClearHighlight();
                                            }
                                          }}
                                          className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-medium rounded-md transition-colors"
                                        >
                                          거절
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                        </div>
                      </div>
                    </div>
                  ))
                )}

                {/* 처리 중 표시 */}
                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 max-w-[80%]">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">응답 생성 중...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* 첨부 파일 미리보기 */}
              {uploadedFiles.length > 0 && (
                <div className="px-3 pb-2 space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg">
                      {file.type === 'image' ? (
                        <>
                          <ImageIcon size={16} className="text-blue-500 flex-shrink-0" />
                          <img src={file.data} alt={file.name} className="w-12 h-12 object-cover rounded" />
                        </>
                      ) : (
                        <FileEarmarkPdf size={16} className="text-red-500 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {(file.size / 1024).toFixed(1)} KB
                          {file.pageCount && ` • ${file.pageCount} 페이지`}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                        title="파일 제거"
                      >
                        <Trash size={14} className="text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 입력 영역 - Gemini 스타일 */}
              <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                <div className="p-4 max-w-3xl mx-auto w-full">
                  {/* 선택된 텍스트 미리보기 */}
                  {selectionPreview && (
                    <div className="mb-3 rounded-xl bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-800 dark:via-indigo-900/30 dark:to-purple-900/30 border-2 border-indigo-200 dark:border-indigo-700/50 shadow-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm border-b border-indigo-200/50 dark:border-indigo-700/30">
                        <div className="flex items-center gap-2 flex-1">
                          <div className="relative flex items-center justify-center">
                            <div className="absolute w-3 h-3 rounded-full bg-indigo-400 animate-ping opacity-75"></div>
                            <div className="relative w-2 h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600"></div>
                          </div>
                          <span className="text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">선택된 텍스트</span>
                        </div>
                        {onClearSelection && (
                          <button
                            onClick={() => {
                              console.log('Taskbar: X button clicked, calling onClearSelection');
                              onClearSelection();
                            }}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition-colors group"
                            title="선택 취소"
                          >
                            <X size={16} className="text-red-500 group-hover:text-red-600 dark:text-red-400 dark:group-hover:text-red-300" />
                          </button>
                        )}
                      </div>
                      <div className="p-2">
                        {selectionPreview.startsWith && typeof selectionPreview === 'string' && selectionPreview.startsWith('data:image') ? (
                          <img src={selectionPreview} alt="selection preview" className="w-full object-contain rounded-lg shadow-md" />
                        ) : selectionPreview.startsWith && typeof selectionPreview === 'string' && selectionPreview.startsWith('<') ? (
                          <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words max-h-32 overflow-y-auto p-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: selectionPreview }} />
                        ) : (
                          <div className="text-sm text-gray-700 dark:text-gray-300 break-words max-h-32 overflow-y-auto p-2 leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{selectionPreview}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 파일 미리보기 */}
                  {uploadedFiles.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="relative group">
                          {file.type === 'image' ? (
                            <div className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                              <img
                                src={file.data}
                                alt={file.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-20 h-20 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                              <FileEarmarkPdf size={24} className="text-red-500" />
                            </div>
                          )}
                          <button
                            onClick={() => removeFile(index)}
                            className="absolute -top-2 -right-2 bg-white dark:bg-gray-800 rounded-full p-1 shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <X size={16} className="text-gray-600 dark:text-gray-300" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="relative">
                    {/* 입력 필드 */}
                    <div className="relative">
                      <div className="flex items-end gap-2">
                        {/* 도구 선택 버튼 */}
                        <div className="relative" ref={toolsMenuRef}>
                          <button
                            onClick={() => setShowToolsMenu(!showToolsMenu)}
                            className={`py-2.5 px-2 rounded-full transition-colors flex items-center gap-2 ${
                              selectedTool
                                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'
                            }`}
                            disabled={isProcessing}
                            title="AI 도구 선택"
                          >
                            <Wrench size={20} />
                          </button>
                          
                          {/* 도구 메뉴 */}
                          {showToolsMenu && (
                            <div className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                              <div className="p-2">
                                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-2">AI 도구 선택</div>
                                <div className="space-y-1">
                                  <button
                                    onClick={() => handleAIAction('general')}
                                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                                      selectedTool === 'general'
                                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Chat size={16} />
                                      <div>
                                        <div className="font-medium">일반 대화</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">자유로운 대화 및 질문</div>
                                      </div>
                                    </div>
                                  </button>
                                  <button
                                    onClick={() => handleAIAction('code')}
                                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                                      selectedTool === 'code'
                                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Code size={16} />
                                      <div>
                                        <div className="font-medium">코드 도우미</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">코딩 질문 및 코드 생성</div>
                                      </div>
                                    </div>
                                  </button>
                                  <button
                                    onClick={() => handleAIAction('translate')}
                                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                                      selectedTool === 'translate'
                                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Translate size={16} />
                                      <div>
                                        <div className="font-medium">번역</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">텍스트 번역</div>
                                      </div>
                                    </div>
                                  </button>
                                  <button
                                    onClick={() => handleAIAction('analyze')}
                                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                                      selectedTool === 'analyze'
                                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <FileText size={16} />
                                      <div>
                                        <div className="font-medium">문서 분석</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">문서 내용 분석 및 요약</div>
                                      </div>
                                    </div>
                                  </button>
                                  <button
                                    onClick={() => handleAIAction('image')}
                                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                                      selectedTool === 'image'
                                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <ImageIcon size={16} />
                                      <div>
                                        <div className="font-medium">이미지 분석</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">이미지 설명 및 분석</div>
                                      </div>
                                    </div>
                                  </button>
                                  <button
                                    onClick={() => handleAIAction('request')}
                                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                                      selectedTool === 'request'
                                        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <FileText size={16} />
                                      <div>
                                        <div className="font-medium">요청</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">텍스트 수정 및 변경 요청</div>
                                      </div>
                                    </div>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 파일 첨부 버튼 */}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="py-2.5 px-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          disabled={isProcessing}
                          title="파일 첨부"
                        >
                          <Paperclip size={20} />
                        </button>
                        
                        {/* 메시지 입력 */}
                        <div className="flex-1 min-w-0">
                          <div className="relative">
                            <textarea
                              ref={inputRef as any}
                              value={inputValue}
                              onChange={(e) => setInputValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSend();
                                }
                              }}
                              placeholder={selectedTool ? `${getToolLabel(selectedTool)} 도구로 질문하기...` : '메시지를 입력하세요...'}
                              rows={1}
                              className="w-full max-h-32 min-h-[40px] px-4 py-2.5 pr-12 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:focus:ring-blue-500 resize-none overflow-hidden"
                              disabled={isProcessing}
                              style={{ minHeight: '40px', height: '40px' }}
                            />
                            
                            {/* 전송 버튼 */}
                            <button
                              onClick={handleSend}
                              disabled={isProcessing || (!inputValue.trim() && uploadedFiles.length === 0)}
                              className={`absolute right-2 bottom-1.5 p-1.5 rounded-full ${
                                inputValue.trim() || uploadedFiles.length > 0
                                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                                  : 'text-gray-400 dark:text-gray-500'
                              } transition-colors`}
                              title="전송"
                            >
                              {isProcessing ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transform rotate-45 -translate-x-0.5">
                                  <line x1="22" y1="2" x2="11" y2="13"></line>
                                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* 도구 팁 */}
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 px-2">
                        <span>Shift+Enter로 줄바꿈</span>
                        <div className="flex items-center gap-2">
                          {selectedTool && (
                            <span className="px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs">
                              {getToolLabel(selectedTool)} 모드
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* 숨겨진 파일 입력 */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 코드 확장 모달 */}
      {expandedCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">코드 보기</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(expandedCode).then(() => {
                      toast.success('코드가 복사되었습니다!');
                    }).catch(() => {
                      toast.error('복사에 실패했습니다.');
                    });
                  }}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors"
                  title="복사"
                >
                  <Clipboard size={20} />
                </button>
                <button
                  onClick={() => setExpandedCode(null)}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors"
                  title="닫기"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono whitespace-pre-wrap">
                {expandedCode}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Taskbar;