import React, { useState, useEffect } from 'react';
import Editor from './components/Editor';
import Clipboard from './components/Clipboard';
import { getAllDocuments, initDB, Document } from './utils/db';
import './App.css';

function App() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'clipboard'>('editor');

  useEffect(() => {
    initDB().then(() => {
      loadDocuments();
    });
  }, []);

  const loadDocuments = async () => {
    const docs = await getAllDocuments();
    setDocuments(docs);
  };

  const handleSave = (doc: Document) => {
    loadDocuments(); // Refresh the list
  };

  const createNewDocument = () => {
    setSelectedDocumentId(null);
    setActiveTab('editor');
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>AI Text Editor</h1>
      </header>
      <div className="main-layout">
        <aside className="sidebar">
          <button onClick={createNewDocument} className="new-doc-btn">New Document</button>
          <div className="tab-container">
            <button
              onClick={() => setActiveTab('editor')}
              className={`tab ${activeTab === 'editor' ? 'active' : ''}`}
            >
              Documents
            </button>
            <button
              onClick={() => setActiveTab('clipboard')}
              className={`tab ${activeTab === 'clipboard' ? 'active' : ''}`}
            >
              Clipboard
            </button>
          </div>
          {activeTab === 'editor' && (
            <div className="document-list">
              <h2 style={{ margin: '0 0 12px 0', fontSize: '1.125rem', fontWeight: '600' }}>Documents</h2>
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDocumentId(doc.id)}
                  className={`document-item ${selectedDocumentId === doc.id ? 'selected' : ''}`}
                >
                  <div className="document-title">{doc.title}</div>
                  <div className="document-date">
                    {new Date(doc.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'clipboard' && <Clipboard />}
        </aside>
        <main className="main-content">
          {activeTab === 'editor' && <Editor documentId={selectedDocumentId || undefined} onSave={handleSave} />}
          {activeTab === 'clipboard' && <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '1.125rem' }}>Use the Clipboard tab in the sidebar to manage clipboard items</div>}
        </main>
      </div>
    </div>
  );
}

export default App;
