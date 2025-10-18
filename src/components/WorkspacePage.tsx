import React, { useState, useEffect, useRef } from 'react';
import { Folder, FileText, Grid, List, Plus, Search, Trash3, Pencil, X, Image, Upload, FileEarmarkPdf, ChevronRight, ChevronDown, PlayCircle, ZoomOut, ZoomIn, ArrowRepeat, ArrowCounterclockwise, ArrowClockwise, ArrowLeft, ArrowRight, Download, Fullscreen } from  'react-bootstrap-icons';
import toast, { Toaster } from 'react-hot-toast';
import { getAllDocuments, deleteDocument, updateDocument, Document, getAllImages, saveImage, deleteImage, ImageFile, updateImage, PDFFile, savePdf, getAllPdfs, deletePdf, updatePdf, VideoFile, saveVideo, getAllVideos, deleteVideo, updateVideo } from '../utils/db';
import PDFViewer from './PDFViewer';
import ImageViewer from './tools/ImageViewer';
import VideoPlayer from './VideoPlayer';
import RenameModal from './RenameModal';
import ConfirmModal from './ConfirmModal';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import Modal from './UI/shared/Modal';
import ModalHeader from './UI/shared/ModalHeader';
import ModalToolbar from './UI/shared/ModalToolbar';
import './WorkspacePage.css';

interface WorkspacePageProps {
  onDocumentSelect?: (documentId: string) => void;
}

