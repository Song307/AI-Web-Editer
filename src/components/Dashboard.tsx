import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Image as ImageIcon, FileEarmarkPdf, Film, Folder, Plus, Trash, Search } from 'react-bootstrap-icons';
import { getAllDocuments, Document } from '../utils/db';
import toast from 'react-hot-toast';

interface DashboardProps {
  isDarkMode: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ isDarkMode }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadDocuments();
    // On dashboard mount, print any persisted workspace tasks from cookie so
    // users can see the last-known taskList even if Workspace isn't mounted.
    try {
      const cookies = document.cookie.split('; ').reduce<Record<string,string>>((acc, cur) => {
        const [k, v] = cur.split('=');
        acc[k] = v;
        return acc;
      }, {} as Record<string,string>);
      const tasksCookie = cookies['workspaceTasks'];
      if (tasksCookie) {
        try {
          const parsed = JSON.parse(decodeURIComponent(tasksCookie));
          // concise output as requested by user
          console.log('[Dashboard] Tasks :', Array.isArray(parsed) ? parsed : []);
        } catch (err) {
          console.warn('[Dashboard] Tasks :', []);
        }
      } else {
        console.log('[Dashboard] Tasks :', []);
      }
    } catch (err) {
      // swallow - non-critical
    }
  }, []);

  const loadDocuments = async () => {
    const docs = await getAllDocuments();
    const sortedDocs = docs.sort((a, b) => {
      const dateA = new Date(a.updatedAt).getTime();
      const dateB = new Date(b.updatedAt).getTime();
      return dateB - dateA;
    });
    setDocuments(sortedDocs);
  };

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'document':
        return <FileText className="w-8 h-8 text-blue-500" />;
      case 'image':
        return <ImageIcon className="w-8 h-8 text-green-500" />;
      case 'pdf':
        return <FileEarmarkPdf className="w-8 h-8 text-red-500" />;
      case 'video':
        return <Film className="w-8 h-8 text-purple-500" />;
      default:
        return <FileText className="w-8 h-8 text-gray-500" />;
    }
  };

  const handleFileClick = (doc: Document) => {
    // 워크스페이스로 이동하면서 문서 ID 전달
    navigate(`/workspace/${doc.id}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return '오늘';
    if (days === 1) return '어제';
    if (days < 7) return `${days}일 전`;
    return date.toLocaleDateString('ko-KR');
  };

  return (
    <div className="h-screen bg-white dark:bg-gray-900 overflow-hidden flex flex-col">
      {/* 헤더 */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">대시보드</h1>
        
        {/* 검색 바 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="파일 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 파일 그리드 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 150px))' }}>
          {/* 새 파일 생성 카드 */}
          <button
            onClick={() => navigate('/workspace/new')}
            className="w-[150px] h-[150px] border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex flex-col items-center justify-center group"
          >
            <Plus className="w-10 h-10 text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 mb-2" />
            <span className="text-sm font-medium text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400">새 파일</span>
          </button>

          {/* 파일 카드들 */}
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              onClick={() => handleFileClick(doc)}
              className="w-[150px] h-[150px] border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-lg transition-all cursor-pointer bg-white dark:bg-gray-800 p-3 flex flex-col group"
            >
              <div className="flex-1 flex items-center justify-center mb-2">
                {getFileIcon('document')}
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-500 dark:group-hover:text-blue-400">
                  {doc.title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(typeof doc.updatedAt === 'string' ? doc.updatedAt : doc.updatedAt.toString())}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* 빈 상태 */}
        {filteredDocuments.length === 0 && searchQuery && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <FileText className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">검색 결과가 없습니다</p>
          </div>
        )}

        {filteredDocuments.length === 0 && !searchQuery && documents.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <FileText className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">파일이 없습니다</p>
            <p className="text-sm mt-2">새 파일을 만들어보세요</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
