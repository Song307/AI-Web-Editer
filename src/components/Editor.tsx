import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Strike from '@tiptap/extension-strike';
import Underline from '@tiptap/extension-underline';
import Blockquote from '@tiptap/extension-blockquote';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import { saveDocument, getDocument, Document } from '../utils/db';
import { researchTopic, analyzeText, generatePersonaFeedback } from '../utils/ai';

interface EditorProps {
  documentId?: string;
  onSave?: (doc: Document) => void;
}

const Editor: React.FC<EditorProps> = ({ documentId, onSave }) => {
  const [title, setTitle] = useState('Untitled Document');
  const [aiResponse, setAiResponse] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Strike,
      Underline,
      Blockquote,
      HorizontalRule,
    ],
    content: '<p>Start writing...</p>',
  });

  useEffect(() => {
    if (documentId && editor) {
      getDocument(documentId).then((doc) => {
        if (doc) {
          setTitle(doc.title);
          editor.commands.setContent(doc.content);
        }
      });
    }
  }, [documentId, editor]);

  const handleSave = async () => {
    if (!editor) return;

    const content = editor.getHTML();
    const doc: Document = {
      id: documentId || Date.now().toString(),
      title,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await saveDocument(doc);
    onSave?.(doc);
    alert('Document saved!');
  };

  const handleAIResearch = async () => {
    if (!editor) return;
    const selectedText = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to
    );
    if (!selectedText.trim()) {
      alert('Please select some text to research');
      return;
    }

    setIsAiLoading(true);
    try {
      const response = await researchTopic(selectedText);
      setAiResponse(response);
    } catch (error) {
      alert('AI research failed. Please check your API key.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAIAnalyze = async () => {
    if (!editor) return;
    const selectedText = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to
    );
    if (!selectedText.trim()) {
      alert('Please select some text to analyze');
      return;
    }

    setIsAiLoading(true);
    try {
      const response = await analyzeText(selectedText);
      setAiResponse(response);
    } catch (error) {
      alert('AI analysis failed. Please check your API key.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAIPersonaFeedback = async () => {
    if (!editor) return;
    const selectedText = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to
    );
    if (!selectedText.trim()) {
      alert('Please select some text for feedback');
      return;
    }

    const persona = prompt('Enter a persona (e.g., "experienced editor", "marketing expert"):');
    if (!persona) return;

    setIsAiLoading(true);
    try {
      const response = await generatePersonaFeedback(selectedText, persona);
      setAiResponse(response);
    } catch (error) {
      alert('AI feedback failed. Please check your API key.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const applyAIResponse = () => {
    if (!editor || !aiResponse) return;
    editor.commands.insertContent(aiResponse);
    setAiResponse('');
  };

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
        <button onClick={handleSave} className="save-btn">Save</button>
      </div>
      <div className="toolbar">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`btn ${editor.isActive('bold') ? 'active' : ''}`}
        >
          Bold
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`btn ${editor.isActive('italic') ? 'active' : ''}`}
        >
          Italic
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`btn ${editor.isActive('strike') ? 'active' : ''}`}
        >
          Strike
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`btn ${editor.isActive('underline') ? 'active' : ''}`}
        >
          Underline
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`btn ${editor.isActive('blockquote') ? 'active' : ''}`}
        >
          Quote
        </button>
        <button onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          HR
        </button>
        <button onClick={handleAIResearch} className="btn ai-btn" disabled={isAiLoading}>
          AI Research
        </button>
        <button onClick={handleAIAnalyze} className="btn ai-btn" disabled={isAiLoading}>
          AI Analyze
        </button>
        <button onClick={handleAIPersonaFeedback} className="btn ai-btn" disabled={isAiLoading}>
          AI Persona
        </button>
      </div>
      <EditorContent editor={editor} className="editor-content" />
      {aiResponse && (
        <div className="ai-response">
          <h3>AI Response:</h3>
          <p>{aiResponse}</p>
          <div className="response-actions">
            <button onClick={applyAIResponse} className="btn">Apply to Editor</button>
            <button onClick={() => setAiResponse('')} className="btn">Dismiss</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Editor;