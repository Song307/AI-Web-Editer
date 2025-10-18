import React, { useState, useEffect } from 'react';
import { Circle, Database, Image, FileText, Trash3 } from 'react-bootstrap-icons';
import { getAllDocuments, getAllImages, deleteDocument, deleteImage, Document, ImageFile } from '../utils/db';
import toast, { Toaster } from 'react-hot-toast';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const StoragePage: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStorageData();
  }, []);

  const loadStorageData = async () => {
    try {
      setLoading(true);
      const [docs, imgs] = await Promise.all([
        getAllDocuments(),
        getAllImages()
      ]);
      setDocuments(docs);
      setImages(imgs);
    } catch (error) {
      console.error('Failed to load storage data:', error);
      toast.error('저장공간 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalSize = () => {
    const docsSize = documents.reduce((total, doc) => total + doc.content.length, 0);
    const imagesSize = images.reduce((total, img) => total + img.size, 0);
    return docsSize + imagesSize;
  };

  const getChartData = () => {
    const docsSize = documents.reduce((total, doc) => total + doc.content.length, 0);
    const imagesSize = images.reduce((total, img) => total + img.size, 0);
    const totalSize = docsSize + imagesSize;

    if (totalSize === 0) return [];

    return [
      {
        name: '문서',
        value: docsSize,
        percentage: Math.round((docsSize / totalSize) * 100),
        color: '#10b981'
      },
      {
        name: '이미지',
        value: imagesSize,
        percentage: Math.round((imagesSize / totalSize) * 100),
        color: '#f59e0b'
      }
    ];
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const clearAllData = async () => {
    if (!window.confirm('정말로 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      // 모든 문서 삭제
      for (const doc of documents) {
        await deleteDocument(doc.id);
      }

      // 모든 이미지 삭제
      for (const img of images) {
        await deleteImage(img.id);
      }

      setDocuments([]);
      setImages([]);
      toast.success('모든 데이터가 삭제되었습니다.');
    } catch (error) {
      console.error('Failed to clear data:', error);
      toast.error('데이터 삭제에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">저장공간 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 overflow-y-auto">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-8 shadow-lg">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-bold m-0 text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <Database size={28} />
            저장공간
          </h2>

          <button
            onClick={clearAllData}
            disabled={documents.length === 0 && images.length === 0}
            className={`flex items-center gap-2 px-4 py-2 border-none rounded-md text-sm font-medium transition-colors ${
              documents.length > 0 || images.length > 0
                ? 'bg-red-500 text-white cursor-pointer hover:bg-red-600'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            <Trash3 size={16} />
            전체 삭제
          </button>
        </div>

        {/* Storage Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-gray-900 p-5 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <Database size={24} className="text-blue-500" />
              <h3 className="text-base font-semibold m-0 text-gray-900 dark:text-gray-100">
                IndexedDB 저장소
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 m-0 mb-2">
              브라우저 로컬 저장소
            </p>
            <div className="text-xl font-bold text-blue-500">
              {formatSize(calculateTotalSize())}
            </div>
          </div>

          <div className="bg-gray-100 dark:bg-gray-700 p-5 rounded-lg border border-gray-300 dark:border-gray-600">
            <div className="flex items-center gap-3 mb-3">
              <FileText size={24} className="text-green-500" />
              <h3 className="text-base font-semibold m-0 text-gray-900 dark:text-gray-100">
                문서
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 m-0 mb-2">
              저장된 문서 수
            </p>
            <div className="text-xl font-bold text-green-500">
              {documents.length}개
            </div>
          </div>

          <div className="bg-gray-100 dark:bg-gray-700 p-5 rounded-lg border border-gray-300 dark:border-gray-600">
            <div className="flex items-center gap-3 mb-3">
              <Image size={24} className="text-yellow-500" />
              <h3 className="text-base font-semibold m-0 text-gray-900 dark:text-gray-100">
                이미지
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 m-0 mb-2">
              업로드된 이미지 수
            </p>
            <div className="text-xl font-bold text-yellow-500">
              {images.length}개
            </div>
          </div>
        </div>

        {/* Storage Chart */}
        {calculateTotalSize() > 0 && (
          <div className="mt-6 bg-gray-100 dark:bg-gray-700 p-6 rounded-lg border border-gray-300 dark:border-gray-600">
            <h3 className="text-base font-semibold m-0 mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Database size={20} />
              저장공간 사용량 분포
            </h3>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getChartData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name}: ${percentage}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {getChartData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [formatSize(value), '크기']}
                    labelFormatter={(label) => `${label}`}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400 text-center">
              총 사용량: {formatSize(calculateTotalSize())}
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold m-0 mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Database size={20} />
            저장공간 세부 정보
          </h3>

          <div style={{ marginBottom: '24px' }}>
            <h4 style={{
              fontSize: '1rem',
              fontWeight: '600',
              margin: '0 0 12px 0',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <FileText size={16} />
              문서 목록 ({documents.length}개)
            </h4>
            {documents.length === 0 ? (
              <p style={{
                color: 'var(--text-secondary)',
                fontSize: '0.875rem',
                margin: '0'
              }}>
                저장된 문서가 없습니다.
              </p>
            ) : (
              <div style={{
                display: 'grid',
                gap: '8px'
              }}>
                {documents.slice(0, 10).map((doc) => (
                  <div
                    key={doc.id}
                    className="flex justify-between items-center p-3 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                        {doc.title}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {formatSize(doc.content.length)} • {new Date(doc.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
                {documents.length > 10 && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 mb-0">
                    외 {documents.length - 10}개 문서 더 있음...
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-base font-semibold m-0 mb-3 text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Image size={16} />
              이미지 목록 ({images.length}개)
            </h4>
            {images.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400 text-sm m-0">
                업로드된 이미지가 없습니다.
              </p>
            ) : (
              <div className="grid gap-2">
                {images.slice(0, 10).map((img) => (
                  <div
                    key={img.id}
                    className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      <img
                        src={URL.createObjectURL(new Blob([img.data], { type: img.type }))}
                        alt={img.name}
                        className="w-8 h-8 object-cover rounded"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                          {img.name}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {formatSize(img.size)} • {new Date(img.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {images.length > 10 && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 mb-0">
                    외 {images.length - 10}개 이미지 더 있음...
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default StoragePage;