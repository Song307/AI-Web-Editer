export interface DocumentTab {
  id: string;
  title: string;
  content: string;
  isActive: boolean;
  contentType?: 'markdown' | 'html';
  documentId?: string; // 연결된 문서 ID (있는 경우)
}

export type ToolbarMenu = 'text' | 'insert' | 'ai' | null;
