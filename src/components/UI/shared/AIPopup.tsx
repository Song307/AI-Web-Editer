import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Stars, Paperclip, Image as ImageIcon, FileEarmarkPdf, Trash, Plus, Clipboard, ArrowsFullscreen } from 'react-bootstrap-icons';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';

interface AIPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: (message: string, files?: UploadedFile[]) => Promise<string>;
  isLoading?: boolean;
  selectionPreview?: string | null;
  onClearSelection?: () => void;
}

interface Message {
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
  files?: UploadedFile[];
  tool?: string; // 사용된 도구 정보
}

interface UploadedFile {
  name: string;
  type: 'image' | 'pdf';
  data: string; // base64 for images, or array of base64 for PDF pages
  size: number;
  pageCount?: number; // PDF only
}

const AIPopup: React.FC<AIPopupProps> = ({ isOpen, onClose, onSendMessage, isLoading = false, selectionPreview = null, onClearSelection }) => {
  const [messages, setMessages] = useState<Message[]>([]);
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

  // 메시지 목록이 업데이트되면 스크롤을 맨 아래로
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 팝업이 열릴 때 입력창에 포커스
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

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
          // PDF 처리 - PDF.js 사용
          const arrayBuffer = await file.arrayBuffer();
          const pageImages = await convertPDFToImages(arrayBuffer);
          
          setUploadedFiles(prev => [...prev, {
            name: file.name,
            type: 'pdf',
            data: JSON.stringify(pageImages), // 페이지 이미지 배열을 JSON으로 저장
            size: file.size,
            pageCount: pageImages.length
          }]);
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

  // PDF를 이미지로 변환하는 함수
  const convertPDFToImages = async (arrayBuffer: ArrayBuffer): Promise<string[]> => {
    // @ts-ignore
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    
    if (!pdfjsLib) {
      throw new Error('PDF.js not loaded');
    }

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pageImages: string[] = [];

    for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 10); pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context!,
        viewport: viewport
      }).promise;

      pageImages.push(canvas.toDataURL('image/png'));
    }

    return pageImages;
  };

  // 파일 제거 핸들러
  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
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
      alert('이미지 또는 PDF 파일만 업로드할 수 있습니다.');
      return;
    }

    for (const file of validFiles) {
      await handleFileUpload({ target: { files: [file] } } as any);
    }
  };

  // 코드 복사 함수
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      toast.success('코드가 복사되었습니다!');
    }).catch(() => {
      toast.error('복사에 실패했습니다.');
    });
  };

  // 코드 확대 함수
  const expandCode = (code: string) => {
    setExpandedCode(code);
  };

  const handleSend = async () => {
    if ((!inputValue.trim() && uploadedFiles.length === 0) || isProcessing) return;

    let finalMessage = inputValue.trim();

    // 선택된 도구가 있으면 프롬프트에 추가
    if (selectedTool) {
      let toolPrompt = '';
      switch (selectedTool) {
        case 'research':
          toolPrompt = '이 내용에 대해 심층적으로 연구하고 분석해줘. 관련 개념, 배경, 응용 사례 등을 포함해서 상세히 설명해줘.\n\n';
          break;
        case 'analyze':
          toolPrompt = '이 내용을 체계적으로 분석해줘. 핵심 포인트, 장단점, 개선점 등을 구조화해서 제시해줘.\n\n';
          break;
        case 'feedback':
          toolPrompt = '이 내용에 대한 건설적인 피드백을 줘. 좋은 점과 개선할 점을 구체적으로 제안해줘.\n\n';
          break;
        case 'answer':
          toolPrompt = '이 내용과 관련된 질문에 답변해줘. 명확하고 이해하기 쉽게 설명해줘.\n\n';
          break;
      }
      finalMessage = toolPrompt + finalMessage;
    }

    const userMessage: Message = {
      role: 'user',
      content: finalMessage || '첨부된 파일을 분석해주세요.',
      timestamp: new Date(),
      files: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined,
      tool: selectedTool || undefined // 도구 정보 저장
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setSelectedTool(null); // 도구 선택 초기화
    const filesToSend = [...uploadedFiles];
    setUploadedFiles([]);
    setIsProcessing(true);

    // If there's a selection preview, include it as context in the prompt
    const composedPrompt = selectionPreview
      ? `선택된 텍스트:\n${selectionPreview}\n\n요청:\n${finalMessage || '첨부된 파일을 분석해주세요.'}`
      : finalMessage || '첨부된 파일을 분석해주세요.';

    try {
      const response = await onSendMessage(composedPrompt, filesToSend);
      
      const aiMessage: Message = {
        role: 'ai',
        content: response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage: Message = {
        role: 'ai',
        content: '죄송합니다. 응답을 생성하는 중 오류가 발생했습니다.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
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

  const handleClearChat = () => {
    setMessages([]);
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={dropZoneRef}
      className="fixed right-6 bottom-6 z-[60] w-[600px] h-[800px] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col"
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

      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-500 to-blue-500 rounded-t-xl">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-semibold text-lg">AI 어시스턴트</h3>
          {selectedTool && (
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getToolColor(selectedTool)}`}>
              {getToolLabel(selectedTool)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="text-white/80 hover:text-white transition-colors text-sm px-2 py-1 rounded hover:bg-white/10"
            >
              대화 초기화
            </button>
          )}
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <p className="text-center text-lg font-semibold">AI와 대화를 시작해보세요!</p>
            <p className="text-sm text-center mt-2">문서 작성, 아이디어 생성, 질문 답변 등<br/>무엇이든 물어보세요.</p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  }`}
                >
                  {/* 첨부된 파일 표시 */}
                  {message.files && message.files.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {message.files.map((file, fileIndex) => (
                        <div key={fileIndex} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${
                          message.role === 'user' ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                        }`}>
                          {file.type === 'image' ? <ImageIcon size={14} /> : <FileEarmarkPdf size={14} />}
                          <span className="flex-1 truncate">{file.name}</span>
                          {file.pageCount && <span>({file.pageCount}p)</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {message.role === 'user' ? (
                    <>
                      {/* 도구 아이콘 표시 */}
                      {message.tool && (
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-blue-400">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getToolColor(message.tool)}`}>
                            {getToolLabel(message.tool)}
                          </span>
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {/* 도구 프롬프트 제거하고 실제 입력 내용만 표시 */}
                        {message.tool ? message.content.split('\n\n').slice(1).join('\n\n') : message.content}
                      </p>
                    </>
                  ) : (
                    <div className="text-sm prose prose-sm dark:prose-invert max-w-none
                      [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-gray-900 [&_h1]:dark:text-white [&_h1]:border-b [&_h1]:pb-2
                      [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-gray-900 [&_h2]:dark:text-white
                      [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-gray-800 [&_h3]:dark:text-gray-100
                      [&_h4]:text-base [&_h4]:font-bold [&_h4]:mt-3 [&_h4]:mb-1 [&_h4]:text-gray-800 [&_h4]:dark:text-gray-100
                      [&_p]:my-3 [&_p]:leading-relaxed [&_p]:text-gray-700 [&_p]:dark:text-gray-300
                      [&_strong]:font-bold [&_strong]:text-gray-900 [&_strong]:dark:text-white
                      [&_em]:italic [&_em]:text-gray-700 [&_em]:dark:text-gray-300
                      [&_code]:bg-gray-200 [&_code]:dark:bg-gray-700 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono [&_code]:text-pink-600 [&_code]:dark:text-pink-400 [&_code]:font-semibold
                      [&_pre]:bg-gray-900 [&_pre]:dark:bg-gray-950 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-gray-700
                      [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-gray-100 [&_pre_code]:dark:text-gray-100 [&_pre_code]:text-sm [&_pre_code]:leading-relaxed
                      [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:my-3 [&_ul]:space-y-1
                      [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:my-3 [&_ol]:space-y-1
                      [&_li]:my-1 [&_li]:text-gray-700 [&_li]:dark:text-gray-300 [&_li]:leading-relaxed
                      [&_li>ul]:mt-2 [&_li>ol]:mt-2
                      [&_li>p]:my-1
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
                                    onClick={() => copyCode(codeContent)}
                                    className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs flex items-center gap-1 transition-colors"
                                    title="복사"
                                  >
                                    <Clipboard size={14} />
                                  </button>
                                  <button
                                    onClick={() => expandCode(codeContent)}
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
                  )}
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="animate-bounce">●</div>
                    <div className="animate-bounce delay-100">●</div>
                    <div className="animate-bounce delay-200">●</div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 입력 영역 */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        {/* 선택된 텍스트/영역 미리보기 (있을 때만) */}
        {selectionPreview && (
          <div className="mb-3 rounded-xl bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-800 dark:via-indigo-900/30 dark:to-purple-900/30 border-2 border-indigo-200 dark:border-indigo-700/50 shadow-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white/60 dark:bg-gray-900/40 backdrop-blur-sm border-b border-indigo-200/50 dark:border-indigo-700/30">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-3 h-3 rounded-full bg-indigo-400 animate-ping opacity-75"></div>
                  <div className="relative w-2 h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600"></div>
                </div>
                <span className="text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">SELECTION PREVIEW</span>
              </div>
              {onClearSelection && (
                <button
                  onClick={onClearSelection}
                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition-colors group"
                  title="선택 취소"
                >
                  <X className="w-4 h-4 text-gray-400 group-hover:text-red-500 transition-colors" />
                </button>
              )}
            </div>
            {selectionPreview.startsWith && typeof selectionPreview === 'string' && selectionPreview.startsWith('data:image') ? (
              <div className="max-h-32 overflow-auto p-3">
                <img src={selectionPreview} alt="selection preview" className="w-full object-contain rounded-lg shadow-md" />
              </div>
            ) : selectionPreview.startsWith && typeof selectionPreview === 'string' && selectionPreview.startsWith('<') ? (
              <div 
                className="text-sm max-h-32 overflow-y-auto p-4
                [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:my-4 [&_h1]:text-gray-900 [&_h1]:dark:text-white
                [&_h2]:text-xl [&_h2]:font-bold [&_h2]:my-3 [&_h2]:text-gray-800 [&_h2]:dark:text-gray-100
                [&_h3]:text-lg [&_h3]:font-bold [&_h3]:my-2 [&_h3]:text-gray-800 [&_h3]:dark:text-gray-100
                [&_p]:my-2 [&_p]:leading-relaxed [&_p]:text-gray-700 [&_p]:dark:text-gray-300
                [&_strong]:font-bold [&_strong]:text-indigo-700 [&_strong]:dark:text-indigo-300
                [&_em]:italic [&_em]:text-purple-700 [&_em]:dark:text-purple-300
                [&_code]:bg-indigo-100 [&_code]:dark:bg-indigo-900/50 [&_code]:px-2 [&_code]:py-1 [&_code]:rounded-md [&_code]:text-sm [&_code]:font-mono [&_code]:text-indigo-700 [&_code]:dark:text-indigo-300 [&_code]:font-semibold
                [&_pre]:bg-gradient-to-br [&_pre]:from-gray-900 [&_pre]:to-indigo-900 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:shadow-lg [&_pre]:border [&_pre]:border-indigo-700/30
                [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-gray-100 [&_pre_code]:dark:text-gray-100
                [&_ul]:list-none [&_ul]:ml-4 [&_ul]:my-2
                [&_ul_li]:relative [&_ul_li]:pl-6 [&_ul_li]:my-1.5 [&_ul_li]:before:content-['▸'] [&_ul_li]:before:absolute [&_ul_li]:before:left-0 [&_ul_li]:before:text-indigo-500 [&_ul_li]:before:font-bold
                [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:my-2 [&_ol]:marker:text-indigo-600 [&_ol]:marker:font-bold
                [&_li]:my-1 [&_li]:text-gray-700 [&_li]:dark:text-gray-300
                [&_blockquote]:border-l-4 [&_blockquote]:border-indigo-400 [&_blockquote]:dark:border-indigo-600 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-3 [&_blockquote]:text-gray-600 [&_blockquote]:dark:text-gray-400 [&_blockquote]:bg-indigo-50/50 [&_blockquote]:dark:bg-indigo-900/20 [&_blockquote]:py-2 [&_blockquote]:rounded-r
                [&_a]:text-indigo-600 [&_a]:dark:text-indigo-400 [&_a]:underline [&_a]:font-medium [&_a]:hover:text-purple-600
                [&_hr]:border-indigo-300 [&_hr]:dark:border-indigo-700 [&_hr]:my-4"
                dangerouslySetInnerHTML={{ __html: selectionPreview }}
              />
            ) : (
              <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words max-h-32 overflow-y-auto p-4 leading-relaxed">{selectionPreview}</div>
            )}
          </div>
        )}
        
        {/* 업로드된 파일 미리보기 */}
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
          {/* + 버튼 (파일 추가) */}
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
                  <div className="font-semibold text-gray-700 dark:text-gray-300">� 파일 추가</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">이미지, PDF 첨부</div>
                </button>
              </div>
            )}
          </div>

          {/* 도구 버튼 (AI 기능) */}
          <div className="relative" ref={toolsMenuRef}>
            <button
              onClick={() => setShowToolsMenu(!showToolsMenu)}
              className="h-[42px] px-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isProcessing}
              title="도구"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
            </button>
            
            {/* 도구 메뉴 */}
            {showToolsMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
                <button
                  onClick={() => handleAIAction('research')}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors border-b border-gray-100 dark:border-gray-700"
                >
                  <div className="font-semibold text-purple-600 dark:text-purple-400">연구</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">심층 분석 및 연구</div>
                </button>
                <button
                  onClick={() => handleAIAction('analyze')}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-b border-gray-100 dark:border-gray-700"
                >
                  <div className="font-semibold text-blue-600 dark:text-blue-400">분석</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">체계적 분석</div>
                </button>
                <button
                  onClick={() => handleAIAction('feedback')}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors border-b border-gray-100 dark:border-gray-700"
                >
                  <div className="font-semibold text-green-600 dark:text-green-400">피드백</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">건설적 피드백</div>
                </button>
                <button
                  onClick={() => handleAIAction('answer')}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                >
                  <div className="font-semibold text-orange-600 dark:text-orange-400">답변</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">명확한 답변</div>
                </button>
              </div>
            )}
          </div>

          {/* 파일 업로드 인풋 (숨김) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isProcessing}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isProcessing}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* 코드 확대 팝업 */}
      {expandedCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* 팝업 헤더 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">코드 보기</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => copyCode(expandedCode)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="복사"
                >
                  <Clipboard size={18} className="text-gray-600 dark:text-gray-400" />
                </button>
                <button
                  onClick={() => setExpandedCode(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="닫기"
                >
                  <X size={18} className="text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>
            
            {/* 코드 영역 */}
            <div className="flex-1 overflow-auto p-4">
              <pre className="bg-gray-900 dark:bg-gray-950 p-4 rounded-lg overflow-x-auto border border-gray-700">
                <code className="text-gray-100 text-sm font-mono leading-relaxed whitespace-pre">
                  {expandedCode}
                </code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIPopup;
