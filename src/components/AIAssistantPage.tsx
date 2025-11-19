import React, { useState, useRef, useEffect } from 'react';
import { Send, Stars, Paperclip, Image as ImageIcon, FileEarmarkPdf, Plus, Clipboard, X, Trash, ChatDots, ThreeDots, FileText } from 'react-bootstrap-icons';
import ReactMarkdown from 'react-markdown';
import { markdownToHtml, sanitizeHtml } from '../utils/converter';
import toast from 'react-hot-toast';
import { generateAIResponse, researchTopic, analyzeText, generatePersonaFeedback, answerQuestion, analyzeImage } from '../utils/ai';
import { saveAIConversation, getAIConversations, getAIConversation, updateAIConversation, deleteAIConversation, AIConversation, AIMessage } from '../utils/db';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  files?: UploadedFile[];
  tool?: string;
}

interface UploadedFile {
  name: string;
  type: 'image' | 'pdf';
  data: string;
  size: number;
  pageCount?: number;
}

const AIAssistantPage: React.FC<{ onApplySuggestion?: (text: string) => void }> = ({ onApplySuggestion }) => {
  const [currentSession, setCurrentSession] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<AIConversation[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  // track which assistant messages have been applied so we can update UI
  const [appliedMessageIndexes, setAppliedMessageIndexes] = useState<number[]>([]);

  // 메시지가 변경될 때 세션 저장
  useEffect(() => {
    if (currentSession.length > 0) {
      saveCurrentSession();
    }
  }, [currentSession]);

  // 새 메시지가 추가되면 메시지 영역을 자동으로 맨 아래로 스크롤
  useEffect(() => {
    try {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } catch (e) {
      // 무시
    }
  }, [currentSession.length]);

  // 페이지가 로드될 때 입력창에 포커스
  useEffect(() => {
    // Delay focusing slightly to avoid stealing selection when opened
    // from the editor (e.g. via AI button). Cleanup the timer on
    // unmount to avoid leaks.
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
    return () => window.clearTimeout(t);
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
          setCurrentSession(latestSession.messages.map(msg => ({
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

  // AI 기능 핸들러
  const handleAIAction = (action: string) => {
    setSelectedTool(action);
    setShowToolsMenu(false);
  };

  // 도구 레이블 가져오기
  const getToolLabel = (tool: string) => {
    switch (tool) {
      case 'research':
        return '심층 연구';
      case 'analyze':
        return '체계적 분석';
      case 'feedback':
        return '건설적 피드백';
      case 'answer':
        return '명확한 답변';
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
      default:
        return '';
    }
  };

  // 드래그 앤 드롭 핸들러
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
      toast.error('이미지 또는 PDF 파일만 업로드할 수 있습니다.');
      return;
    }

    setIsUploading(true);

    try {
      for (const file of validFiles) {
        // 파일 크기 제한 (10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name}은(는) 10MB를 초과합니다.`);
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
          // PDF 처리 (간단히 파일명만 저장)
          setUploadedFiles(prev => [...prev, {
            name: file.name,
            type: 'pdf',
            data: '', // 실제 구현에서는 PDF 처리 필요
            size: file.size
          }]);
          toast.success(`${file.name} PDF 파일이 첨부되었습니다.`);
        } else {
          toast.error(`${file.name}은(는) 지원하지 않는 파일 형식입니다. (이미지 또는 PDF만 가능)`);
        }
      }
    } catch (error) {
      console.error('File upload error:', error);
      toast.error('파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  // 파일 업로드 핸들러
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // 파일 크기 제한 (10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name}은(는) 10MB를 초과합니다.`);
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
          // PDF 처리 (간단히 파일명만 저장)
          setUploadedFiles(prev => [...prev, {
            name: file.name,
            type: 'pdf',
            data: '', // 실제 구현에서는 PDF 처리 필요
            size: file.size
          }]);
          toast.success(`${file.name} PDF 파일이 첨부되었습니다.`);
        } else {
          toast.error(`${file.name}은(는) 지원하지 않는 파일 형식입니다. (이미지 또는 PDF만 가능)`);
        }
      }
    } catch (error) {
      console.error('File upload error:', error);
      toast.error('파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 파일 제거
  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 파일 선택 핸들러
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleFileUpload(event);
    }
  };

  // 메시지 전송 핸들러
  const handleSend = async () => {
    const finalMessage = inputValue.trim();
    if (!finalMessage && uploadedFiles.length === 0) return;

    const userMessage: Message = {
      role: 'user',
      content: finalMessage,
      timestamp: new Date(),
      files: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined,
      tool: selectedTool || undefined
    };

    setCurrentSession(prev => [...prev, userMessage]);
    setInputValue('');
    setSelectedTool(null);
    const filesToSend = [...uploadedFiles];
    setUploadedFiles([]);
    setIsProcessing(true);

    try {
      let response = '';

      // 파일이 첨부된 경우
      if (filesToSend.length > 0) {
        for (const file of filesToSend) {
          if (file.type === 'image') {
            // 이미지 분석
            const imageAnalysis = await analyzeImage(file.data, finalMessage || '이 이미지를 분석해주세요.');
            response += `**${file.name} 분석 결과:**\n\n${imageAnalysis}\n\n`;
          } else if (file.type === 'pdf') {
            // PDF 분석 (간단한 구현)
            response += `**${file.name} PDF 파일이 첨부되었습니다.** PDF 분석 기능은 현재 개발 중입니다.\n\n`;
          }
        }
        
        // 파일 분석 후 추가 메시지가 있으면 일반 AI 응답 생성
        if (finalMessage && !response.includes('분석 결과')) {
          const aiResponse = await generateAIResponse(finalMessage);
          response = aiResponse;
        }
      } else {
        // 도구에 따른 AI 응답 생성
        switch (selectedTool) {
          case 'research':
            response = await researchTopic(finalMessage);
            break;
          case 'analyze':
            response = await analyzeText(finalMessage);
            break;
          case 'feedback':
            response = await generatePersonaFeedback(finalMessage, '전문가');
            break;
          case 'answer':
            response = await answerQuestion(finalMessage);
            break;
          default:
            response = await generateAIResponse(finalMessage);
            break;
        }
      }

      // For 'request' tool, parse explanation + suggestedText using '---' separator
      let aiMessage: Message;
      if (selectedTool === 'request') {
        const parts = response.split('---');
        if (parts.length >= 2) {
          const explanation = parts[0].trim();
          const suggestedText = parts.slice(1).join('---').trim();
          aiMessage = {
            role: 'assistant',
            content: explanation,
            timestamp: new Date(),
            tool: selectedTool || undefined,
          } as Message & { suggestedText?: string };
          // append suggestedText via a wrapper message object stored in session
          (aiMessage as any).suggestedText = suggestedText;
        } else {
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

      setCurrentSession(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('AI API error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: '죄송합니다. AI 응답을 생성하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
        timestamp: new Date(),
      };
      setCurrentSession(prev => [...prev, errorMessage]);
      toast.error('AI 응답 생성에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 세션 저장
  const saveCurrentSession = async () => {
    if (currentSession.length === 0) return;

    try {
      const title = currentSession[0].content.slice(0, 50) + (currentSession[0].content.length > 50 ? '...' : '');
      const conversation: AIConversation = {
        id: currentSessionId || `session_${Date.now()}`,
        title,
        messages: currentSession.map(msg => ({
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
    setCurrentSession([]);
    setCurrentSessionId(null);
    setSelectedTool(null);
  };

  // 세션 선택
  const selectSession = async (sessionId: string) => {
    try {
      const session = await getAIConversation(sessionId);
      if (session) {
        setCurrentSessionId(session.id);
        setCurrentSession(session.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          files: [],
          tool: undefined
        })));
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

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* 좌측 사이드바 - 세션 목록 */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={createNewSession}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            새 대화
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`group relative p-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${
                currentSessionId === session.id ? 'bg-purple-50 dark:bg-purple-900/20 border-l-4 border-l-purple-500' : ''
              }`}
              onClick={() => selectSession(session.id)}
            >
              <div className="pr-8">
                <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                  {session.title}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {new Date(session.updatedAt).toLocaleDateString()}
                </div>
              </div>
              {/* 삭제 버튼 - 호버 시 표시 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession(session.id);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/20 p-1 rounded transition-all"
              >
                <Trash size={14} className="text-red-500" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 메인 채팅 영역 */}
      <div className="flex-1 flex flex-col min-h-0">
        <div 
          ref={dropZoneRef}
          className="flex-1 flex flex-col relative min-h-0"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
      {/* 드래그 오버레이 */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-500/10 dark:bg-blue-400/10 backdrop-blur-sm z-50 rounded-xl border-4 border-dashed border-blue-500 dark:border-blue-400 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-blue-500/20 dark:bg-blue-400/20 flex items-center justify-center">
              <Paperclip size={40} className="text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-2">파일을 여기에 드롭하세요</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">이미지 또는 PDF 파일</p>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-500 to-blue-500">
        <div className="flex items-center gap-2">
          <h1 className="text-white font-semibold text-lg">AI 어시스턴트</h1>
          {selectedTool && (
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getToolColor(selectedTool)}`}>
              {getToolLabel(selectedTool)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {currentSession.length > 0 && (
            <button
              onClick={createNewSession}
              className="text-white/80 hover:text-white transition-colors text-sm px-2 py-1 rounded hover:bg-white/10"
            >
              대화 초기화
            </button>
          )}
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4" aria-live="polite">
        {currentSession.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
              <Stars size={32} className="text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">AI 어시스턴트와 대화하세요</h3>
            <p className="text-gray-600 dark:text-gray-400">질문을 입력하거나 파일을 첨부하여 도움을 받으세요.</p>
          </div>
        )}

        {currentSession.map((message, index) => (
          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
              {/* 도구 표시 */}
              {message.tool && (
                <div className="mb-2">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${getToolColor(message.tool)}`}>
                    {getToolLabel(message.tool)}
                  </span>
                </div>
              )}

              {/* 메시지 버블 */}
              <div className={`relative rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
              }`}>
                {/* assistant 메시지에 suggestedText가 있으면 적용 버튼을 표시 */}
                {message.role === 'assistant' && (message as any).suggestedText && (
                  <div className="absolute top-2 right-2 z-10">
                    {appliedMessageIndexes.includes(index) ? (
                      <span className="text-xs text-green-700 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">적용됨</span>
                    ) : (
                      <button
                        onClick={() => {
                          try {
                            const suggested = (message as any).suggestedText as string;
                            console.debug('AIAssistantPage: apply suggestedText', { index, suggested });
                            if (onApplySuggestion) onApplySuggestion(suggested);
                            setAppliedMessageIndexes(prev => [...prev, index]);
                          } catch (err) {
                            console.error('AIAssistantPage: failed to apply suggestion', err);
                            toast.error('제안 적용 중 오류가 발생했습니다.');
                          }
                        }}
                        className="text-xs bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 px-2 py-1 rounded shadow-sm hover:brightness-95"
                      >
                        적용
                      </button>
                    )}
                  </div>
                )}

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
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                                  <polyline points="10,17 15,12 10,7"></polyline>
                                  <line x1="15" x2="3" y1="12" y2="12"></line>
                                </svg>
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

                {/* 제안된 텍스트 표시 (요청 도구) */}
                {(message as any).suggestedText && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">제안된 변경사항</div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded-lg">
                      <div className="text-sm break-words text-gray-900 dark:text-gray-100 mb-3 prose prose-sm dark:prose-invert max-w-none">
                        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(markdownToHtml((message as any).suggestedText || '')) }} />
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 flex items-center justify-between px-3 py-1 pt-1 border-t border-gray-200 dark:border-gray-600 rounded-b-lg -m-2 mt-3">
                        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                          <FileText size={12} /> AI 제안
                        </div>
                        <div className="flex items-center gap-2">
                          {appliedMessageIndexes.includes(index) ? (
                            <span className="text-xs font-medium text-green-600 dark:text-green-400">적용됨.</span>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  try {
                                    const suggested = (message as any).suggestedText as string;
                                    if (onApplySuggestion) onApplySuggestion(suggested);
                                    setAppliedMessageIndexes(prev => [...prev, index]);
                                    toast.success('제안 적용 요청을 보냈습니다.');
                                  } catch (err) {
                                    console.error('AIAssistantPage: apply error', err);
                                    toast.error('제안 적용에 실패했습니다.');
                                  }
                                }}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors"
                              >
                                수락
                              </button>
                              <button
                                onClick={() => {
                                  toast.success('변경사항이 거절되었습니다.');
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

                {/* 첨부 파일 표시 */}
                {message.files && message.files.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {message.files.map((file, fileIndex) => (
                      <div key={fileIndex} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        {file.type === 'image' ? (
                          <ImageIcon size={16} className="text-blue-500" />
                        ) : (
                          <FileEarmarkPdf size={16} className="text-red-500" />
                        )}
                        <span className="text-sm truncate">{file.name}</span>
                        <span className="text-xs text-gray-500 ml-auto">
                          ({(file.size / 1024 / 1024).toFixed(1)}MB)
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}        {/* 처리 중 표시 */}
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
      </div>

      {/* 첨부 파일 미리보기 (입력영역으로 이동됨) */}

      {/* 입력 영역 */}
      <div className="sticky bottom-0 z-10 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4">
        {/* 첨부 파일 미리보기 (여기에 위치) */}
        {uploadedFiles.length > 0 && (
          <div className="px-3 pb-2 space-y-2">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg">
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

        <div className="flex gap-2">
          {/* 도구 메뉴 */}
          <div className="relative" ref={toolsMenuRef}>
            <button
              onClick={() => setShowToolsMenu(!showToolsMenu)}
              className={`p-3 rounded-lg border transition-colors ${
                selectedTool
                  ? 'bg-purple-100 dark:bg-purple-900/20 border-purple-300 dark:border-purple-600'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              title="AI 도구 선택"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={selectedTool ? 'text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400'}>
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
            </button>

            {showToolsMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                <div className="p-2">
                  <button
                    onClick={() => handleAIAction('research')}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors border-b border-gray-100 dark:border-gray-700"
                  >
                    <div className="font-semibold text-purple-600 dark:text-purple-400">연구</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">심층 분석 및 연구</div>
                  </button>
                  <button
                    onClick={() => handleAIAction('analyze')}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-b border-gray-100 dark:border-gray-700"
                  >
                    <div className="font-semibold text-blue-600 dark:text-blue-400">분석</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">체계적 분석</div>
                  </button>
                  <button
                    onClick={() => handleAIAction('feedback')}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors border-b border-gray-100 dark:border-gray-700"
                  >
                    <div className="font-semibold text-green-600 dark:text-green-400">피드백</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">건설적 피드백</div>
                  </button>
                  <button
                    onClick={() => handleAIAction('answer')}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                  >
                    <div className="font-semibold text-orange-600 dark:text-orange-400">답변</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">명확한 답변</div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 첨부 메뉴 */}
          <div className="relative" ref={addMenuRef}>
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="h-[42px] px-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isProcessing}
              title="추가"
            >
              <Plus size={20} />
            </button>

            {/* 추가 메뉴 */}
            {showAddMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setShowAddMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="font-semibold text-gray-700 dark:text-gray-300">📎 파일 추가</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">이미지, PDF 첨부</div>
                </button>
              </div>
            )}
          </div>

          {/* 입력창 */}
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedTool ? `${getToolLabel(selectedTool)} 도구로 질문하기...` : "메시지를 입력하세요..."}
              className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
              disabled={isProcessing}
            />
            {isUploading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>

          {/* 전송 버튼 */}
          <button
            onClick={handleSend}
            disabled={isProcessing || (!inputValue.trim() && uploadedFiles.length === 0)}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium"
          >
            <Send size={18} />
            전송
          </button>
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
    </div>
  );
};

export default AIAssistantPage;