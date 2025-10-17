import React, { useState, useEffect } from 'react';

interface ClipboardItem {
  id: string;
  type: 'text' | 'image';
  content: string;
  timestamp: Date;
}

const Clipboard: React.FC = () => {
  const [clipboardItems, setClipboardItems] = useState<ClipboardItem[]>([]);
  const [newText, setNewText] = useState('');

  useEffect(() => {
    loadClipboardItems();
  }, []);

  const loadClipboardItems = () => {
    const stored = localStorage.getItem('clipboardItems');
    if (stored) {
      const items = JSON.parse(stored).map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp),
      }));
      setClipboardItems(items);
    }
  };

  const saveClipboardItems = (items: ClipboardItem[]) => {
    localStorage.setItem('clipboardItems', JSON.stringify(items));
    setClipboardItems(items);
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
    };
    reader.readAsDataURL(file);
  };

  const copyToClipboard = async (content: string, type: 'text' | 'image') => {
    try {
      if (type === 'text') {
        await navigator.clipboard.writeText(content);
      } else {
        // For images, we need to fetch and create a blob
        const response = await fetch(content);
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
      }
      alert('Copied to clipboard!');
    } catch (error) {
      alert('Failed to copy to clipboard');
    }
  };

  const deleteItem = (id: string) => {
    const updatedItems = clipboardItems.filter(item => item.id !== id);
    saveClipboardItems(updatedItems);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      addImageItem(file);
    }
  };

  return (
    <div className="clipboard">
      <h2>Clipboard</h2>

      {/* Add new text */}
      <textarea
        value={newText}
        onChange={(e) => setNewText(e.target.value)}
        placeholder="클립보드에 텍스트 추가..."
        className="clipboard-input"
        style={{ width: '100%', minHeight: '200px', resize: 'vertical' }}
      />
      <button onClick={addTextItem} className="btn" style={{ width: '100%', marginBottom: '16px' }}>텍스트 추가</button>

      {/* File upload for images */}
      <input
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
        id="imageUpload"
      />
      <label htmlFor="imageUpload" className="btn" style={{ width: '100%', marginBottom: '16px', display: 'block', textAlign: 'center' }}>
        이미지 추가
      </label>

      {/* Clipboard items */}
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {clipboardItems.map((item) => (
          <div key={item.id} className="clipboard-item">
            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              {item.type === 'image' ? (
                <img src={item.content} alt="Clipboard item" />
              ) : (
                <div className="clipboard-text">
                  {item.content.length > 50 ? item.content.substring(0, 50) + '...' : item.content}
                </div>
              )}
            </div>
            <div className="clipboard-actions">
              <button
                onClick={() => copyToClipboard(item.content, item.type)}
                className="btn"
                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
              >
                복사
              </button>
              <button
                onClick={() => deleteItem(item.id)}
                className="delete-btn"
              >
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Clipboard;