const WorkspacePage: React.FC<WorkspacePageProps> = ({ onDocumentSelect }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'documents' | 'images' | 'pdfs' | 'videos'>('all');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [documents, setDocuments] = useState<Document[]>([]);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [pdfs, setPdfs] = useState<PDFFile[]>([]);
  const [videos, setVideos] = useState<VideoFile[]>([]);
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
  const [renamingVideo, setRenamingVideo] = useState<VideoFile | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);
  const [selectedPdf, setSelectedPdf] = useState<PDFFile | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoFile | null>(null);
  const [confirmState, setConfirmState] = useState<{ open: boolean; id?: string; type?: 'document' | 'image' | 'pdf' | 'video' }>({ open: false });
  const [contextMenu, setContextMenu] = useState<{ open: boolean; x: number; y: number; target?: any }>({ open: false, x: 0, y: 0 });
  const pdfViewerRef = useRef<any>(null);
  const pdfModalRef = useRef<HTMLDivElement>(null);

  // 이미지 뷰어 닫을 때 상태 초기화
  const closeImageViewer = () => {
    setSelectedImage(null);
  };

  // 동영상 뷰어 닫을 때 상태 초기화
  const closeVideoViewer = () => {
    setSelectedVideo(null);
  };

  useEffect(() => {
    loadDocuments();
    loadImages();
    loadPdfs();
    loadVideos();
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

  const loadVideos = async () => {
    try {
      const videoFiles = await getAllVideos();
      console.log('Loaded videos:', videoFiles.length, videoFiles);
      setVideos(videoFiles);
    } catch (error) {
      console.error('Failed to load videos:', error);
      toast.error('동영상을 불러오는데 실패했습니다.');
    }
  };

  const handleDelete = async (id: string, type: 'document' | 'image' | 'pdf' | 'video' = 'document') => {
    setConfirmState({ open: true, id, type });
  };

  const confirmDelete = async () => {
    if (!confirmState.id || !confirmState.type) return setConfirmState({ open: false });
    
    try {
      switch (confirmState.type) {
        case 'document':
          await deleteDocument(confirmState.id);
          setDocuments(documents.filter(doc => doc.id !== confirmState.id));
          toast.success('문서가 삭제되었습니다.');
          break;
        case 'image':
          await deleteImage(confirmState.id);
          setImages(images.filter(img => img.id !== confirmState.id));
          toast.success('이미지가 삭제되었습니다.');
          break;
        case 'pdf':
          await deletePdf(confirmState.id);
          setPdfs(pdfs.filter(pdf => pdf.id !== confirmState.id));
          toast.success('PDF가 삭제되었습니다.');
          break;
        case 'video':
          await deleteVideo(confirmState.id);
          setVideos(videos.filter(video => video.id !== confirmState.id));
          toast.success('동영상이 삭제되었습니다.');
          break;
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
      toast.error('파일 삭제에 실패했습니다.');
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

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // 동영상 파일만 허용
      if (!file.type.startsWith('video/')) {
        toast.error(`${file.name}은(는) 동영상 파일이 아닙니다.`);
        continue;
      }

      // 파일 크기 제한 (100MB)
      if (file.size > 100 * 1024 * 1024) {
        toast.error(`${file.name}의 크기가 너무 큽니다. (최대 100MB)`);
        continue;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        console.log('Video file uploaded:', file.name, 'Size:', file.size, 'Type:', file.type);
        const videoData: VideoFile = {
          id: `video_${Date.now()}_${i}`,
          name: file.name,
          data: arrayBuffer,
          type: file.type,
          size: file.size,
          createdAt: new Date()
        };

        await saveVideo(videoData);
        setVideos(prev => [...prev, videoData]);
        toast.success(`${file.name}이(가) 업로드되었습니다.`);
      } catch (error) {
        console.error('Failed to save video:', error);
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

  const handleVideoDelete = async (id: string) => {
    if (window.confirm('정말로 이 동영상을 삭제하시겠습니까?')) {
      try {
        await deleteVideo(id);
        setVideos(videos.filter(video => video.id !== id));
        if (selectedVideo?.id === id) {
          setSelectedVideo(null);
        }
        toast.success('동영상이 삭제되었습니다.');
      } catch (error) {
        console.error('Failed to delete video:', error);
        toast.error('동영상 삭제에 실패했습니다.');
      }
    }
  };

  const handleImageView = (image: ImageFile) => {
    setSelectedImage(image);
  };

  const handlePdfView = (pdf: PDFFile) => {
    setSelectedPdf(pdf);
  };

  const handleVideoView = (video: VideoFile) => {
    console.log('Opening video viewer for:', video.name, 'Data size:', video.data.byteLength);
    setSelectedVideo(video);
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

  // 동영상 이름 변경 함수들
  const handleRenameVideoStart = (video: VideoFile) => {
    setRenamingVideo(video);
    setNewTitle(video.name);
  };

  const handleRenameVideoCancel = () => {
    setRenamingVideo(null);
    setNewTitle('');
  };

  const handleRenameVideoConfirm = async () => {
    if (!renamingVideo || !newTitle.trim()) return;

    try {
      await updateVideo(renamingVideo.id, { name: newTitle.trim() });
      setVideos(videos.map(video => 
        video.id === renamingVideo.id 
          ? { ...video, name: newTitle.trim() }
          : video
      ));
      setRenamingVideo(null);
      setNewTitle('');
      toast.success('동영상 이름이 변경되었습니다.');
    } catch (error) {
      console.error('Failed to rename video:', error);
      toast.error('동영상 이름 변경에 실패했습니다.');
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

  const filteredAndSortedVideos = videos
    .filter(video =>
      video.name.toLowerCase().includes(searchQuery.toLowerCase())
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
    ...filteredAndSortedPdfs.map(pdf => ({ ...pdf, type: 'pdf' as const })),
    ...filteredAndSortedVideos.map(video => ({ ...video, type: 'video' as const }))
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
          className="document-card group bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-200 cursor-pointer hover:shadow-lg hover:scale-105"
          onClick={() => onDocumentSelect?.(doc.id)}
        >
          {/* Document Icon */}
          <div className="p-6 flex justify-center items-center bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <FileText size={48} className="text-blue-600 dark:text-blue-400" />
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
          <div className="p-4">
            <h3 className="text-sm font-semibold mb-2 text-gray-900 dark:text-gray-100 overflow-hidden text-ellipsis whitespace-nowrap">
              {doc.title}
            </h3>

            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              {formatFileSize(doc.content)}
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400">
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
          <div className="document-actions absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRenameStart(doc);
              }}
              className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 cursor-pointer flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700"
              title="이름 변경"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(doc.id);
              }}
              className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 cursor-pointer flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400"
              title="삭제"
            >
              <Trash3 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const ListView = () => (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* List Header */}
      <div className="grid grid-cols-[1fr_120px_120px_80px] gap-4 px-5 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
        <div>이름</div>
        <div>크기</div>
        <div>수정일</div>
        <div>작업</div>
      </div>

      {/* List Items */}
      {filteredAndSortedDocuments.map((doc) => (
        <div
          key={doc.id}
          className="grid grid-cols-[1fr_120px_120px_80px] gap-4 px-5 py-4 border-b border-gray-200 dark:border-gray-600 cursor-pointer transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-700 items-center"
          onClick={() => onDocumentSelect?.(doc.id)}
        >
          {/* Name */}
          <div className="flex items-center gap-3">
            <FileText size={20} className="text-blue-600 dark:text-blue-400" />
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                {doc.title}
              </div>
            </div>
          </div>

          {/* Size */}
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {formatFileSize(doc.content)}
          </div>

          {/* Date */}
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(doc.updatedAt).toLocaleString('ko-KR', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>

          {/* Actions */}
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRenameStart(doc);
              }}
              className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded cursor-pointer"
              title="이름 변경"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(doc.id);
              }}
              className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded cursor-pointer"
              title="삭제"
            >
              <Trash3 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="p-5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 m-0">
            작업 공간
          </h1>

            {/* View Mode Toggle */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md border transition-colors flex items-center justify-center ${
                viewMode === 'grid'
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title="그리드 보기"
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md border transition-colors flex items-center justify-center ${
                viewMode === 'list'
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title="리스트 보기"
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`p-2 rounded-md border transition-colors flex items-center justify-center ${
                viewMode === 'tree'
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title="트리 보기"
            >
              <Folder size={16} />
            </button>
              {viewMode === 'tree' && (
                <button
                  onClick={() => setShowNewFolderModal(true)}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 border border-gray-300 dark:border-gray-600 rounded-md text-white cursor-pointer flex items-center gap-1 text-sm transition-colors"
                  title="새 폴더 만들기"
                >
                  <Plus size={14} />
                  새 폴더
                </button>
              )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b border-gray-200 dark:border-gray-700 pb-3">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-md cursor-pointer text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Grid size={16} />
            전체보기
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2 rounded-md cursor-pointer text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'documents'
                ? 'bg-blue-600 text-white'
                : 'bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <FileText size={16} />
            문서
          </button>
          <button
            onClick={() => setActiveTab('images')}
            className={`px-4 py-2 rounded-md cursor-pointer text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'images'
                ? 'bg-blue-600 text-white'
                : 'bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Image size={16} />
            이미지
          </button>
          <button
            onClick={() => setActiveTab('pdfs')}
            className={`px-4 py-2 rounded-md cursor-pointer text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'pdfs'
                ? 'bg-blue-600 text-white'
                : 'bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <FileEarmarkPdf size={16} />
            PDF
          </button>
          <button
            onClick={() => setActiveTab('videos')}
            className={`px-4 py-2 rounded-md cursor-pointer text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'videos'
                ? 'bg-blue-600 text-white'
                : 'bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <PlayCircle size={16} />
            동영상
          </button>
        </div>

        {/* Search and Sort Controls */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 text-sm"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'date' | 'size')}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 text-sm"
          >
            <option value="name">이름</option>
            <option value="date">날짜</option>
            <option value="size">크기</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
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
                    className="file-card group bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-200 cursor-pointer hover:shadow-lg"
                    onClick={() => {
                      if (item.type === 'document') onDocumentSelect?.(item.id);
                      else if (item.type === 'image') handleImageView(item);
                      else if (item.type === 'pdf') handlePdfView(item);
                      else if (item.type === 'video') handleVideoView(item);
                    }}
                    onContextMenu={(e) => openContextForItem(e, item)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                  >
                    {/* File Icon */}
                    <div className="p-6 flex justify-center items-center bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                      {item.type === 'document' && <FileText size={48} className="text-blue-600" />}
                      {item.type === 'image' && <Image size={48} className="text-emerald-600" />}
                      {item.type === 'pdf' && <FileEarmarkPdf size={48} className="text-red-500" />}
                      {item.type === 'video' && <PlayCircle size={48} className="text-purple-600" />}
                    </div>

                    {/* File Info */}
                    <div className="p-4">
                      <h3 className="text-sm font-semibold mb-2 text-gray-900 dark:text-gray-100 overflow-hidden text-ellipsis whitespace-nowrap">
                        {item.type === 'document' ? item.title : item.name}
                      </h3>

                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        {item.type === 'document' ? formatFileSize(item.content) : `${(item.size / 1024).toFixed(1)} KB`}
                      </div>

                      <div className="text-xs text-gray-600 dark:text-gray-400">
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
                    <div className="file-actions absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity duration-200">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.type === 'document') handleRenameStart(item);
                          else if (item.type === 'image') handleRenameImageStart(item);
                          else if (item.type === 'pdf') handleRenamePdfStart(item);
                        }}
                        className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400 cursor-pointer flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700"
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
                        className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400 cursor-pointer flex items-center justify-center hover:bg-red-50 hover:text-red-500 hover:border-red-200"
                        title="삭제"
                      >
                        <Trash3 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : viewMode === 'list' ? (
              /* 리스트 뷰 */
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* List Header */}
                <div className="grid grid-cols-[1fr_120px_120px_80px] gap-4 px-5 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  <div>이름</div>
                  <div>크기</div>
                  <div>수정일</div>
                  <div>작업</div>
                </div>

                {/* List Items */}
                {filteredAndSortedAll.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="grid grid-cols-[1fr_120px_120px_80px] gap-4 px-5 py-4 border-b border-gray-200 dark:border-gray-600 cursor-pointer transition-all duration-200 items-center hover:bg-gray-50 dark:hover:bg-gray-700"
                    onClick={() => {
                      if (item.type === 'document') onDocumentSelect?.(item.id);
                      else if (item.type === 'image') handleImageView(item);
                      else if (item.type === 'pdf') handlePdfView(item);
                    }}
                    onContextMenu={(e) => openContextForItem(e, item)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                  >
                    {/* Name */}
                    <div className="flex items-center gap-3">
                      {item.type === 'document' && <FileText size={20} className="text-blue-600" />}
                      {item.type === 'image' && <Image size={20} className="text-emerald-600" />}
                      {item.type === 'pdf' && <FileEarmarkPdf size={20} className="text-red-500" />}
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-0.5">
                          {item.type === 'document' ? item.title : item.name}
                        </div>
                      </div>
                    </div>

                    {/* Size */}
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {item.type === 'document' ? formatFileSize(item.content) : `${(item.size / 1024).toFixed(1)} KB`}
                    </div>

                    {/* Date */}
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {new Date(item.type === 'document' ? item.updatedAt : item.createdAt).toLocaleString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.type === 'document') handleRenameStart(item);
                          else if (item.type === 'image') handleRenameImageStart(item);
                          else if (item.type === 'pdf') handleRenamePdfStart(item);
                        }}
                        className="p-1 bg-transparent border-none text-gray-600 dark:text-gray-400 cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-gray-700"
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
                        className="p-1 bg-transparent border-none text-gray-600 dark:text-gray-400 cursor-pointer rounded hover:bg-red-50 hover:text-red-500"
                        title="삭제"
                      >
                        <Trash3 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* 트리 뷰 */
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                {Array.from(groupFilesByFolder(filteredAndSortedAll)).map(([folderPath, files]) => (
                  <div key={folderPath}>
                    {/* 폴더 헤더 */}
                    <div
                      onClick={() => toggleFolder(folderPath)}
                      onDragOver={(e) => handleDragOver(e, folderPath)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, folderPath)}
                      className={`flex items-center py-3 px-4 cursor-pointer transition-all duration-200 border-b border-gray-200 dark:border-gray-600 ${
                        dragOverFolder === folderPath
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      {expandedFolders.has(folderPath) ? (
                        <ChevronDown size={16} className="mr-2 text-gray-600 dark:text-gray-400" />
                      ) : (
                        <ChevronRight size={16} className="mr-2 text-gray-600 dark:text-gray-400" />
                      )}
                      <Folder size={18} className="mr-2 text-yellow-500" />
                      <span className={`text-sm font-medium ${
                        dragOverFolder === folderPath ? 'text-white' : 'text-gray-900 dark:text-gray-100'
                      }`}>
                        {folderPath === 'root' ? '루트 폴더' : folderPath} ({files.length})
                      </span>
                    </div>

                    {/* 폴더 내용 */}
                    {expandedFolders.has(folderPath) && (
                      <div>
                        {files.map((item) => (
                          <div
                            key={`${item.type}-${item.id}`}
                            className="flex items-center py-2 px-4 pl-12 border-b border-gray-200 dark:border-gray-600 cursor-pointer transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                            onClick={() => {
                              if (item.type === 'document') onDocumentSelect?.(item.id);
                              else if (item.type === 'image') handleImageView(item);
                              else if (item.type === 'pdf') handlePdfView(item);
                            }}
                            onContextMenu={(e) => openContextForItem(e, item)}
                            draggable
                            onDragStart={(e) => handleDragStart(e, item)}
                          >
                            {/* 파일 아이콘 */}
                            <div className="mr-3">
                              {item.type === 'document' && <FileText size={16} className="text-blue-600" />}
                              {item.type === 'image' && <Image size={16} className="text-emerald-600" />}
                              {item.type === 'pdf' && <FileEarmarkPdf size={16} className="text-red-500" />}
                            </div>

                            {/* 파일 정보 */}
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-0.5">
                                {item.type === 'document' ? item.title : item.name}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">
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
                                className="p-1 bg-transparent border-none text-gray-600 dark:text-gray-400 cursor-pointer rounded hover:text-blue-500 transition-colors"
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
                                className="p-1 bg-transparent border-none text-gray-600 dark:text-gray-400 cursor-pointer rounded hover:text-red-500 transition-colors"
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
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          viewMode === 'grid' || viewMode === 'tree' ? <GridView /> : <ListView />
        )}

        {activeTab === 'images' && (
          <div>
            {/* Upload Button */}
            <div className="mb-6">
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md cursor-pointer hover:bg-blue-700 transition-colors">
                <Upload size={16} />
                이미지 업로드
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>

            {(viewMode === 'grid' || viewMode === 'tree') ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredAndSortedImages.map((img) => (
                  <div
                    key={img.id}
                    className="image-card group bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-200 cursor-pointer hover:shadow-lg"
                    onClick={() => handleImageView(img)}
                    onContextMenu={(e) => openContextForItem(e, img)}
                  >
                    {/* Image Preview */}
                    <div className="h-48 flex justify-center items-center bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 overflow-hidden">
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
                    <div className="p-4">
                      <h3 className="text-sm font-semibold mb-2 text-gray-900 dark:text-gray-100 overflow-hidden text-ellipsis whitespace-nowrap">
                        {img.name}
                      </h3>

                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        {(img.size / 1024).toFixed(1)} KB
                      </div>

                      <div className="text-xs text-gray-600 dark:text-gray-400">
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
                        className="p-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400 cursor-pointer flex items-center justify-center hover:text-blue-500 transition-colors"
                        title="이름 변경"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleImageDelete(img.id);
                        }}
                        className="p-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400 cursor-pointer flex items-center justify-center hover:text-red-500 transition-colors"
                        title="삭제"
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
                    className="grid grid-cols-[1fr_120px_120px_80px] gap-4 p-4 px-5 border-b border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors items-center"
                    onClick={() => handleImageView(img)}
                    onContextMenu={(e) => openContextForItem(e, img)}
                  >
                    {/* Name */}
                    <div className="flex items-center gap-3">
                      <Image size={20} className="text-emerald-500" />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {img.name}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          이미지
                        </div>
                      </div>
                    </div>

                    {/* Size */}
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {(img.size / 1024).toFixed(1)} KB
                    </div>

                    {/* Date */}
                    <div className="text-xs text-gray-600 dark:text-gray-400">
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

        {activeTab === 'videos' && (
          <div>
            {/* Upload Button */}
            <div className="mb-6">
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md cursor-pointer hover:bg-blue-700 transition-colors">
                <Upload size={16} />
                동영상 업로드
                <input
                  type="file"
                  multiple
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="hidden"
                />
              </label>
            </div>

            {(viewMode === 'grid' || viewMode === 'tree') ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredAndSortedVideos.map((video) => (
                  <div
                    key={video.id}
                    className="video-card group bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-200 cursor-pointer hover:shadow-lg"
                    onClick={() => handleVideoView(video)}
                    onContextMenu={(e) => openContextForItem(e, video)}
                  >
                    {/* Video Preview */}
                    <div className="h-48 flex justify-center items-center bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 overflow-hidden">
                      <PlayCircle size={48} className="text-purple-600" />
                    </div>

                    {/* Video Info */}
                    <div className="p-4">
                      <h3 className="text-sm font-semibold mb-2 text-gray-900 dark:text-gray-100 overflow-hidden text-ellipsis whitespace-nowrap">
                        {video.name}
                      </h3>

                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        {(video.size / (1024 * 1024)).toFixed(1)} MB
                      </div>

                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {new Date(video.createdAt).toLocaleString('ko-KR', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>

                    {/* Hover Actions */}
                    <div className="video-actions" style={{
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
                          handleRenameVideoStart(video);
                        }}
                        className="p-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400 cursor-pointer flex items-center justify-center hover:text-blue-500 transition-colors"
                        title="이름 변경"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVideoDelete(video.id);
                        }}
                        className="p-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400 cursor-pointer flex items-center justify-center hover:text-red-500 transition-colors"
                        title="삭제"
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
                {filteredAndSortedVideos.map((video) => (
                  <div
                    key={video.id}
                    className="grid grid-cols-[1fr_120px_120px_80px] gap-4 p-4 px-5 border-b border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors items-center"
                    onClick={() => handleVideoView(video)}
                    onContextMenu={(e) => openContextForItem(e, video)}
                  >
                    {/* Name */}
                    <div className="flex items-center gap-3">
                      <PlayCircle size={20} className="text-purple-500" />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {video.name}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          동영상
                        </div>
                      </div>
                    </div>

                    {/* Size */}
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {(video.size / (1024 * 1024)).toFixed(1)} MB
                    </div>

                    {/* Date */}
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {new Date(video.createdAt).toLocaleString('ko-KR', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRenameVideoStart(video);
                        }}
                        className="p-1 text-gray-600 dark:text-gray-400 cursor-pointer flex items-center justify-center hover:text-blue-500 transition-colors"
                        title="이름 변경"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVideoDelete(video.id);
                        }}
                        className="p-1 text-gray-600 dark:text-gray-400 cursor-pointer flex items-center justify-center hover:text-red-500 transition-colors"
                        title="삭제"
                      >
                        <Trash3 size={16} />
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
            {/* Upload Button */}
            <div className="mb-6">
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md cursor-pointer hover:bg-blue-700 transition-colors">
                <Upload size={16} />
                PDF 업로드
                <input
                  type="file"
                  multiple
                  accept="application/pdf"
                  onChange={handlePdfUpload}
                  className="hidden"
                />
              </label>
            </div>

            {(viewMode === 'grid' || viewMode === 'tree') ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredAndSortedPdfs.map((pdf) => (
                  <div
                    key={pdf.id}
                    className="pdf-card group bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-200 cursor-pointer hover:shadow-lg"
                    onClick={() => handlePdfView(pdf)}
                    onContextMenu={(e) => openContextForItem(e, pdf)}
                  >
                    {/* PDF Icon */}
                    <div className="p-6 flex justify-center items-center bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                      <FileEarmarkPdf size={48} className="text-red-500" />
                    </div>

                    {/* PDF Info */}
                    <div className="p-4">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 overflow-hidden text-ellipsis whitespace-nowrap">
                        {pdf.name}
                      </h3>

                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        {(pdf.size / 1024).toFixed(1)} KB
                      </div>

                      <div className="text-xs text-gray-600 dark:text-gray-400">
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
                        className="p-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400 cursor-pointer flex items-center justify-center hover:text-blue-500 transition-colors"
                        title="이름 변경"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePdfDelete(pdf.id);
                        }}
                        className="p-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400 cursor-pointer flex items-center justify-center hover:text-red-500 transition-colors"
                        title="삭제"
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
                    className="grid grid-cols-[1fr_120px_120px_80px] gap-4 p-4 px-5 border-b border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors items-center"
                    onClick={() => handlePdfView(pdf)}
                    onContextMenu={(e) => openContextForItem(e, pdf)}
                  >
                    {/* Name */}
                    <div className="flex items-center gap-3">
                      <FileEarmarkPdf size={20} className="text-red-500" />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-0.5">
                          {pdf.name}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          PDF
                        </div>
                      </div>
                    </div>

                    {/* Size */}
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {(pdf.size / 1024).toFixed(1)} KB
                    </div>

                    {/* Date */}
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {new Date(pdf.createdAt).toLocaleString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRenamePdfStart(pdf);
                        }}
                        className="p-1 bg-transparent border-none text-gray-600 dark:text-gray-400 cursor-pointer rounded hover:text-blue-500 transition-colors"
                        title="이름 변경"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePdfDelete(pdf.id);
                        }}
                        className="p-1 bg-transparent border-none text-gray-600 dark:text-gray-400 cursor-pointer rounded hover:text-red-500 transition-colors"
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
        )}
      </div>

      {/* Image Viewer */}
      <ImageViewer
        image={selectedImage}
        onClose={closeImageViewer}
      />

      {/* Video Player Modal */}
      {selectedVideo && (
        <Modal onClose={closeVideoViewer} size="large">
          <ModalHeader fileName={selectedVideo.name} onClose={closeVideoViewer} />
          <div className="flex-1 flex items-center justify-center">
            <VideoPlayer
              video={selectedVideo}
            />
          </div>
        </Modal>
      )}

      {/* PDF Viewer Modal */}
      {selectedPdf && (
        <Modal ref={pdfModalRef} onClose={() => setSelectedPdf(null)} size="medium">
          <ModalHeader fileName={selectedPdf.name} onClose={() => setSelectedPdf(null)} />
          <ModalToolbar>
            <button onClick={() => pdfViewerRef.current?.toggleThumbnails()} className="p-1.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors" title="썸네일 사이드바">
              <List size={16} />
            </button>
            <button onClick={() => pdfViewerRef.current?.zoomOut()} className="p-1.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors" title="축소">
              <ZoomOut size={16} />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-300 min-w-[60px] text-center">{pdfViewerRef.current?.scale ? Math.round(pdfViewerRef.current.scale * 100) : 100}%</span>
            <button onClick={() => pdfViewerRef.current?.zoomIn()} className="p-1.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors" title="확대">
              <ZoomIn size={16} />
            </button>
            <button onClick={() => pdfViewerRef.current?.resetZoom()} className="p-1.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors" title="원래 크기로">
              <ArrowRepeat size={16} />
            </button>
            <button onClick={() => pdfViewerRef.current?.rotateCounterClockwise()} className="p-1.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors" title="반시계방향 회전">
              <ArrowCounterclockwise size={16} />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-300 min-w-[40px] text-center">{pdfViewerRef.current?.rotation || 0}°</span>
            <button onClick={() => pdfViewerRef.current?.rotateClockwise()} className="p-1.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors" title="시계방향 회전">
              <ArrowClockwise size={16} />
            </button>
            <button onClick={() => pdfViewerRef.current?.resetRotation()} className="p-1.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors" title="회전 초기화">
              <ArrowRepeat size={16} />
            </button>
            <button onClick={() => pdfViewerRef.current?.goToPrevPage()} disabled={pdfViewerRef.current?.pageNumber <= 1} className="p-1.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="이전 페이지">
              <ArrowLeft size={16} />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-300 min-w-[80px] text-center">
              {pdfViewerRef.current?.pageNumber || 1} / {pdfViewerRef.current?.numPages || '?'}
            </span>
            <button onClick={() => pdfViewerRef.current?.goToNextPage()} disabled={pdfViewerRef.current?.pageNumber >= (pdfViewerRef.current?.numPages || 1)} className="p-1.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="다음 페이지">
              <ArrowRight size={16} />
            </button>
            <button onClick={() => pdfViewerRef.current?.downloadPDF()} className="p-1.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors" title="다운로드">
              <Download size={16} />
            </button>
            <button onClick={async () => {
              if (pdfModalRef.current) {
                try {
                  if (pdfModalRef.current.requestFullscreen) {
                    await pdfModalRef.current.requestFullscreen();
                  } else if ((pdfModalRef.current as any).webkitRequestFullscreen) {
                    await (pdfModalRef.current as any).webkitRequestFullscreen();
                  } else if ((pdfModalRef.current as any).mozRequestFullScreen) {
                    await (pdfModalRef.current as any).mozRequestFullScreen();
                  } else if ((pdfModalRef.current as any).msRequestFullscreen) {
                    await (pdfModalRef.current as any).msRequestFullscreen();
                  }
                } catch (error) {
                  console.error('PDF 뷰어 전체화면 실패:', error);
                }
              }
            }} className="p-1.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors" title="전체화면">
              <Fullscreen size={16} />
            </button>
          </ModalToolbar>
          <div className="flex-1 overflow-auto">
            <PDFViewer
              ref={pdfViewerRef}
              pdfData={selectedPdf.data}
              fileName={selectedPdf.name}
              toolbarVisible={false}
            />
          </div>
        </Modal>
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
