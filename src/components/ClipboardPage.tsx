import React, { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Clipboard2, Trash3, ClipboardCheck, Image, FileText, Inbox, FileEarmarkPdf } from 'react-bootstrap-icons';
import PDFViewer from './PDFViewer';

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

  useEffect(() => {
    const items = loadClipboardItems();
    if (items.length > 0) {
      setHistory([items]);
      setHistoryIndex(0);
    }
  }, []);

  useEffect(() => {
    // Handle Ctrl+V / Cmd+V paste event
    const handlePaste = async (e: ClipboardEvent) => {
      // Only handle if not focused on textarea
      if (document.activeElement?.tagName === 'TEXTAREA') {
        return;
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
    return () => {
      document.removeEventListener('paste', handlePaste);
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
    <div className="h-full flex flex-col" style={{ background: 'var(--bg-secondary)' }}>
      {/* Header */}
      <div style={{ 
        background: 'var(--bg-primary)', 
        borderBottom: '1px solid var(--border-color)',
        padding: '24px 32px',
        boxShadow: 'var(--shadow)'
      }}>
        <h2 style={{ 
          fontSize: '1.5rem', 
          fontWeight: '700', 
          margin: '0',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <ClipboardCheck size={28} /> 클립보드 관리
        </h2>
        <p style={{ 
          fontSize: '0.875rem', 
          color: 'var(--text-secondary)', 
          margin: '8px 0 0 0' 
        }}>
          텍스트와 이미지를 저장하고 관리하세요 · <kbd style={{ 
            padding: '2px 6px', 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontFamily: 'monospace'
          }}>Ctrl+V</kbd> 빠른 추가 · <kbd style={{ 
            padding: '2px 6px', 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontFamily: 'monospace'
          }}>Ctrl+Z</kbd> 되돌리기 · <kbd style={{ 
            padding: '2px 6px', 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontFamily: 'monospace'
          }}>Backspace</kbd> 삭제 · <kbd style={{ 
            padding: '2px 6px', 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontFamily: 'monospace'
          }}>Enter</kbd> 텍스트 추가
        </p>
      </div>

      {/* Split Pane Layout */}
      <div className="flex-1 grid grid-cols-2 gap-0" style={{ height: 'calc(100vh - 140px)' }}>
        {/* Left Pane: Clipboard Items List */}
        <div className="flex flex-col h-full overflow-hidden p-6" style={{ background: 'var(--bg-secondary)' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            marginBottom: '20px' 
          }}>
            <h3 style={{ 
              fontSize: '1.125rem', 
              fontWeight: '600', 
              margin: '0',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Inbox size={20} /> 저장된 항목 ({clipboardItems.length})
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {clipboardItems.length === 0 ? (
              <div style={{
                background: 'var(--bg-primary)',
                borderRadius: 'var(--border-radius)',
                boxShadow: 'var(--shadow)',
                border: '1px solid var(--border-color)',
                padding: '64px',
                textAlign: 'center',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Inbox size={80} style={{ marginBottom: '16px', color: 'var(--text-secondary)' }} />
                <p style={{ 
                  color: 'var(--text-secondary)', 
                  fontSize: '1.125rem', 
                  fontWeight: '500',
                  margin: '0 0 8px 0'
                }}>
                  저장된 클립보드 항목이 없습니다
                </p>
                <p style={{ 
                  color: 'var(--text-secondary)', 
                  fontSize: '0.875rem',
                  margin: '0'
                }}>
                  아래에서 텍스트나 이미지를 추가해보세요
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {clipboardItems.map((item) => (
                  <div 
                    key={item.id} 
                    style={{
                      background: 'var(--bg-primary)',
                      borderRadius: 'var(--border-radius)',
                      boxShadow: 'var(--shadow)',
                      border: selectedItems.includes(item.id) ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                      overflow: 'hidden',
                      transition: 'var(--transition)',
                      cursor: 'pointer'
                    }}
                    className="clipboard-card hover:shadow-lg"
                    onClick={() => setActiveItem(item)}
                  >
                    {/* Header */}
                    <div 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCardHeaderClick(item.id, e);
                      }}
                    >
                      {/* Timestamp - Left */}
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        fontWeight: '500'
                      }}>
                        {item.timestamp.toLocaleString('ko-KR', { 
                          month: 'short', 
                          day: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                      
                      {/* Action buttons - Right */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => copyToClipboard(item.content, item.type)}
                          style={{
                            padding: '4px',
                            background: 'none',
                            color: 'var(--text-secondary)',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'var(--transition)'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-color)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                          title="복사"
                        >
                          <Clipboard2 size={16} />
                        </button>
                        <button
                          onClick={() => deleteItem(item.id)}
                          style={{
                            padding: '4px',
                            background: 'none',
                            color: 'var(--text-secondary)',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'var(--transition)'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                          title="삭제"
                        >
                          <Trash3 size={16} />
                        </button>
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div style={{ padding: '16px' }}>
                      <div style={{
                        minHeight: '150px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--bg-secondary)',
                        borderRadius: '8px',
                        overflow: 'hidden'
                      }}>
                        {item.type === 'image' ? (
                          <img 
                            src={item.content} 
                            alt="Clipboard item" 
                            style={{
                              maxWidth: '100%',
                              maxHeight: '200px',
                              objectFit: 'contain'
                            }}
                          />
                        ) : item.type === 'pdf' ? (
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '20px',
                            gap: '12px'
                          }}>
                            <FileEarmarkPdf size={48} style={{ color: '#dc2626' }} />
                            <div style={{
                              textAlign: 'center',
                              fontSize: '0.875rem',
                              color: 'var(--text-primary)',
                              fontWeight: '500'
                            }}>
                              {item.fileName || 'PDF 파일'}
                            </div>
                            {item.fileSize && (
                              <div style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-secondary)'
                              }}>
                                {(item.fileSize / 1024 / 1024).toFixed(2)} MB
                              </div>
                            )}
                          </div>
                        ) : (
                          <textarea
                            value={item.content}
                            onChange={(e) => updateItemContent(item.id, e.target.value)}
                            style={{
                              width: '100%',
                              minHeight: '150px',
                              padding: '12px',
                              color: 'var(--text-primary)',
                              fontSize: '0.875rem',
                              wordBreak: 'break-word',
                              whiteSpace: 'pre-wrap',
                              maxHeight: '200px',
                              resize: 'vertical',
                              background: 'transparent',
                              border: 'none',
                              outline: 'none',
                              fontFamily: 'inherit',
                              lineHeight: '1.5'
                            }}
                            onFocus={(e) => {
                              e.target.style.background = 'var(--bg-primary)';
                              e.target.style.border = '1px solid var(--border-color)';
                              e.target.style.borderRadius = '6px';
                            }}
                            onBlur={(e) => {
                              e.target.style.background = 'transparent';
                              e.target.style.border = 'none';
                            }}
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
        <div className="flex flex-col h-full overflow-hidden p-6" style={{ background: 'var(--bg-primary)' }}>
          {activeItem ? (
            <div className="flex flex-col h-full">
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                marginBottom: '20px',
                paddingBottom: '16px',
                borderBottom: '1px solid var(--border-color)'
              }}>
                <h3 style={{ 
                  fontSize: '1.125rem', 
                  fontWeight: '600', 
                  margin: '0',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <FileText size={20} /> 항목 상세보기
                </h3>
                <button
                  onClick={() => setActiveItem(null)}
                  style={{
                    padding: '8px 12px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    cursor: 'pointer'
                  }}
                >
                  닫기
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--border-radius)',
                  padding: '20px',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ marginBottom: '16px' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-primary)',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      border: '1px solid var(--border-color)'
                    }}>
                      {activeItem.timestamp.toLocaleString('ko-KR')}
                    </span>
                  </div>

                  {activeItem.type === 'image' ? (
                    <div style={{ textAlign: 'center' }}>
                      <img 
                        src={activeItem.content} 
                        alt="Clipboard item" 
                        style={{
                          maxWidth: '100%',
                          maxHeight: '400px',
                          objectFit: 'contain',
                          borderRadius: '8px',
                          boxShadow: 'var(--shadow)'
                        }}
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
                      style={{
                        width: '100%',
                        minHeight: '300px',
                        padding: '16px',
                        color: 'var(--text-primary)',
                        fontSize: '0.875rem',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        outline: 'none',
                        fontFamily: 'inherit',
                        lineHeight: '1.5',
                        resize: 'vertical'
                      }}
                    />
                  )}

                  <div style={{ 
                    display: 'flex', 
                    gap: '12px', 
                    marginTop: '20px',
                    justifyContent: 'flex-end'
                  }}>
                    <button
                      onClick={() => activeItem && copyToClipboard(activeItem.content, activeItem.type)}
                      style={{
                        padding: '8px 16px',
                        background: 'var(--primary-color)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <Clipboard2 size={16} /> 복사
                    </button>
                    <button
                      onClick={() => {
                        if (!activeItem) return;
                        deleteItem(activeItem.id);
                        setActiveItem(null);
                      }}
                      style={{
                        padding: '8px 16px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
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
              <FileText size={64} style={{ marginBottom: '16px', color: 'var(--text-secondary)' }} />
              <p style={{ 
                color: 'var(--text-secondary)', 
                fontSize: '1.125rem', 
                fontWeight: '500',
                margin: '0 0 8px 0'
              }}>
                항목을 선택하세요
              </p>
              <p style={{ 
                color: 'var(--text-secondary)', 
                fontSize: '0.875rem',
                margin: '0'
              }}>
                왼쪽 목록에서 항목을 클릭하면 상세 내용을 볼 수 있습니다
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add new item section - Bottom */}
      <div style={{
        background: 'var(--bg-primary)',
        borderTop: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-lg)',
        padding: '16px 32px'
      }}>
        <div style={{ display: 'flex', gap: '12px', maxWidth: '1400px', margin: '0 auto' }}>
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
            style={{
              flex: 1,
              minHeight: '80px',
              resize: 'none',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              fontFamily: 'inherit',
              outline: 'none',
              transition: 'var(--transition)'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
          />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              onClick={addTextItem} 
              style={{
                padding: '10px 24px',
                background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'var(--transition)'
              }}
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
              style={{
                padding: '10px 24px',
                background: 'linear-gradient(135deg, var(--accent-color) 0%, #0891b2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'var(--transition)'
              }}
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
              style={{
                padding: '10px 24px',
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'var(--transition)'
              }}
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
