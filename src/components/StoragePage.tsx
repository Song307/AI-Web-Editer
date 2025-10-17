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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-color mx-auto mb-4"></div>
          <p className="text-text-secondary">저장공간 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg-secondary)' }}>
      {/* Header */}
      <div style={{
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-color)',
        padding: '24px 32px',
        boxShadow: 'var(--shadow)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px'
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
            <Circle size={28} />
            저장공간
          </h2>

          <button
            onClick={clearAllData}
            disabled={documents.length === 0 && images.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: documents.length > 0 || images.length > 0 ? '#ef4444' : 'var(--bg-secondary)',
              color: documents.length > 0 || images.length > 0 ? 'white' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '6px',
              cursor: documents.length > 0 || images.length > 0 ? 'pointer' : 'not-allowed',
              fontSize: '0.875rem',
              fontWeight: '500',
              transition: 'var(--transition)'
            }}
          >
            <Trash3 size={16} />
            전체 삭제
          </button>
        </div>

        {/* Storage Overview */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px'
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px'
            }}>
              <Database size={24} style={{ color: 'var(--primary-color)' }} />
              <h3 style={{
                fontSize: '1rem',
                fontWeight: '600',
                margin: '0',
                color: 'var(--text-primary)'
              }}>
                IndexedDB 저장소
              </h3>
            </div>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              margin: '0 0 8px 0'
            }}>
              브라우저 로컬 저장소
            </p>
            <div style={{
              fontSize: '1.25rem',
              fontWeight: '700',
              color: 'var(--primary-color)'
            }}>
              {formatSize(calculateTotalSize())}
            </div>
          </div>

          <div style={{
            background: 'var(--bg-secondary)',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px'
            }}>
              <FileText size={24} style={{ color: '#10b981' }} />
              <h3 style={{
                fontSize: '1rem',
                fontWeight: '600',
                margin: '0',
                color: 'var(--text-primary)'
              }}>
                문서
              </h3>
            </div>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              margin: '0 0 8px 0'
            }}>
              저장된 문서 수
            </p>
            <div style={{
              fontSize: '1.25rem',
              fontWeight: '700',
              color: '#10b981'
            }}>
              {documents.length}개
            </div>
          </div>

          <div style={{
            background: 'var(--bg-secondary)',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px'
            }}>
              <Image size={24} style={{ color: '#f59e0b' }} />
              <h3 style={{
                fontSize: '1rem',
                fontWeight: '600',
                margin: '0',
                color: 'var(--text-primary)'
              }}>
                이미지
              </h3>
            </div>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              margin: '0 0 8px 0'
            }}>
              업로드된 이미지 수
            </p>
            <div style={{
              fontSize: '1.25rem',
              fontWeight: '700',
              color: '#f59e0b'
            }}>
              {images.length}개
            </div>
          </div>
        </div>

        {/* Storage Chart */}
        {calculateTotalSize() > 0 && (
          <div style={{
            marginTop: '24px',
            background: 'var(--bg-secondary)',
            padding: '24px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)'
          }}>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: '600',
              margin: '0 0 16px 0',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
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
            <div style={{
              marginTop: '16px',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              textAlign: 'center'
            }}>
              총 사용량: {formatSize(calculateTotalSize())}
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-8">
        <div style={{
          background: 'var(--bg-primary)',
          borderRadius: 'var(--border-radius)',
          border: '1px solid var(--border-color)',
          padding: '24px'
        }}>
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: '600',
            margin: '0 0 16px 0',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
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
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: 'var(--text-primary)',
                        marginBottom: '2px'
                      }}>
                        {doc.title}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)'
                      }}>
                        {formatSize(doc.content.length)} • {new Date(doc.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
                {documents.length > 10 && (
                  <p style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    margin: '8px 0 0 0'
                  }}>
                    외 {documents.length - 10}개 문서 더 있음...
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <h4 style={{
              fontSize: '1rem',
              fontWeight: '600',
              margin: '0 0 12px 0',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Image size={16} />
              이미지 목록 ({images.length}개)
            </h4>
            {images.length === 0 ? (
              <p style={{
                color: 'var(--text-secondary)',
                fontSize: '0.875rem',
                margin: '0'
              }}>
                업로드된 이미지가 없습니다.
              </p>
            ) : (
              <div style={{
                display: 'grid',
                gap: '8px'
              }}>
                {images.slice(0, 10).map((img) => (
                  <div
                    key={img.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      <img
                        src={URL.createObjectURL(new Blob([img.data], { type: img.type }))}
                        alt={img.name}
                        style={{
                          width: '32px',
                          height: '32px',
                          objectFit: 'cover',
                          borderRadius: '4px'
                        }}
                      />
                      <div>
                        <div style={{
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          color: 'var(--text-primary)',
                          marginBottom: '2px'
                        }}>
                          {img.name}
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)'
                        }}>
                          {formatSize(img.size)} • {new Date(img.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {images.length > 10 && (
                  <p style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    margin: '8px 0 0 0'
                  }}>
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