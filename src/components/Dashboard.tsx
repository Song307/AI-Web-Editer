import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Image as ImageIcon, FileEarmarkPdf, Film, Plus, Search } from 'react-bootstrap-icons';
import { getAllDocuments, Document, saveDocument, saveImage, ImageFile, savePdf, PDFFile, getAllImages, getAllPdfs } from '../utils/db';

interface DashboardProps {
  isDarkMode: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ isDarkMode }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [pdfs, setPdfs] = useState<PDFFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewFileModal, setShowNewFileModal] = useState(false);
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
    const imgs = await getAllImages();
    const pdfFiles = await getAllPdfs();
    
    const sortedDocs = docs.sort((a, b) => {
      const dateA = new Date(a.updatedAt).getTime();
      const dateB = new Date(b.updatedAt).getTime();
      return dateB - dateA;
    });
    
    setDocuments(sortedDocs);
    setImages(imgs);
    setPdfs(pdfFiles);
  };

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 모든 파일 타입을 하나의 배열로 합치기
  const allFiles = [
    ...documents.map(doc => ({ ...doc, fileType: 'document' as const })),
    ...images.map(img => ({ ...img, fileType: 'image' as const, title: img.name })),
    ...pdfs.map(pdf => ({ ...pdf, fileType: 'pdf' as const, title: pdf.name }))
  ].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateB - dateA;
  });

  const filteredFiles = allFiles.filter(file =>
    file.title.toLowerCase().includes(searchQuery.toLowerCase())
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

  const handleFileClick = (file: (Document & { fileType: 'document' }) | (ImageFile & { fileType: 'image' }) | (PDFFile & { fileType: 'pdf' })) => {
    // 워크스페이스로 이동하면서 파일 정보 전달
    if (file.fileType === 'document') {
      navigate(`/workspace/${file.id}`);
    } else if (file.fileType === 'image') {
      navigate('/workspace', { state: { imageId: file.id } });
    } else if (file.fileType === 'pdf') {
      navigate('/workspace', { state: { pdfId: file.id } });
    }
  };

  const handleCreateFile = (fileType: 'document' | 'image' | 'pdf') => {
    // For documents, create a persisted document first, then navigate into workspace
    if (fileType === 'document') {
      const docId = Date.now().toString();
      const newDoc: Document = {
        id: docId,
        title: '새 문서',
        content: '',
        contentType: 'markdown',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      saveDocument(newDoc).then(() => {
        // refresh dashboard list and navigate into the created document
        loadDocuments();
        navigate(`/workspace/${docId}`);
      }).catch(err => {
        console.error('문서 생성 실패:', err);
      });
    } else {
      // For images/pdfs we keep previous behavior (open workspace to upload/select)
      navigate('/workspace', { state: { createFileType: fileType } });
    }
    setShowNewFileModal(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      if (file.type.startsWith('image/')) {
        // 이미지 파일 저장
        const reader = new FileReader();
        reader.onload = async (e) => {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const imageFile: ImageFile = {
            id: Date.now().toString(),
            name: file.name,
            data: arrayBuffer,
            type: file.type,
            size: file.size,
            createdAt: new Date()
          };
          await saveImage(imageFile);
          await loadDocuments(); // 대시보드 새로고침
          setShowNewFileModal(false);
        };
        reader.readAsArrayBuffer(file);
      } else if (file.type === 'application/pdf') {
        // PDF 파일 저장
        const reader = new FileReader();
        reader.onload = async (e) => {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const pdfFile: PDFFile = {
            id: Date.now().toString(),
            name: file.name,
            data: arrayBuffer,
            type: file.type,
            size: file.size,
            createdAt: new Date()
          };
          await savePdf(pdfFile);
          await loadDocuments(); // 대시보드 새로고침
          setShowNewFileModal(false);
        };
        reader.readAsArrayBuffer(file);
      }
    } catch (error) {
      console.error('파일 저장 실패:', error);
      // 에러 처리 (토스트 메시지 등)
    }
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
          {/* 새 파일 추가 아이콘 */}
          <div
            onClick={() => setShowNewFileModal(true)}
            className="w-[150px] h-[150px] border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex flex-col items-center justify-center group cursor-pointer"
          >
            <Plus className="w-10 h-10 text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 mb-2" />
            <span className="text-sm font-medium text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400">새 파일</span>
          </div>

          {/* 파일 카드들 */}
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              onClick={() => handleFileClick(file)}
              className="w-[150px] h-[150px] border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-lg transition-all cursor-pointer bg-white dark:bg-gray-800 p-3 flex flex-col group"
            >
              <div className="flex-1 flex items-center justify-center mb-2">
                {getFileIcon(file.fileType)}
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-500 dark:group-hover:text-blue-400">
                  {file.title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(typeof file.createdAt === 'string' ? file.createdAt : file.createdAt.toString())}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* 빈 상태 */}
        {filteredFiles.length === 0 && searchQuery && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <FileText className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">검색 결과가 없습니다</p>
          </div>
        )}

        {filteredFiles.length === 0 && !searchQuery && allFiles.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <FileText className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">파일이 없습니다</p>
            <p className="text-sm mt-2">새 파일을 만들어보세요</p>
          </div>
        )}
      </div>

      {/* 새 파일 모달 */}
      {showNewFileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">새 파일 만들기</h2>
            <div className="space-y-3">
              <button
                onClick={() => handleCreateFile('document')}
                className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left flex items-center gap-3"
              >
                <FileText size={24} className="text-blue-500" />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">문서</div>
                  <div className="text-sm text-gray-500">마크다운 문서 생성</div>
                </div>
              </button>
              <label className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left flex items-center gap-3 cursor-pointer">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <FileEarmarkPdf size={24} className="text-green-500" />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">파일 업로드</div>
                  <div className="text-sm text-gray-500">이미지 또는 PDF 파일 업로드</div>
                </div>
              </label>
            </div>
            <button
              onClick={() => setShowNewFileModal(false)}
              className="mt-4 w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors text-gray-900 dark:text-white"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
