// src/utils/converter.ts
import TurndownService from 'turndown';
import { marked } from 'marked';

const turndownService = new TurndownService();

export const htmlToMarkdown = (html: string): string => {
  return turndownService.turndown(html);
};

export const markdownToHtml = (markdown: string): string => {
  // Use `marked` for robust Markdown -> HTML conversion so lists, headings,
  // bold/italic, links, code blocks, etc. are handled correctly.
  try {
    // marked.parse may have a union return type in some typings (string | Promise<string>).
    // In our usage we expect a synchronous string result; cast to string to satisfy TypeScript.
    return (marked.parse(markdown || '') as unknown) as string;
  } catch (e) {
    // Fallback: escape and wrap paragraphs
    return (markdown || '').split('\n\n').map(p => `<p>${p}</p>`).join('\n');
  }
};

// Very small sanitizer to remove script tags and dangerous attributes before
// injecting HTML into the DOM. This is intentionally simple (no external
// DOMPurify dependency) but removes common attack vectors used in HTML
// injection for our internal UI. If you prefer stronger sanitization install
// `dompurify` and replace this implementation.
export const sanitizeHtml = (html: string): string => {
  if (!html) return '';
  // Remove <script> tags and their content
  let out = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  // Remove on* attributes like onclick, onerror, etc.
  out = out.replace(/\son[a-z]+=\"[\s\S]*?\"/gi, '');
  out = out.replace(/\son[a-z]+=\'[\s\S]*?\'/gi, '');
  // Remove javascript: URIs
  out = out.replace(/href=\"javascript:[\s\S]*?\"/gi, 'href="#"');
  out = out.replace(/src=\"javascript:[\s\S]*?\"/gi, 'src=""');
  // Strip iframe, object, embed tags
  out = out.replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '');
  out = out.replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, '');
  out = out.replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, '');
  return out;
};

// File reading utilities
export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

export const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};