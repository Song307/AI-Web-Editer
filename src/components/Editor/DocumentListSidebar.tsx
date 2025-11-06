import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Plus, Trash3, Gear } from 'react-bootstrap-icons';
import { getAllDocuments, Document } from '../../utils/db';

interface DocumentListSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentSelect?: (doc: Document) => void;
  onDocumentDelete?: (id: string) => void;
  onDocumentRename?: (doc: Document) => void;
}

export interface DocumentListSidebarRef {
  refreshDocuments: () => void;
}

const DocumentListSidebar = forwardRef<DocumentListSidebarRef, DocumentListSidebarProps>(({
  isOpen, 
  onClose, 
  onDocumentSelect,
  onDocumentDelete,
  onDocumentRename
}, ref) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // 문서 목록 불러오기 함수
  const loadDocuments = useCallback(async () => {
    try {
      console.log('문서 목록 불러오기 시작');
      setIsLoading(true);
      setError(null);
      
      try {
        // 데이터베이스 초기화 확인
        console.log('데이터베이스에서 문서 가져오기 전');
        const docs = await getAllDocuments();
        console.log('가져온 문서 목록:', docs);
        
        if (!Array.isArray(docs)) {
          throw new Error('문서 목록이 배열이 아닙니다.');
        }
        
        // 최신 문서가 위로 오도록 정렬 (createdAt 기준 내림차순)
        const sortedDocs = [...docs].sort((a, b) => {
          // createdAt이 문자열인 경우 Date 객체로 변환
          const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
          const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });
        
        console.log('정렬된 문서 목록:', sortedDocs);
        setDocuments(sortedDocs);
      } catch (dbError: unknown) {
        console.error('데이터베이스 오류:', dbError);
        const errorMessage = dbError instanceof Error ? dbError.message : '알 수 없는 데이터베이스 오류가 발생했습니다.';
        throw new Error(`데이터베이스 오류: ${errorMessage}`);
      }
    } catch (err) {
      console.error('문서를 불러오는 중 오류 발생:', err);
      setError(`문서를 불러오는 중 오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ref를 통해 loadDocuments 함수 노출
  useImperativeHandle(ref, () => ({
    refreshDocuments: loadDocuments
  }), [loadDocuments]);

  // 문서 목록 불러오기
  useEffect(() => {
    if (isOpen) {
      console.log('문서 목록 사이드바 열림, 문서 로드 시작');
      loadDocuments().catch(err => {
        console.error('문서 로드 중 처리되지 않은 오류:', err);
        setError(`문서를 불러오는 중 심각한 오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`);
        setIsLoading(false);
      });
    } else {
      console.log('문서 목록 사이드바 닫힘');
    }
  }, [isOpen, loadDocuments]);

  const handleDocumentClick = (doc: Document) => {
    if (onDocumentSelect) {
      onDocumentSelect(doc);
    } else {
      // 기본 동작: 문서로 이동
      navigate(`/documents/${doc.id}`);
    }
  };

  const handleDelete = (e: React.MouseEvent, doc: Document) => {
    e.stopPropagation();
    if (window.confirm(`"${doc.title}" 문서를 정말 삭제하시겠습니까?`)) {
      if (onDocumentDelete) {
        onDocumentDelete(doc.id);
      }
      // 로컬 상태에서도 제거
      setDocuments(docs => docs.filter(d => d.id !== doc.id));
    }
  };

  const handleRename = (e: React.MouseEvent, doc: Document) => {
    e.stopPropagation();
    if (onDocumentRename) {
      onDocumentRename(doc);
    }
  };

  return (
    <div className={`flex-shrink-0 h-full bg-white dark:bg-gray-800 transition-all duration-300 ${
      isOpen ? 'w-64 border-r-2 border-gray-300 dark:border-gray-700' : 'w-0'
    } overflow-hidden flex flex-col`}>
      {isOpen && (
        <>
          {/* 사이드바 헤더 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              문서 목록
            </h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-all"
              title="닫기"
            >
              <X size={20} />
            </button>
          </div>

          {/* 문서 목록 */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* 새 문서 추가 버튼 */}
            <button
              onClick={() => navigate('/documents/new')}
              className="flex items-center justify-center w-full mb-4 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} className="mr-2" />
              새 문서 만들기
            </button>

            {isLoading ? (
              <div className="flex justify-center items-center h-20">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            ) : error ? (
              <div className="p-4 text-red-500 text-sm text-center">
                {error}
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32">
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  문서가 없습니다. 새 문서를 만들어보세요!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  최근 문서
                </h4>
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => handleDocumentClick(doc)}
                    className="group flex items-center justify-between p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center min-w-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {doc.title || '제목 없음'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(doc.updatedAt).toLocaleString('ko-KR', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleRename(e, doc)}
                        className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                        title="이름 변경"
                      >
                        <Gear size={14} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, doc)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="삭제"
                      >
                        <Trash3 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
});

DocumentListSidebar.displayName = 'DocumentListSidebar';

export default DocumentListSidebar;
