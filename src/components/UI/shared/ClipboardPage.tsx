import React, { useState, useEffect, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Clipboard2, Trash3, ClipboardCheck, Image, FileText, Inbox, FileEarmarkPdf } from 'react-bootstrap-icons';
import PDFViewer from '../../tools/PDFViewer';

interface ClipboardItem {
  id: string;
  type: 'text' | 'image' | 'pdf';
  content: string;
  timestamp: Date;
  fileName?: string;
  fileSize?: number;
}

const ClipboardPage: React.FC = () => {
  const [clipboardItems, setClipboardItems] = useState<ClipboardItem[]>([]);
  const [newText, setNewText] = useState('');
  const [history, setHistory] = useState<ClipboardItem[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [activeItem, setActiveItem] = useState<ClipboardItem | null>(null);
  const clipboardRef = useRef<HTMLDivElement>(null);
  const [isClipboardSelected, setIsClipboardSelected] = useState(false);

  useEffect(() => {
    const items = loadClipboardItems();
    if (items.length > 0) {
      setHistory([items]);
      setHistoryIndex(0);
    }
  }, []);

  // localStorage 변경 감지 (다른 컴포넌트에서의 클립보드 변경 반영)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'clipboardItems') {
        loadClipboardItems();
      }
    };

    const handleCustomClipboardChange = () => {
      loadClipboardItems();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('clipboardChanged', handleCustomClipboardChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('clipboardChanged', handleCustomClipboardChange);
    };
  }, []);

  useEffect(() => {
    // Handle Ctrl+V / Cmd+V paste event - only when clipboard is selected
    const handlePaste = async (e: ClipboardEvent) => {
      // 클립보드가 선택된 상태가 아니면 무시
      if (!isClipboardSelected) {
        return;
      }

      // 이벤트가 발생한 요소가 에디터 영역인지 확인
      const target = e.target as Element;
      if (target) {
        // 에디터 컨테이너나 그 안의 요소에서 발생한 이벤트면 무시
        if (target.id === 'editor-container' || target.closest('#editor-container')) {
          return;
        }
        // ProseMirror 요소나 그 안의 요소에서 발생한 이벤트면 무시
        if (target.classList.contains('ProseMirror') || target.closest('.ProseMirror')) {
          return;
        }
        // textarea에서 발생한 이벤트면 무시
        if (target.tagName === 'TEXTAREA') {
          return;
        }
      }

      // 포커스가 있는 요소가 에디터 영역인지 확인
      const activeElement = document.activeElement;
      if (activeElement) {
        // 에디터 컨테이너에 포커스가 있거나
        if (activeElement.id === 'editor-container' || activeElement.closest('#editor-container')) {
          return;
        }
        // ProseMirror 요소에 포커스가 있거나
        if (activeElement.classList.contains('ProseMirror') || activeElement.closest('.ProseMirror')) {
          return;
        }
        // textarea에 포커스가 있으면
        if (activeElement.tagName === 'TEXTAREA') {
          return;
        }
      }

      e.preventDefault();
      
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      // Check for image first
      const items = clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            addImageItemFromBlob(blob);
            return;
          }
        }
      }

      // If no image, get text
      const text = clipboardData.getData('text');
      if (text && text.trim()) {
        const newItem: ClipboardItem = {
          id: Date.now().toString(),
          type: 'text',
          content: text,
          timestamp: new Date(),
        };
        const updatedItems = [newItem, ...clipboardItems];
        saveClipboardItems(updatedItems);
      }
    };

    document.addEventListener('paste', handlePaste);

    // 클립보드 컴포넌트에도 paste 이벤트 리스너 추가
    if (clipboardRef.current) {
      clipboardRef.current.addEventListener('paste', handlePaste);
    }

    return () => {
      document.removeEventListener('paste', handlePaste);
      if (clipboardRef.current) {
        clipboardRef.current.removeEventListener('paste', handlePaste);
      }
    };
  }, [clipboardItems]);

  useEffect(() => {
    // Handle keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not focused on textarea
      if (document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectAll();
      } else if (e.key === 'Escape') {
        setSelectedItems([]);
      } else if (selectedItems.length > 0) {
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          deleteSelectedItems();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
          e.preventDefault();
          copySelectedItems();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
          e.preventDefault();
          cutSelectedItems();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [historyIndex, history, selectedItems, clipboardItems]);

  const handleClipboardClick = (e: React.MouseEvent) => {
    // 클립보드 영역을 클릭하면 선택 상태 토글
    e.stopPropagation();
    setIsClipboardSelected(!isClipboardSelected);
  };

  // 클립보드 외부 클릭 시 선택 해제
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clipboardRef.current && !clipboardRef.current.contains(event.target as Node)) {
        setIsClipboardSelected(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadClipboardItems = (): ClipboardItem[] => {
    const stored = localStorage.getItem('clipboardItems');
    if (stored) {
      const items = JSON.parse(stored).map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp),
      }));
      setClipboardItems(items);
      return items;
    }
    return [];
  };

  const saveClipboardItems = (items: ClipboardItem[]) => {
    localStorage.setItem('clipboardItems', JSON.stringify(items));
    setClipboardItems(items);
    
    // 다른 컴포넌트에 변경 알림
    window.dispatchEvent(new CustomEvent('clipboardChanged'));
    
    // Add to history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(items);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const previousState = history[newIndex];
      setClipboardItems(previousState);
      localStorage.setItem('clipboardItems', JSON.stringify(previousState));
      setHistoryIndex(newIndex);
      setSelectedItems([]); // 선택 해제
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const nextState = history[newIndex];
      setClipboardItems(nextState);
      localStorage.setItem('clipboardItems', JSON.stringify(nextState));
      setHistoryIndex(newIndex);
      setSelectedItems([]); // 선택 해제
    }
  };

  const selectAll = () => {
    setSelectedItems(clipboardItems.map(item => item.id));
  };

  const deleteSelectedItems = () => {
    const updatedItems = clipboardItems.filter(item => !selectedItems.includes(item.id));
    saveClipboardItems(updatedItems);
    setSelectedItems([]);
  };

  const copySelectedItems = async () => {
    const selected = clipboardItems.filter(item => selectedItems.includes(item.id));
    if (selected.length === 1) {
      await copyToClipboard(selected[0].content, selected[0].type);
    } else if (selected.length > 1) {
      // 다중 선택 시 텍스트만 복사 (간단히)
      const textContent = selected.filter(item => item.type === 'text').map(item => item.content).join('\n');
      if (textContent) {
        await navigator.clipboard.writeText(textContent);
        toast.success('선택된 텍스트가 클립보드에 복사되었습니다!');
      }
    }
  };

  const cutSelectedItems = async () => {
    await copySelectedItems();
    deleteSelectedItems();
  };

  const handleCardHeaderClick = (id: string, e: React.MouseEvent) => {
    if (e.shiftKey) {
      // Shift+클릭으로 다중 선택
      if (selectedItems.includes(id)) {
        setSelectedItems(selectedItems.filter(itemId => itemId !== id));
      } else {
        setSelectedItems([...selectedItems, id]);
      }
    } else {
      // 일반 클릭으로 단일 선택
      setSelectedItems(selectedItems.includes(id) ? [] : [id]);
    }
  };

  const addTextItem = () => {
    if (!newText.trim()) return;

    const newItem: ClipboardItem = {
      id: Date.now().toString(),
      type: 'text',
      content: newText,
      timestamp: new Date(),
    };

    const updatedItems = [newItem, ...clipboardItems];
    saveClipboardItems(updatedItems);
    setNewText('');
  };

  const addImageItem = async (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const newItem: ClipboardItem = {
        id: Date.now().toString(),
        type: 'image',
        content: reader.result as string,
        timestamp: new Date(),
      };

      const updatedItems = [newItem, ...clipboardItems];
      saveClipboardItems(updatedItems);
      toast.success('이미지가 추가되었습니다!');
    };
    reader.readAsDataURL(file);
  };

  const addImageItemFromBlob = async (blob: Blob) => {
    const reader = new FileReader();
    reader.onload = () => {
      const newItem: ClipboardItem = {
        id: Date.now().toString(),
        type: 'image',
        content: reader.result as string,
        timestamp: new Date(),
      };

      const updatedItems = [newItem, ...clipboardItems];
      saveClipboardItems(updatedItems);
      toast.success('이미지가 클립보드에서 추가되었습니다!');
    };
    reader.readAsDataURL(blob);
  };

  const addPdfItem = async (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const newItem: ClipboardItem = {
        id: Date.now().toString(),
        type: 'pdf',
        content: reader.result as string,
        timestamp: new Date(),
        fileName: file.name,
        fileSize: file.size,
      };

      const updatedItems = [newItem, ...clipboardItems];
      saveClipboardItems(updatedItems);
      toast.success('PDF 파일이 추가되었습니다!');
    };
    reader.readAsDataURL(file);
  };

  const copyToClipboard = async (content: string, type: 'text' | 'image' | 'pdf') => {
    try {
      if (type === 'text') {
        await navigator.clipboard.writeText(content);
      } else if (type === 'image') {
        // For images, we need to fetch and create a blob
        const response = await fetch(content);
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
      } else if (type === 'pdf') {
        // For PDFs, create a download link
        const link = document.createElement('a');
        link.href = content;
        link.download = 'clipboard-pdf.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('PDF 파일이 다운로드되었습니다!');
        return;
      }
      toast.success('클립보드에 복사되었습니다!');
    } catch (error) {
      toast.error('복사에 실패했습니다');
    }
  };

  const deleteItem = (id: string) => {
    const updatedItems = clipboardItems.filter(item => item.id !== id);
    saveClipboardItems(updatedItems);
  };

  const updateItemContent = (id: string, newContent: string) => {
    const updatedItems = clipboardItems.map(item => 
      item.id === id ? { ...item, content: newContent, timestamp: new Date() } : item
    );
    saveClipboardItems(updatedItems);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      addImageItem(file);
    }
  };

  const handlePdfUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      addPdfItem(file);
    }
  };

  return (
    <div 
      ref={clipboardRef} 
      className={`h-full flex flex-col bg-gray-50 dark:bg-gray-900 transition-all duration-200 ${
        isClipboardSelected 
          ? 'ring-2 ring-blue-500 ring-inset' 
          : 'hover:ring-1 hover:ring-gray-300 hover:ring-inset'
      }`}
      tabIndex={-1}
    >
      {/* Header */}
      <div 
        className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-8 shadow-lg cursor-pointer"
        onClick={handleClipboardClick}
      >
        <h2 className="text-2xl font-bold m-0 text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <ClipboardCheck size={28} /> 클립보드 관리
          {isClipboardSelected && (
            <span className="text-sm bg-blue-500 text-white px-2 py-1 rounded-full">
              선택됨
            </span>
          )}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 mb-0">
          텍스트와 이미지를 저장하고 관리하세요 · <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">헤더 클릭하여 선택</kbd> 후 <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">Ctrl+V</kbd> 붙여넣기 · <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">Ctrl+Z</kbd> 되돌리기 · <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">Backspace</kbd> 삭제 · <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">Enter</kbd> 텍스트 추가
        </p>
      </div>

      {/* Split Pane Layout */}
      <div className="flex-1 grid grid-cols-2 gap-0" style={{ height: 'calc(100vh - 140px)' }}>
        {/* Left Pane: Clipboard Items List */}
        <div className="flex flex-col h-full overflow-hidden p-6 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold m-0 text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Inbox size={20} /> 저장된 항목 ({clipboardItems.length})
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {clipboardItems.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-16 text-center h-full flex flex-col items-center justify-center">
                <Inbox size={80} className="mb-4 text-gray-400 dark:text-gray-500" />
                <p className="text-lg font-medium m-0 mb-2 text-gray-600 dark:text-gray-400">
                  저장된 클립보드 항목이 없습니다
                </p>
                <p className="text-sm m-0 text-gray-500 dark:text-gray-500">
                  아래에서 텍스트나 이미지를 추가해보세요
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {clipboardItems.map((item) => (
                  <div 
                    key={item.id} 
                    className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border overflow-hidden transition-all duration-200 cursor-pointer hover:shadow-lg ${
                      selectedItems.includes(item.id) 
                        ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900/50' 
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                    onClick={() => setActiveItem(item)}
                  >
                    {/* Header */}
                    <div 
                      className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCardHeaderClick(item.id, e);
                      }}
                    >
                      {/* Timestamp - Left */}
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {item.timestamp.toLocaleString('ko-KR', { 
                          month: 'short', 
                          day: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                      
                      {/* Action buttons - Right */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => copyToClipboard(item.content, item.type)}
                          className="p-1 bg-transparent text-gray-500 dark:text-gray-400 border-none cursor-pointer flex items-center justify-center transition-colors hover:text-blue-500"
                          title="복사"
                        >
                          <Clipboard2 size={16} />
                        </button>
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="p-1 bg-transparent text-gray-500 dark:text-gray-400 border-none cursor-pointer flex items-center justify-center transition-colors hover:text-red-500"
                          title="삭제"
                        >
                          <Trash3 size={16} />
                        </button>
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="p-4">
                      <div className="min-h-[150px] flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                        {item.type === 'image' ? (
                          <img 
                            src={item.content} 
                            alt="Clipboard item" 
                            className="max-w-full max-h-[200px] object-contain"
                          />
                        ) : item.type === 'pdf' ? (
                          <div className="flex flex-col items-center justify-center p-5 gap-3">
                            <FileEarmarkPdf size={48} className="text-red-500" />
                            <div className="text-center text-sm text-gray-900 dark:text-gray-100 font-medium">
                              {item.fileName || 'PDF 파일'}
                            </div>
                            {item.fileSize && (
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                {(item.fileSize / 1024 / 1024).toFixed(2)} MB
                              </div>
                            )}
                          </div>
                        ) : (
                          <textarea
                            value={item.content}
                            onChange={(e) => updateItemContent(item.id, e.target.value)}
                            className="w-full min-h-[150px] p-3 text-gray-900 dark:text-gray-100 text-sm break-words whitespace-pre-wrap max-h-[200px] resize-vertical bg-transparent border-none outline-none font-inherit leading-relaxed focus:bg-white dark:focus:bg-gray-800 focus:border focus:border-gray-300 dark:focus:border-gray-600 focus:rounded-lg transition-colors"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Detail View */}
        <div className="flex flex-col h-full overflow-hidden p-6 bg-white dark:bg-gray-800">
          {activeItem ? (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold m-0 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <FileText size={20} /> 항목 상세보기
                </h3>
                <button
                  onClick={() => setActiveItem(null)}
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer transition-colors hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
                >
                  닫기
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-5 border border-gray-200 dark:border-gray-700">
                  <div className="mb-4">
                    <span className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded-full border border-gray-300 dark:border-gray-600">
                      {activeItem.timestamp.toLocaleString('ko-KR')}
                    </span>
                  </div>

                  {activeItem.type === 'image' ? (
                    <div className="text-center">
                      <img 
                        src={activeItem.content} 
                        alt="Clipboard item" 
                        className="max-w-full max-h-[400px] object-contain rounded-lg shadow-lg"
                      />
                    </div>
                  ) : activeItem.type === 'pdf' ? (
                    <div style={{ height: '500px' }}>
                      <PDFViewer pdfData={activeItem.content} />
                    </div>
                  ) : (
                    <textarea
                      value={activeItem.content}
                      onChange={(e) => {
                        if (!activeItem) return;
                        const updatedItem = { ...activeItem, content: e.target.value };
                        setActiveItem(updatedItem);
                        updateItemContent(activeItem.id, e.target.value);
                      }}
                      className="w-full min-h-72 p-4 text-gray-900 dark:text-gray-100 text-sm break-words whitespace-pre-wrap bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg outline-none font-inherit leading-relaxed resize-vertical"
                    />
                  )}

                  <div className="flex gap-3 mt-5 justify-end">
                    <button
                      onClick={() => activeItem && copyToClipboard(activeItem.content, activeItem.type)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white border-none rounded-md text-sm font-medium cursor-pointer hover:bg-blue-600"
                    >
                      <Clipboard2 size={16} /> 복사
                    </button>
                    <button
                      onClick={() => {
                        if (!activeItem) return;
                        deleteItem(activeItem.id);
                        setActiveItem(null);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white border-none rounded-md text-sm font-medium cursor-pointer hover:bg-red-600"
                    >
                      <Trash3 size={16} /> 삭제
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center'
            }}>
              <FileText size={64} className="mb-4 text-gray-400 dark:text-gray-500" />
              <p className="text-lg font-medium m-0 mb-2 text-gray-600 dark:text-gray-400">
                항목을 선택하세요
              </p>
              <p className="text-sm m-0 text-gray-500 dark:text-gray-500">
                왼쪽 목록에서 항목을 클릭하면 상세 내용을 볼 수 있습니다
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add new item section - Bottom */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg p-4 px-8">
        <div className="flex gap-3 max-w-[1400px] mx-auto">
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                addTextItem();
              }
            }}
            placeholder="여기에 텍스트를 입력하세요..."
            className="flex-1 min-h-20 resize-none p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm font-inherit outline-none transition-colors focus:border-blue-500"
          />
          
          <div className="flex flex-col gap-2">
            <button 
              onClick={addTextItem} 
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white border-none rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap hover:from-blue-600 hover:to-blue-700 transition-all"
            >
              <FileText size={16} /> 텍스트 추가
            </button>
            
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              id="imageUploadFull"
            />
            <label 
              htmlFor="imageUploadFull" 
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white border-none rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap hover:from-cyan-600 hover:to-cyan-700 transition-all"
            >
              <Image size={16} /> 이미지 추가
            </label>

            <input
              type="file"
              accept=".pdf"
              onChange={handlePdfUpload}
              style={{ display: 'none' }}
              id="pdfUploadFull"
            />
            <label 
              htmlFor="pdfUploadFull" 
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white border-none rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap hover:from-red-600 hover:to-red-700 transition-all"
            >
              <FileEarmarkPdf size={16} /> PDF 추가
            </label>
          </div>
        </div>
      </div>

      
    </div>
  );
};

export default ClipboardPage;
