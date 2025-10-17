import React, { useState, useEffect } from 'react';
import { Folder, FileText, Grid, List, Plus, Search, Trash3, Pencil, X, Image, Upload, FileEarmarkPdf, ChevronRight, ChevronDown } from  'react-bootstrap-icons';
import toast, { Toaster } from 'react-hot-toast';
import { getAllDocuments, deleteDocument, updateDocument, Document, getAllImages, saveImage, deleteImage, ImageFile, updateImage, PDFFile, savePdf, getAllPdfs, deletePdf, updatePdf } from '../utils/db';
import PDFViewer from './PDFViewer';
import ImageViewer from './tools/ImageViewer';
import RenameModal from './RenameModal';
import ConfirmModal from './ConfirmModal';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import './WorkspacePage.css';

interface WorkspacePageProps {
  onDocumentSelect?: (documentId: string) => void;
}

const WorkspacePage: React.FC<WorkspacePageProps> = ({ onDocumentSelect }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'documents' | 'images' | 'pdfs'>('all');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [documents, setDocuments] = useState<Document[]>([]);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [pdfs, setPdfs] = useState<PDFFile[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'tree'>('tree');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [draggedItem, setDraggedItem] = useState<any>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingDocument, setRenamingDocument] = useState<Document | null>(null);
  const [renamingImage, setRenamingImage] = useState<ImageFile | null>(null);
  const [renamingPdf, setRenamingPdf] = useState<PDFFile | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);
  const [selectedPdf, setSelectedPdf] = useState<ImageFile | null>(null);
  const [confirmState, setConfirmState] = useState<{ open: boolean; id?: string }>({ open: false });
  const [contextMenu, setContextMenu] = useState<{ open: boolean; x: number; y: number; target?: any }>({ open: false, x: 0, y: 0 });

  // 이미지 뷰어 닫을 때 상태 초기화
  const closeImageViewer = () => {
    setSelectedImage(null);
  };

  useEffect(() => {
    loadDocuments();
    loadImages();
    loadPdfs();
  }, []);

  const loadDocuments = async () => {
    try {
      const docs = await getAllDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load documents:', error);
      toast.error('문서를 불러오는데 실패했습니다.');
    }
  };

  const loadImages = async () => {
    try {
      const imgs = await getAllImages();
      setImages(imgs);
    } catch (error) {
      console.error('Failed to load images:', error);
      toast.error('이미지를 불러오는데 실패했습니다.');
    }
  };

  const loadPdfs = async () => {
    try {
      // PDF도 images와 같은 방식으로 저장한다고 가정
      const pdfFiles = await getAllPdfs();
      const pdfOnly = pdfFiles.filter(file => file.name.toLowerCase().endsWith('.pdf'));
      setPdfs(pdfOnly);
    } catch (error) {
      console.error('Failed to load PDFs:', error);
      toast.error('PDF를 불러오는데 실패했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmState({ open: true, id });
  };

  const confirmDelete = async () => {
    if (!confirmState.id) return setConfirmState({ open: false });
    try {
      await deleteDocument(confirmState.id);
      setDocuments(documents.filter(doc => doc.id !== confirmState.id));
        toast.success('문서가 삭제되었습니다.');
      } catch (error) {
        console.error('Failed to delete document:', error);
        toast.error('문서 삭제에 실패했습니다.');
    } finally {
      setConfirmState({ open: false });
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // 이미지 파일만 허용
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name}은(는) 이미지 파일이 아닙니다.`);
        continue;
      }

      // 파일 크기 제한 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}의 크기가 너무 큽니다. (최대 10MB)`);
        continue;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        const imageData: ImageFile = {
          id: `img_${Date.now()}_${i}`,
          name: file.name,
          data: arrayBuffer,
          type: file.type,
          size: file.size,
          createdAt: new Date()
        };

        await saveImage(imageData);
        setImages(prev => [...prev, imageData]);
        toast.success(`${file.name}이(가) 업로드되었습니다.`);
      } catch (error) {
        console.error('Failed to save image:', error);
        toast.error(`${file.name} 업로드에 실패했습니다.`);
      }
    }

    // input 초기화
    event.target.value = '';
  };

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // PDF 파일만 허용
      if (file.type !== 'application/pdf') {
        toast.error(`${file.name}은(는) PDF 파일이 아닙니다.`);
        continue;
      }

      // 파일 크기 제한 (20MB for PDFs)
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name}의 크기가 너무 큽니다. (최대 20MB)`);
        continue;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfData: PDFFile = {
          id: `pdf_${Date.now()}_${i}`,
          name: file.name,
          data: arrayBuffer,
          type: file.type,
          size: file.size,
          createdAt: new Date()
        };

        await savePdf(pdfData);
        setPdfs(prev => [...prev, pdfData]);
        toast.success(`${file.name}이(가) 업로드되었습니다.`);
      } catch (error) {
        console.error('Failed to save PDF:', error);
        toast.error(`${file.name} 업로드에 실패했습니다.`);
      }
    }

    // input 초기화
    event.target.value = '';
  };

  const handleImageDelete = async (id: string) => {
    if (window.confirm('정말로 이 이미지를 삭제하시겠습니까?')) {
      try {
        await deleteImage(id);
        setImages(images.filter(img => img.id !== id));
        if (selectedImage?.id === id) {
          setSelectedImage(null);
        }
        toast.success('이미지가 삭제되었습니다.');
      } catch (error) {
        console.error('Failed to delete image:', error);
        toast.error('이미지 삭제에 실패했습니다.');
      }
    }
  };

  const handlePdfDelete = async (id: string) => {
    if (window.confirm('정말로 이 PDF를 삭제하시겠습니까?')) {
      try {
        await deletePdf(id);
        setPdfs(pdfs.filter(pdf => pdf.id !== id));
        if (selectedPdf?.id === id) {
          setSelectedPdf(null);
        }
        toast.success('PDF가 삭제되었습니다.');
      } catch (error) {
        console.error('Failed to delete PDF:', error);
        toast.error('PDF 삭제에 실패했습니다.');
      }
    }
  };

  const handleImageView = (image: ImageFile) => {
    setSelectedImage(image);
  };

  const handlePdfView = (pdf: ImageFile) => {
    setSelectedPdf(pdf);
  };

  const closeContextMenu = () => setContextMenu({ open: false, x: 0, y: 0 });

  // 파일들을 폴더별로 그룹화하는 함수
  const groupFilesByFolder = (files: any[]) => {
    const folderMap = new Map<string, any[]>();

    files.forEach(file => {
      // 파일 이름에서 폴더 경로 추출 (없으면 'root'로 설정)
      const folderPath = file.folder || 'root';
      if (!folderMap.has(folderPath)) {
        folderMap.set(folderPath, []);
      }
      folderMap.get(folderPath)!.push(file);
    });

    // expandedFolders에 있는 빈 폴더들도 추가
    expandedFolders.forEach(folderPath => {
      if (!folderMap.has(folderPath)) {
        folderMap.set(folderPath, []);
      }
    });

    return folderMap;
  };

  // 폴더 토글 함수
  const toggleFolder = (folderPath: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  // 드래그 앤 드롭 함수들
  const handleDragStart = (e: React.DragEvent, item: any) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, folderPath: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(folderPath);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // 폴더 영역을 벗어날 때만 dragOverFolder를 null로 설정
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverFolder(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetFolder: string) => {
    e.preventDefault();
    setDragOverFolder(null);

    if (!draggedItem) return;

    try {
      // 아이템의 폴더 정보 업데이트
      if (draggedItem.type === 'document') {
        await updateDocument(draggedItem.id, { ...draggedItem, folder: targetFolder });
        // 로컬 상태 업데이트
        setDocuments(prev => prev.map(doc =>
          doc.id === draggedItem.id ? { ...doc, folder: targetFolder } : doc
        ));
      } else if (draggedItem.type === 'image') {
        await updateImage(draggedItem.id, { ...draggedItem, folder: targetFolder });
        setImages(prev => prev.map(img =>
          img.id === draggedItem.id ? { ...img, folder: targetFolder } : img
        ));
      } else if (draggedItem.type === 'pdf') {
        await updatePdf(draggedItem.id, { ...draggedItem, folder: targetFolder });
        setPdfs(prev => prev.map(pdf =>
          pdf.id === draggedItem.id ? { ...pdf, folder: targetFolder } : pdf
        ));
      }

      setDraggedItem(null);
      toast.success('파일이 폴더로 이동되었습니다.');
    } catch (error) {
      console.error('파일 이동 실패:', error);
      toast.error('파일 이동에 실패했습니다.');
    }
  };

  // 새 폴더 만들기 함수
  const handleCreateNewFolder = () => {
    if (!newFolderName.trim()) return;

    // expandedFolders에 새 폴더 추가
    const newExpanded = new Set(expandedFolders);
    newExpanded.add(newFolderName.trim());
    setExpandedFolders(newExpanded);

    setShowNewFolderModal(false);
    setNewFolderName('');
    toast.success(`새 폴더 "${newFolderName}"가 생성되었습니다.`);
  };

  const openContextForItem = (e: React.MouseEvent, item: any) => {
    console.log('Right-click detected!', e);
    e.preventDefault();
    e.stopPropagation();
    const x = e.clientX;
    const y = e.clientY;
    console.log('Mouse click position:', { x, y, clientX: e.clientX, clientY: e.clientY });
    setContextMenu({ open: true, x, y, target: item });
  };

  const getContextMenuItems = (item: any): ContextMenuItem[] => {
    if (!item) return [];
    if (item.type === 'document' || (item as any).content !== undefined) {
      return [
        { label: '열기', onClick: () => onDocumentSelect?.(item.id) },
        { label: '이름 변경', onClick: () => handleRenameStart(item) },
        { label: '삭제', onClick: () => handleDelete(item.id), danger: true },
      ];
    }
    if (item.type === 'image' || (item as any).data) {
      return [
        { label: '보기', onClick: () => handleImageView(item) },
        { label: '이름 변경', onClick: () => handleRenameImageStart(item) },
        { label: '삭제', onClick: () => handleImageDelete(item.id), danger: true },
      ];
    }
    if (item.type === 'pdf') {
      return [
        { label: '보기', onClick: () => handlePdfView(item) },
        { label: '이름 변경', onClick: () => handleRenamePdfStart(item) },
        { label: '삭제', onClick: () => handlePdfDelete(item.id), danger: true },
      ];
    }
    return [];
  };

  const handleRenameStart = (doc: Document) => {
    setRenamingDocument(doc);
    setNewTitle(doc.title);
  };

  const handleRenameCancel = () => {
    setRenamingDocument(null);
    setNewTitle('');
  };

  const handleRenameConfirm = async () => {
    if (!renamingDocument || !newTitle.trim()) return;

    try {
      await updateDocument(renamingDocument.id, { title: newTitle.trim() });
      setDocuments(documents.map(doc => 
        doc.id === renamingDocument.id 
          ? { ...doc, title: newTitle.trim(), updatedAt: new Date() }
          : doc
      ));
      setRenamingDocument(null);
      setNewTitle('');
      toast.success('문서 이름이 변경되었습니다.');
    } catch (error) {
      console.error('Failed to rename document:', error);
      toast.error('문서 이름 변경에 실패했습니다.');
    }
  };

  // 이미지 이름 변경 함수들
  const handleRenameImageStart = (image: ImageFile) => {
    setRenamingImage(image);
    setNewTitle(image.name);
  };

  const handleRenameImageCancel = () => {
    setRenamingImage(null);
    setNewTitle('');
  };

  const handleRenameImageConfirm = async () => {
    if (!renamingImage || !newTitle.trim()) return;

    try {
      await updateImage(renamingImage.id, { name: newTitle.trim() });
      setImages(images.map(img => 
        img.id === renamingImage.id 
          ? { ...img, name: newTitle.trim() }
          : img
      ));
      setRenamingImage(null);
      setNewTitle('');
      toast.success('이미지 이름이 변경되었습니다.');
    } catch (error) {
      console.error('Failed to rename image:', error);
      toast.error('이미지 이름 변경에 실패했습니다.');
    }
  };

  // PDF 이름 변경 함수들
  const handleRenamePdfStart = (pdf: PDFFile) => {
    setRenamingPdf(pdf);
    setNewTitle(pdf.name);
  };

  const handleRenamePdfCancel = () => {
    setRenamingPdf(null);
    setNewTitle('');
  };

  const handleRenamePdfConfirm = async () => {
    if (!renamingPdf || !newTitle.trim()) return;

    try {
      await updatePdf(renamingPdf.id, { name: newTitle.trim() });
      setPdfs(pdfs.map(pdf => 
        pdf.id === renamingPdf.id 
          ? { ...pdf, name: newTitle.trim() }
          : pdf
      ));
      setRenamingPdf(null);
      setNewTitle('');
      toast.success('PDF 이름이 변경되었습니다.');
    } catch (error) {
      console.error('Failed to rename PDF:', error);
      toast.error('PDF 이름 변경에 실패했습니다.');
    }
  };

  const filteredAndSortedDocuments = documents
    .filter(doc =>
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      let aValue: string | number | Date;
      let bValue: string | number | Date;

      switch (sortBy) {
        case 'name':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'date':
          aValue = new Date(a.updatedAt);
          bValue = new Date(b.updatedAt);
          break;
        case 'size':
          aValue = a.content.length;
          bValue = b.content.length;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  const filteredAndSortedImages = images
    .filter(img =>
      img.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      let aValue: string | number | Date;
      let bValue: string | number | Date;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'date':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        case 'size':
          aValue = a.size;
          bValue = b.size;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  const filteredAndSortedPdfs = pdfs
    .filter(pdf =>
      pdf.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      let aValue: string | number | Date;
      let bValue: string | number | Date;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'date':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        case 'size':
          aValue = a.size;
          bValue = b.size;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  // 전체보기 탭을 위한 통합 필터링
  const filteredAndSortedAll = [
    ...filteredAndSortedDocuments.map(doc => ({ ...doc, type: 'document' as const })),
    ...filteredAndSortedImages.map(img => ({ ...img, type: 'image' as const })),
    ...filteredAndSortedPdfs.map(pdf => ({ ...pdf, type: 'pdf' as const }))
  ].sort((a, b) => {
    let aValue: string | number | Date;
    let bValue: string | number | Date;

    switch (sortBy) {
      case 'name':
        aValue = a.type === 'document' ? a.title.toLowerCase() : a.name.toLowerCase();
        bValue = b.type === 'document' ? b.title.toLowerCase() : b.name.toLowerCase();
        break;
      case 'date':
        aValue = new Date(a.type === 'document' ? a.updatedAt : a.createdAt);
        bValue = new Date(b.type === 'document' ? b.updatedAt : b.createdAt);
        break;
      case 'size':
        aValue = a.type === 'document' ? a.content.length : a.size;
        bValue = b.type === 'document' ? b.content.length : b.size;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const formatFileSize = (content: string) => {
    const bytes = new Blob([content]).size;
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const GridView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {filteredAndSortedDocuments.map((doc) => (
        <div
          key={doc.id}
          className="document-card group"
          style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--border-radius)',
            boxShadow: 'var(--shadow)',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            transition: 'var(--transition)',
            cursor: 'pointer'
          }}
          onClick={() => onDocumentSelect?.(doc.id)}
        >
          {/* Document Icon */}
          <div style={{
            padding: '24px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-color)'
          }}>
            <FileText size={48} style={{ color: 'var(--primary-color)' }} />
          </div>
          {/* 이름 변경 모달 */}
          <RenameModal
            isOpen={!!renamingDocument || !!renamingImage || !!renamingPdf}
            title={renamingDocument ? '문서 이름 변경' : renamingImage ? '이미지 이름 변경' : renamingPdf ? 'PDF 이름 변경' : '이름 변경'}
            label={'새 이름'}
            placeholder={'새 이름을 입력하세요'}
            value={newTitle}
            onChange={setNewTitle}
            onCancel={() => {
              if (renamingDocument) setRenamingDocument(null);
              if (renamingImage) setRenamingImage(null);
              if (renamingPdf) setRenamingPdf(null);
              setNewTitle('');
            }}
            onConfirm={() => {
              if (renamingDocument) return handleRenameConfirm();
              if (renamingImage) return handleRenameImageConfirm();
              if (renamingPdf) return handleRenamePdfConfirm();
            }}
            confirmText={'확인'}
            cancelText={'취소'}
          />
          {/* 문서 삭제 확인 모달 */}
          <ConfirmModal
            isOpen={confirmState.open}
            title={'문서 삭제'}
            message={'정말로 이 문서를 삭제하시겠습니까? 되돌릴 수 없습니다.'}
            confirmText={'삭제'}
            cancelText={'취소'}
            onConfirm={confirmDelete}
            onCancel={() => setConfirmState({ open: false })}
          />

          {/* Document Info */}
          <div style={{ padding: '16px' }}>
            <h3 style={{
              fontSize: '0.875rem',
              fontWeight: '600',
              margin: '0 0 8px 0',
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {doc.title}
            </h3>

            <div style={{
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              marginBottom: '8px'
            }}>
              {formatFileSize(doc.content)}
            </div>

            <div style={{
              fontSize: '0.75rem',
              color: 'var(--text-secondary)'
            }}>
              {new Date(doc.updatedAt).toLocaleString('ko-KR', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>

          {/* Hover Actions */}
          <div className="document-actions" style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            display: 'flex',
            gap: '4px',
            opacity: 0,
            transition: 'opacity 0.2s ease'
          }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRenameStart(doc);
              }}
              style={{
                padding: '6px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="이름 변경"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(doc.id);
              }}
              style={{
                padding: '6px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="삭제"
              onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
            >
              <Trash3 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const ListView = () => (
    <div style={{
      background: 'var(--bg-primary)',
      borderRadius: 'var(--border-radius)',
      border: '1px solid var(--border-color)',
      overflow: 'hidden'
    }}>
      {/* List Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 120px 120px 80px',
        gap: '16px',
        padding: '12px 20px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        fontSize: '0.75rem',
        fontWeight: '600',
        color: 'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        <div>이름</div>
        <div>크기</div>
        <div>수정일</div>
        <div>작업</div>
      </div>

      {/* List Items */}
      {filteredAndSortedDocuments.map((doc) => (
        <div
          key={doc.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 120px 120px 80px',
            gap: '16px',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            cursor: 'pointer',
            transition: 'var(--transition)',
            alignItems: 'center'
          }}
          onClick={() => onDocumentSelect?.(doc.id)}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          {/* Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FileText size={20} style={{ color: 'var(--primary-color)' }} />
            <div>
              <div style={{
                fontSize: '0.875rem',
                fontWeight: '500',
                color: 'var(--text-primary)',
                marginBottom: '2px'
              }}>
                {doc.title}
              </div>
              
            </div>
          </div>

          {/* Size */}
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--text-secondary)'
          }}>
            {formatFileSize(doc.content)}
          </div>

          {/* Date */}
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--text-secondary)'
          }}>
            {new Date(doc.updatedAt).toLocaleString('ko-KR', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRenameStart(doc);
              }}
              style={{
                padding: '4px',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                borderRadius: '4px'
              }}
              title="이름 변경"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(doc.id);
              }}
              style={{
                padding: '4px',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                borderRadius: '4px'
              }}
              title="삭제"
              onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
            >
              <Trash3 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg-secondary)' }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: 'var(--text-primary)',
            margin: 0
          }}>
            작업 공간
          </h1>

            {/* View Mode Toggle */}
          <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setViewMode('grid')}
                style={{
                padding: '8px',
                background: viewMode === 'grid' ? 'var(--primary-color)' : 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: viewMode === 'grid' ? 'white' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                justifyContent: 'center'
                }}
              title="그리드 보기"
              >
                <Grid size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                style={{
                padding: '8px',
                background: viewMode === 'list' ? 'var(--primary-color)' : 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: viewMode === 'list' ? 'white' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                justifyContent: 'center'
                }}
              title="리스트 보기"
              >
                <List size={16} />
              </button>
              <button
                onClick={() => setViewMode('tree')}
                style={{
                padding: '8px',
                background: viewMode === 'tree' ? 'var(--primary-color)' : 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: viewMode === 'tree' ? 'white' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                justifyContent: 'center'
                }}
              title="트리 보기"
              >
                <Folder size={16} />
              </button>
              {viewMode === 'tree' && (
                <button
                  onClick={() => setShowNewFolderModal(true)}
                  style={{
                    padding: '8px 12px',
                    background: 'var(--primary-color)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.875rem'
                  }}
                  title="새 폴더 만들기"
                >
                  <Plus size={14} />
                  새 폴더
                </button>
              )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '20px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '12px'
        }}>
          <button
            onClick={() => setActiveTab('all')}
            style={{
              padding: '8px 16px',
              background: activeTab === 'all' ? 'var(--primary-color)' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: activeTab === 'all' ? 'white' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            전체보기
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            style={{
              padding: '8px 16px',
              background: activeTab === 'documents' ? 'var(--primary-color)' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: activeTab === 'documents' ? 'white' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            문서
          </button>
          <button
            onClick={() => setActiveTab('images')}
            style={{
              padding: '8px 16px',
              background: activeTab === 'images' ? 'var(--primary-color)' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: activeTab === 'images' ? 'white' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            이미지
          </button>
          <button
            onClick={() => setActiveTab('pdfs')}
            style={{
              padding: '8px 16px',
              background: activeTab === 'pdfs' ? 'var(--primary-color)' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: activeTab === 'pdfs' ? 'white' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            PDF
          </button>
        </div>

        {/* Search and Sort Controls */}
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center'
        }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)'
            }} />
            <input
              type="text"
              placeholder="검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '0.875rem'
              }}
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'date' | 'size')}
            style={{
              padding: '8px 12px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '0.875rem'
            }}
          >
            <option value="name">이름</option>
            <option value="date">날짜</option>
            <option value="size">크기</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            style={{
              padding: '8px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
            title={sortOrder === 'asc' ? '내림차순' : '오름차순'}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '20px', overflow: 'auto' }}>
        {activeTab === 'all' && (
          <div>
            {viewMode === 'grid' ? (
              /* 그리드 뷰 */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredAndSortedAll.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="file-card group"
                    style={{
                      background: 'var(--bg-primary)',
                      borderRadius: 'var(--border-radius)',
                      boxShadow: 'var(--shadow)',
                      border: '1px solid var(--border-color)',
                      overflow: 'hidden',
                      transition: 'var(--transition)',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      if (item.type === 'document') onDocumentSelect?.(item.id);
                      else if (item.type === 'image') handleImageView(item);
                      else if (item.type === 'pdf') handlePdfView(item);
                    }}
                    onContextMenu={(e) => openContextForItem(e, item)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                  >
                    {/* File Icon */}
                    <div style={{
                      padding: '24px',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      background: 'var(--bg-secondary)',
                      borderBottom: '1px solid var(--border-color)'
                    }}>
                      {item.type === 'document' && <FileText size={48} style={{ color: 'var(--primary-color)' }} />}
                      {item.type === 'image' && <Image size={48} style={{ color: '#10b981' }} />}
                      {item.type === 'pdf' && <FileEarmarkPdf size={48} style={{ color: '#ef4444' }} />}
                    </div>

                    {/* File Info */}
                    <div style={{ padding: '16px' }}>
                      <h3 style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        margin: '0 0 8px 0',
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {item.type === 'document' ? item.title : item.name}
                      </h3>

                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '8px'
                      }}>
                        {item.type === 'document' ? formatFileSize(item.content) : `${(item.size / 1024).toFixed(1)} KB`}
                      </div>

                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)'
                      }}>
                        {new Date(item.type === 'document' ? item.updatedAt : item.createdAt).toLocaleString('ko-KR', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>

                    {/* Hover Actions */}
                    <div className="file-actions" style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      display: 'flex',
                      gap: '4px',
                      opacity: 0,
                      transition: 'opacity 0.2s ease'
                    }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.type === 'document') handleRenameStart(item);
                          else if (item.type === 'image') handleRenameImageStart(item);
                          else if (item.type === 'pdf') handleRenamePdfStart(item);
                        }}
                        style={{
                          padding: '6px',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="이름 변경"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.type === 'document') handleDelete(item.id);
                          else if (item.type === 'image') deleteImage(item.id);
                          else if (item.type === 'pdf') deletePdf(item.id);
                        }}
                        style={{
                          padding: '6px',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="삭제"
                        onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                      >
                        <Trash3 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : viewMode === 'list' ? (
              /* 리스트 뷰 */
              <div style={{
                background: 'var(--bg-primary)',
                borderRadius: 'var(--border-radius)',
                border: '1px solid var(--border-color)',
                overflow: 'hidden'
              }}>
                {/* List Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 120px 80px',
                  gap: '16px',
                  padding: '12px 20px',
                  background: 'var(--bg-secondary)',
                  borderBottom: '1px solid var(--border-color)',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  <div>이름</div>
                  <div>크기</div>
                  <div>수정일</div>
                  <div>작업</div>
                </div>

                {/* List Items */}
                {filteredAndSortedAll.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 120px 120px 80px',
                      gap: '16px',
                      padding: '16px 20px',
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'var(--transition)',
                      alignItems: 'center'
                    }}
                    onClick={() => {
                      if (item.type === 'document') onDocumentSelect?.(item.id);
                      else if (item.type === 'image') handleImageView(item);
                      else if (item.type === 'pdf') handlePdfView(item);
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    onContextMenu={(e) => openContextForItem(e, item)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                  >
                    {/* Name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {item.type === 'document' && <FileText size={20} style={{ color: 'var(--primary-color)' }} />}
                      {item.type === 'image' && <Image size={20} style={{ color: '#10b981' }} />}
                      {item.type === 'pdf' && <FileEarmarkPdf size={20} style={{ color: '#ef4444' }} />}
                      <div>
                        <div style={{
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          color: 'var(--text-primary)',
                          marginBottom: '2px'
                        }}>
                          {item.type === 'document' ? item.title : item.name}
                        </div>
                      </div>
                    </div>

                    {/* Size */}
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)'
                    }}>
                      {item.type === 'document' ? formatFileSize(item.content) : `${(item.size / 1024).toFixed(1)} KB`}
                    </div>

                    {/* Date */}
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)'
                    }}>
                      {new Date(item.type === 'document' ? item.updatedAt : item.createdAt).toLocaleString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.type === 'document') handleRenameStart(item);
                          else if (item.type === 'image') handleRenameImageStart(item);
                          else if (item.type === 'pdf') handleRenamePdfStart(item);
                        }}
                        style={{
                          padding: '4px',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          borderRadius: '4px'
                        }}
                        title="이름 변경"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.type === 'document') handleDelete(item.id);
                          else if (item.type === 'image') deleteImage(item.id);
                          else if (item.type === 'pdf') deletePdf(item.id);
                        }}
                        style={{
                          padding: '4px',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          borderRadius: '4px'
                        }}
                        title="삭제"
                        onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                      >
                        <Trash3 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* 트리 뷰 */
              <div style={{
                background: 'var(--bg-primary)',
                borderRadius: 'var(--border-radius)',
                border: '1px solid var(--border-color)',
                overflow: 'hidden'
              }}>
                {Array.from(groupFilesByFolder(filteredAndSortedAll)).map(([folderPath, files]) => (
                  <div key={folderPath}>
                    {/* 폴더 헤더 */}
                    <div
                      onClick={() => toggleFolder(folderPath)}
                      onDragOver={(e) => handleDragOver(e, folderPath)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, folderPath)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px 16px',
                        background: dragOverFolder === folderPath ? 'var(--primary-color)' : 'var(--bg-secondary)',
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'var(--transition)'
                      }}
                      onMouseEnter={(e) => {
                        if (dragOverFolder !== folderPath) {
                          e.currentTarget.style.background = 'var(--bg-primary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (dragOverFolder !== folderPath) {
                          e.currentTarget.style.background = 'var(--bg-secondary)';
                        }
                      }}
                    >
                      {expandedFolders.has(folderPath) ? (
                        <ChevronDown size={16} style={{ color: 'var(--text-secondary)', marginRight: '8px' }} />
                      ) : (
                        <ChevronRight size={16} style={{ color: 'var(--text-secondary)', marginRight: '8px' }} />
                      )}
                      <Folder size={18} style={{ color: '#fbbf24', marginRight: '8px' }} />
                      <span style={{
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: dragOverFolder === folderPath ? 'white' : 'var(--text-primary)'
                      }}>
                        {folderPath === 'root' ? '루트 폴더' : folderPath} ({files.length})
                      </span>
                    </div>

                    {/* 폴더 내용 */}
                    {expandedFolders.has(folderPath) && (
                      <div>
                        {files.map((item) => (
                          <div
                            key={`${item.type}-${item.id}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '8px 16px 8px 48px',
                              borderBottom: '1px solid var(--border-color)',
                              cursor: 'pointer',
                              transition: 'var(--transition)'
                            }}
                            onClick={() => {
                              if (item.type === 'document') onDocumentSelect?.(item.id);
                              else if (item.type === 'image') handleImageView(item);
                              else if (item.type === 'pdf') handlePdfView(item);
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            onContextMenu={(e) => openContextForItem(e, item)}
                            draggable
                            onDragStart={(e) => handleDragStart(e, item)}
                          >
                            {/* 파일 아이콘 */}
                            <div style={{ marginRight: '12px' }}>
                              {item.type === 'document' && <FileText size={16} style={{ color: 'var(--primary-color)' }} />}
                              {item.type === 'image' && <Image size={16} style={{ color: '#10b981' }} />}
                              {item.type === 'pdf' && <FileEarmarkPdf size={16} style={{ color: '#ef4444' }} />}
                            </div>

                            {/* 파일 정보 */}
                            <div style={{ flex: 1 }}>
                              <div style={{
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: 'var(--text-primary)',
                                marginBottom: '2px'
                              }}>
                                {item.type === 'document' ? item.title : item.name}
                              </div>
                              <div style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-secondary)'
                              }}>
                                {item.type === 'document' ? formatFileSize(item.content) : `${(item.size / 1024).toFixed(1)} KB`} •
                                {new Date(item.type === 'document' ? item.updatedAt : item.createdAt).toLocaleString('ko-KR', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>

                            {/* 액션 버튼들 */}
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (item.type === 'document') handleRenameStart(item);
                                  else if (item.type === 'image') handleRenameImageStart(item);
                                  else if (item.type === 'pdf') handleRenamePdfStart(item);
                                }}
                                style={{
                                  padding: '4px',
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-secondary)',
                                  cursor: 'pointer',
                                  borderRadius: '4px'
                                }}
                                title="이름 변경"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (item.type === 'document') handleDelete(item.id);
                                  else if (item.type === 'image') deleteImage(item.id);
                                  else if (item.type === 'pdf') deletePdf(item.id);
                                }}
                                style={{
                                  padding: '4px',
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-secondary)',
                                  cursor: 'pointer',
                                  borderRadius: '4px'
                                }}
                                title="삭제"
                                onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                              >
                                <Trash3 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          viewMode === 'grid' ? <GridView /> : <ListView />
        )}

        {activeTab === 'images' && (
          <div>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredAndSortedImages.map((img) => (
                  <div
                    key={img.id}
                    className="image-card group"
                    style={{
                      background: 'var(--bg-primary)',
                      borderRadius: 'var(--border-radius)',
                      boxShadow: 'var(--shadow)',
                      border: '1px solid var(--border-color)',
                      overflow: 'hidden',
                      transition: 'var(--transition)',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleImageView(img)}
                    onContextMenu={(e) => openContextForItem(e, img)}
                  >
                    {/* Image Preview */}
                    <div style={{
                      height: '200px',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      background: 'var(--bg-secondary)',
                      borderBottom: '1px solid var(--border-color)',
                      overflow: 'hidden'
                    }}>
                      <img
                        src={URL.createObjectURL(new Blob([img.data], { type: img.type }))}
                        alt={img.name}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain'
                        }}
                      />
        </div>

                    {/* Image Info */}
                    <div style={{ padding: '16px' }}>
                      <h3 style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        margin: '0 0 8px 0',
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {img.name}
                      </h3>

                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '8px'
                      }}>
                        {(img.size / 1024).toFixed(1)} KB
      </div>

              <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)'
                      }}>
                        {new Date(img.createdAt).toLocaleString('ko-KR', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>

                    {/* Hover Actions */}
                    <div className="image-actions" style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                display: 'flex',
                      gap: '4px',
                      opacity: 0,
                      transition: 'opacity 0.2s ease'
                    }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRenameImageStart(img);
                        }}
                        style={{
                          padding: '6px',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="이름 변경"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleImageDelete(img.id);
                        }}
                        style={{
                          padding: '6px',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="삭제"
                        onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                      >
                        <Trash3 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                background: 'var(--bg-primary)',
                borderRadius: 'var(--border-radius)',
                border: '1px solid var(--border-color)',
                overflow: 'hidden'
              }}>
                {/* List Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 120px 80px',
                  gap: '16px',
                  padding: '12px 20px',
                  background: 'var(--bg-secondary)',
                  borderBottom: '1px solid var(--border-color)',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  <div>이름</div>
                  <div>크기</div>
                  <div>생성일</div>
                  <div>작업</div>
                </div>

                {/* List Items */}
                {filteredAndSortedImages.map((img) => (
                  <div
                    key={img.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 120px 120px 80px',
                      gap: '16px',
                      padding: '16px 20px',
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'var(--transition)',
                      alignItems: 'center'
                    }}
                    onClick={() => handleImageView(img)}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    onContextMenu={(e) => openContextForItem(e, img)}
                  >
                    {/* Name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Image size={20} style={{ color: '#10b981' }} />
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
                          이미지
                        </div>
                      </div>
                    </div>

                    {/* Size */}
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)'
                    }}>
                      {(img.size / 1024).toFixed(1)} KB
                    </div>

                    {/* Date */}
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)'
                    }}>
                      {new Date(img.createdAt).toLocaleString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRenameImageStart(img);
                        }}
                        style={{
                          padding: '4px',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          borderRadius: '4px'
                        }}
                        title="이름 변경"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleImageDelete(img.id);
                        }}
                        style={{
                          padding: '4px',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          borderRadius: '4px'
                        }}
                        title="삭제"
                        onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                      >
                        <Trash3 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'pdfs' && (
          <div>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredAndSortedPdfs.map((pdf) => (
                  <div
                    key={pdf.id}
                    className="pdf-card group"
                    style={{
                      background: 'var(--bg-primary)',
                      borderRadius: 'var(--border-radius)',
                      boxShadow: 'var(--shadow)',
                      border: '1px solid var(--border-color)',
                      overflow: 'hidden',
                      transition: 'var(--transition)',
                      cursor: 'pointer'
                    }}
                    onClick={() => handlePdfView(pdf)}
                    onContextMenu={(e) => openContextForItem(e, pdf)}
                  >
                    {/* PDF Icon */}
                    <div style={{
                      padding: '24px',
                      display: 'flex',
                justifyContent: 'center',
                      alignItems: 'center',
                      background: 'var(--bg-secondary)',
                      borderBottom: '1px solid var(--border-color)'
                    }}>
                      <FileEarmarkPdf size={48} style={{ color: '#ef4444' }} />
                    </div>

                    {/* PDF Info */}
                    <div style={{ padding: '16px' }}>
                <h3 style={{
                        fontSize: '0.875rem',
                  fontWeight: '600',
                        margin: '0 0 8px 0',
                  color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                }}>
                        {pdf.name}
                </h3>

                      <div style={{
                        fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                        marginBottom: '8px'
                      }}>
                        {(pdf.size / 1024).toFixed(1)} KB
                      </div>

                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)'
                      }}>
                        {new Date(pdf.createdAt).toLocaleString('ko-KR', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>

                    {/* Hover Actions */}
                    <div className="pdf-actions" style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      display: 'flex',
                      gap: '4px',
                      opacity: 0,
                      transition: 'opacity 0.2s ease'
                    }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRenamePdfStart(pdf);
                        }}
                        style={{
                          padding: '6px',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="이름 변경"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePdfDelete(pdf.id);
                        }}
                        style={{
                          padding: '6px',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="삭제"
                        onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                      >
                        <Trash3 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                background: 'var(--bg-primary)',
                borderRadius: 'var(--border-radius)',
                border: '1px solid var(--border-color)',
                overflow: 'hidden'
              }}>
                {/* List Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 120px 80px',
                  gap: '16px',
                  padding: '12px 20px',
                  background: 'var(--bg-secondary)',
                  borderBottom: '1px solid var(--border-color)',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  <div>이름</div>
                  <div>크기</div>
                  <div>생성일</div>
                  <div>작업</div>
                </div>

                {/* List Items */}
                {filteredAndSortedPdfs.map((pdf) => (
                  <div
                    key={pdf.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 120px 120px 80px',
                      gap: '16px',
                      padding: '16px 20px',
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'var(--transition)',
                      alignItems: 'center'
                    }}
                    onClick={() => handlePdfView(pdf)}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    onContextMenu={(e) => openContextForItem(e, pdf)}
                  >
                    {/* Name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <FileEarmarkPdf size={20} style={{ color: '#ef4444' }} />
              <div>
                        <div style={{
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          color: 'var(--text-primary)',
                          marginBottom: '2px'
                        }}>
                          {pdf.name}
                </div>
                        <div style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)'
                        }}>
                          PDF
                        </div>
                      </div>
                    </div>

                    {/* Size */}
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)'
                    }}>
                      {(pdf.size / 1024).toFixed(1)} KB
                    </div>

                    {/* Date */}
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)'
                    }}>
                      {new Date(pdf.createdAt).toLocaleString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRenamePdfStart(pdf);
                        }}
                        style={{
                          padding: '4px',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          borderRadius: '4px'
                        }}
                        title="이름 변경"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePdfDelete(pdf.id);
                        }}
                        style={{
                          padding: '4px',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          borderRadius: '4px'
                        }}
                        title="삭제"
                        onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                      >
                        <Trash3 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image Viewer */}
      <ImageViewer
        image={selectedImage}
        onClose={closeImageViewer}
      />

      {/* PDF Viewer Modal */}
      {selectedPdf && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            position: 'relative',
            maxWidth: '80vw',
            maxHeight: '80vh',
            background: 'var(--bg-primary)',
            borderRadius: 'var(--border-radius)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* PDF Viewer Header */}
            <div style={{
              padding: '16px',
              background: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: 'var(--text-primary)',
                margin: 0
              }}>
                {selectedPdf.name}
              </h3>
              <button
                onClick={() => setSelectedPdf(null)}
                style={{
                  padding: '8px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
                title="닫기"
              >
                <X size={20} />
              </button>
            </div>

            {/* PDF Viewer Content */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              <PDFViewer
                pdfData={selectedPdf.data}
                fileName={selectedPdf.name}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <RenameModal
        isOpen={!!renamingDocument || !!renamingImage || !!renamingPdf}
        title={renamingDocument ? '문서 이름 변경' : renamingImage ? '이미지 이름 변경' : renamingPdf ? 'PDF 이름 변경' : '이름 변경'}
        label={'새 이름'}
        placeholder={'새 이름을 입력하세요'}
        value={newTitle}
        onChange={setNewTitle}
        onCancel={() => {
          if (renamingDocument) setRenamingDocument(null);
          if (renamingImage) setRenamingImage(null);
          if (renamingPdf) setRenamingPdf(null);
          setNewTitle('');
        }}
        onConfirm={() => {
          if (renamingDocument) return handleRenameConfirm();
          if (renamingImage) return handleRenameImageConfirm();
          if (renamingPdf) return handleRenamePdfConfirm();
        }}
        confirmText={'확인'}
        cancelText={'취소'}
      />

      <ConfirmModal
        isOpen={confirmState.open}
        title={'삭제 확인'}
        message={'정말로 이 항목을 삭제하시겠습니까? 되돌릴 수 없습니다.'}
        confirmText={'삭제'}
        cancelText={'취소'}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmState({ open: false })}
      />

      <RenameModal
        title="새 폴더 만들기"
        label="폴더 이름"
        placeholder="폴더 이름을 입력하세요"
        value={newFolderName}
        confirmText="만들기"
        cancelText="취소"
        isOpen={showNewFolderModal}
        onChange={setNewFolderName}
        onConfirm={handleCreateNewFolder}
        onCancel={() => {
          setShowNewFolderModal(false);
          setNewFolderName('');
        }}
      />

      {contextMenu.open && (
        <div
          onClick={closeContextMenu}
          onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
          style={{ position: 'fixed', inset: 0, zIndex: 9999 }}
        >
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={getContextMenuItems(contextMenu.target)}
            onClose={closeContextMenu}
          />
        </div>
      )}

    </div>
  );

};

export default WorkspacePage;
