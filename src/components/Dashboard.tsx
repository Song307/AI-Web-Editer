import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Image as ImageIcon, FileEarmarkPdf, Film, Plus, Search, Folder as FolderIcon, ChevronRight, House, ThreeDotsVertical, Pencil, Trash, Copy, Download } from 'react-bootstrap-icons';
import { getAllDocuments, Document, saveDocument, saveImage, ImageFile, savePdf, PDFFile, getAllImages, getAllPdfs, getDocument, updateDocument, updateImage, updatePdf, Folder, getAllFolders, saveFolder, updateFolder, deleteDocument, deleteImage, deletePdf, deleteFolder } from '../utils/db';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, setDoc, query } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import toast from 'react-hot-toast';
import JSZip from 'jszip';

interface DashboardProps {
  isDarkMode: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ isDarkMode }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [pdfs, setPdfs] = useState<PDFFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [modalSelectedFolderId, setModalSelectedFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverBreadcrumbId, setDragOverBreadcrumbId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncMeta, setSyncMeta] = useState<{
    lastSync?: Date | null;
    uploaded?: number;
    uploadFailed?: number;
    downloaded?: number;
    downloadSkipped?: number;
    folderUploaded?: number;
    folderUploadFailed?: number;
    folderDownloaded?: number;
    folderDownloadFailed?: number;
    userId?: string;
  } | null>(null);
  const [showManageMenu, setShowManageMenu] = useState<string | null>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameItem, setRenameItem] = useState<{ id: string; type: 'document' | 'folder' | 'image' | 'pdf'; currentName: string } | null>(null);
  const [newName, setNewName] = useState('');
  const navigate = useNavigate();
  const prevUserRef = React.useRef<User | null>(null);

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

    // Load last sync metadata from localStorage so it persists across refreshes
    try {
      const raw = localStorage.getItem('syncMeta');
      if (raw) {
        const parsed = JSON.parse(raw);
        const last = parsed.lastSync ? new Date(parsed.lastSync) : null;
        setLastSyncAt(last);
        setSyncMeta({
          lastSync: last,
          uploaded: parsed.uploaded || 0,
          uploadFailed: parsed.uploadFailed || 0,
          downloaded: parsed.downloaded || 0,
          downloadSkipped: parsed.downloadSkipped || 0,
          userId: parsed.userId,
        });
      }
    } catch (err) {
      // ignore localStorage parsing errors
    }

    // Firebase auth state listener
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showManageMenu) {
        const target = event.target as Element;
        if (!target.closest('.manage-menu') && !target.closest('.manage-button')) {
          setShowManageMenu(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showManageMenu]);

  // Auto-sync when a user logs in (transition from null -> user)
  useEffect(() => {
    if (!prevUserRef.current && user) {
      // newly logged in
      console.log('[Dashboard] 사용자 로그인 감지 - 자동 동기화 조건 확인');

      const THRESHOLD_MS = 1000 * 60 * 60; // 1 hour
      const metaRaw = localStorage.getItem('syncMeta');
      let shouldAutoSync = false;
      try {
        if (!metaRaw) {
          shouldAutoSync = true;
        } else {
          const parsed = JSON.parse(metaRaw);
          const last = parsed.lastSync ? new Date(parsed.lastSync) : null;
          // If meta is for different user -> auto sync
          if (!parsed.userId || parsed.userId !== user.uid) {
            shouldAutoSync = true;
          } else if (!last) {
            shouldAutoSync = true;
          } else if ((Date.now() - last.getTime()) >= THRESHOLD_MS) {
            shouldAutoSync = true;
          }
        }
      } catch (err) {
        shouldAutoSync = true;
      }

      if (shouldAutoSync) {
        console.log('[Dashboard] 자동 동기화 조건 만족 - 자동 동기화 실행');
        handleSync().catch(err => console.error('자동 동기화 실패:', err));
      } else {
        console.log('[Dashboard] 자동 동기화 조건 불만족 - 자동 동기화 생략');
      }
    }
    prevUserRef.current = user;
  }, [user]);

  const loadDocuments = async () => {
    const docs = await getAllDocuments();
    const flds = await getAllFolders();
    const imgs = await getAllImages();
    const pdfFiles = await getAllPdfs();
    
    const sortedDocs = docs.sort((a, b) => {
      const dateA = new Date(a.updatedAt).getTime();
      const dateB = new Date(b.updatedAt).getTime();
      return dateB - dateA;
    });
    
    setDocuments(sortedDocs);
    setFolders(flds.sort((a,b) => (new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())));
    setImages(imgs);
    setPdfs(pdfFiles);
  };

  const handleCreateFolder = async () => {
    const name = prompt('새 폴더 이름을 입력하세요');
    if (!name) return;
    const folder: Folder = {
      id: Date.now().toString(),
      name,
      parentId: activeFolderId || undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    try {
      await saveFolder(folder);
      toast.success('폴더 생성 완료');
      await loadDocuments();
    } catch (err) {
      console.error('폴더 생성 실패', err);
      toast.error('폴더 생성에 실패했습니다.');
    }
  };
  // Helper: Build folder chain from root -> given folderId
  const getFolderChain = (folderId: string | null): Folder[] => {
    if (!folderId) return [];
    const map = new Map(folders.map(f => [f.id, f]));
    const chain: Folder[] = [];
    let cur: string | null = folderId;
    while (cur) {
      const f = map.get(cur);
      if (!f) break;
      chain.push(f);
      cur = f.parentId || null;
    }
    return chain.reverse();
  };

  // Helper: detect if moving draggedId into targetId would create a cycle
  const isMoveIntoDescendant = (draggedId: string, targetId: string) => {
    let cur: string | null = targetId;
    const map = new Map(folders.map(f => [f.id, f]));
    while (cur) {
      if (cur === draggedId) return true;
      const f = map.get(cur);
      if (!f) break;
      cur = f.parentId || null;
    }
    return false;
  };

  const getFileIcon = (fileType: string) => {
    if (fileType === 'document') return <FileText size={36} className="text-blue-500" />;
    if (fileType === 'image') return <ImageIcon size={36} className="text-green-500" />;
    if (fileType === 'pdf') return <FileEarmarkPdf size={36} className="text-red-500" />;
    return <FileText size={36} className="text-gray-500" />;
  };

  const handleFileClick = (file: any) => {
    if (file.fileType === 'document') {
      navigate(`/workspace/${file.id}`);
    } else if (file.fileType === 'image') {
      navigate('/workspace', { state: { imageId: file.id } });
    } else if (file.fileType === 'pdf') {
      navigate('/workspace', { state: { pdfId: file.id } });
    }
  };

  const handleCreateFolderFromModal = async () => {
    if (!newFolderName) {
      toast.error('폴더 이름을 입력하세요');
      return;
    }
    const folder: Folder = {
      id: Date.now().toString(),
      name: newFolderName,
      parentId: modalSelectedFolderId || activeFolderId || undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    try {
      await saveFolder(folder);
      toast.success('폴더 생성 완료');
      setNewFolderName('');
      setModalSelectedFolderId(folder.id);
      await loadDocuments();
      // Close the "새 파일" modal after creating folder
      setShowNewFileModal(false);
    } catch (err) {
      console.error('모달 폴더 생성 실패', err);
      toast.error('폴더 생성 실패');
    }
  };

  const handleCreateDocumentFromModal = async () => {
    const docId = Date.now().toString();
    const newDoc: Document = {
      id: docId,
      title: '새 문서',
      content: '',
      contentType: 'markdown',
      folderId: modalSelectedFolderId || activeFolderId || undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    try {
      await saveDocument(newDoc);
      await loadDocuments();
      setShowNewFileModal(false);
      navigate(`/workspace/${docId}`);
    } catch (err) {
      console.error('모달에서 문서 생성 실패', err);
      toast.error('문서 생성 실패');
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
        folderId: activeFolderId || undefined,
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
      navigate('/workspace', { state: { createFileType: fileType, parentFolderId: activeFolderId } });
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
            folderId: modalSelectedFolderId || activeFolderId || undefined,
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
            folderId: modalSelectedFolderId || activeFolderId || undefined,
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

  // 관리 기능 함수들
  const handleRename = (id: string, type: 'document' | 'folder' | 'image' | 'pdf', currentName: string) => {
    setRenameItem({ id, type, currentName });
    setNewName(currentName);
    setShowRenameModal(true);
    setShowManageMenu(null);
  };

  const handleDelete = async (id: string, type: 'document' | 'folder' | 'image' | 'pdf', name: string) => {
    if (!window.confirm(`${name}을(를) 정말 삭제하시겠습니까?`)) return;

    try {
      if (type === 'document') {
        await deleteDocument(id);
      } else if (type === 'folder') {
        await deleteFolder(id);
      } else if (type === 'image') {
        await deleteImage(id);
      } else if (type === 'pdf') {
        await deletePdf(id);
      }
      await loadDocuments();
      toast.success(`${name}이(가) 삭제되었습니다.`);
    } catch (error) {
      console.error('삭제 실패:', error);
      toast.error('삭제에 실패했습니다.');
    }
    setShowManageMenu(null);
  };

  const handleCopy = async (id: string, type: 'document' | 'folder' | 'image' | 'pdf', name: string) => {
    try {
      if (type === 'document') {
        const doc = await getDocument(id);
        if (doc) {
          const newDoc: Document = {
            ...doc,
            id: Date.now().toString(),
            title: `${name} 복사본`,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          await saveDocument(newDoc);
        }
      } else if (type === 'folder') {
        // 폴더 복사는 간단하게 새 폴더 생성
        const newFolder: Folder = {
          id: Date.now().toString(),
          name: `${name} 복사본`,
          parentId: activeFolderId || undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await saveFolder(newFolder);
      }
      await loadDocuments();
      toast.success(`${name}이(가) 복사되었습니다.`);
    } catch (error) {
      console.error('복사 실패:', error);
      toast.error('복사에 실패했습니다.');
    }
    setShowManageMenu(null);
  };

  const handleDownload = async (id: string, type: 'document' | 'folder' | 'image' | 'pdf', name: string) => {
    try {
      if (type === 'document') {
        const doc = await getDocument(id);
        if (doc) {
          const blob = new Blob([doc.content], { type: 'text/markdown' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${name}.md`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } else if (type === 'folder') {
        // 폴더 다운로드: 폴더 내 모든 파일을 zip으로 압축
        const zip = new JSZip();
        const folder = zip.folder(name);

        if (folder) {
          // 폴더 내 문서들 추가
          const folderDocs = documents.filter(doc => doc.folderId === id);
          for (const doc of folderDocs) {
            folder.file(`${doc.title}.md`, doc.content);
          }

          // 폴더 내 이미지들 추가
          const folderImages = images.filter(img => img.folderId === id);
          for (const img of folderImages) {
            const blob = new Blob([img.data], { type: img.type });
            folder.file(img.name, blob);
          }

          // 폴더 내 PDF들 추가
          const folderPdfs = pdfs.filter(pdf => pdf.folderId === id);
          for (const pdf of folderPdfs) {
            const blob = new Blob([pdf.data], { type: pdf.type });
            folder.file(pdf.name, blob);
          }

          // zip 생성 및 다운로드
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          const url = URL.createObjectURL(zipBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${name}.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } else if (type === 'image') {
        const img = images.find(i => i.id === id);
        if (img) {
          const blob = new Blob([img.data], { type: img.type });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = img.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } else if (type === 'pdf') {
        const pdf = pdfs.find(p => p.id === id);
        if (pdf) {
          const blob = new Blob([pdf.data], { type: pdf.type });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = pdf.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }
      toast.success(`${name}이(가) 다운로드되었습니다.`);
    } catch (error) {
      console.error('다운로드 실패:', error);
      toast.error('다운로드에 실패했습니다.');
    }
    setShowManageMenu(null);
  };

  const handleRenameSubmit = async () => {
    if (!renameItem || !newName.trim()) return;

    try {
      if (renameItem.type === 'document') {
        await updateDocument(renameItem.id, { title: newName.trim() });
      } else if (renameItem.type === 'folder') {
        await updateFolder(renameItem.id, { name: newName.trim() });
      } else if (renameItem.type === 'image') {
        await updateImage(renameItem.id, { name: newName.trim() });
      } else if (renameItem.type === 'pdf') {
        await updatePdf(renameItem.id, { name: newName.trim() });
      }
      await loadDocuments();
      toast.success('이름이 변경되었습니다.');
    } catch (error) {
      console.error('이름 변경 실패:', error);
      toast.error('이름 변경에 실패했습니다.');
    }
    setShowRenameModal(false);
    setRenameItem(null);
    setNewName('');
  };

  const handleSync = async () => {
    console.log('🔄 동기화 시작됨');
    console.log('👤 현재 사용자:', user);
    console.log('🗄️ Firestore DB:', db);

    if (!user) {
      console.log('❌ 로그인 필요');
      alert('로그인이 필요합니다.');
      return;
    }

    setIsSyncing(true);
    try {
      console.log('📤 Firestore에 문서 업로드 시작...');
      console.log('📊 업로드할 문서 수:', documents.length);

      // Upload all documents to Firestore with timeout and error handling
      let uploadSuccessCount = 0;
      let uploadFailCount = 0;

      for (let i = 0; i < documents.length; i++) {
        const document = documents[i];
        console.log(`📄 [${i + 1}/${documents.length}] 업로드 중:`, document.title);

        try {
          // Create a timeout promise
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('요청 시간이 초과되었습니다. 네트워크 연결을 확인해주세요.')), 10000); // 10초 타임아웃
          });

          // Race between setDoc and timeout
          await Promise.race([
            setDoc(doc(db, 'users', user.uid, 'documents', document.id), {
              ...document,
              // Firestore에 맞게 Date 객체를 그대로 사용 (Firestore가 지원함)
            }),
            timeoutPromise
          ]);

          uploadSuccessCount++;
          // update progress (upload phase = 0-50%)
          // upload progress tracked internally (no UI progress bar)
          console.log(`✅ [${i + 1}/${documents.length}] 업로드 성공:`, document.title);
        } catch (docError) {
          uploadFailCount++;
          const errorMessage = docError instanceof Error ? docError.message : '알 수 없는 오류';
          console.error(`❌ [${i + 1}/${documents.length}] 업로드 실패:`, document.title, errorMessage);

          // Firestore API 미활성화 에러 감지
          if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('SERVICE_DISABLED')) {
            console.warn('🚨 Firestore API가 활성화되지 않았습니다. Google Cloud Console에서 활성화해주세요.');
            console.warn('🔗 https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=toolix-8b791');
            // API 미활성화 시 더 이상 시도하지 않음
            break;
          }
        }
      }

      console.log(`📊 업로드 결과: 성공 ${uploadSuccessCount}개, 실패 ${uploadFailCount}개`);
      // upload phase completed

      console.log('📤 Firestore에 폴더 업로드 시작...');
      console.log('📊 업로드할 폴더 수:', folders.length);

      // Upload all folders to Firestore with timeout and error handling
      let folderUploadSuccessCount = 0;
      let folderUploadFailCount = 0;

      for (let i = 0; i < folders.length; i++) {
        const folder = folders[i];
        console.log(`📁 [${i + 1}/${folders.length}] 폴더 업로드 중:`, folder.name);

        try {
          // Create a timeout promise
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('요청 시간이 초과되었습니다. 네트워크 연결을 확인해주세요.')), 10000); // 10초 타임아웃
          });

          // Race between setDoc and timeout
          await Promise.race([
            setDoc(doc(db, 'users', user.uid, 'folders', folder.id), {
              ...folder,
              // Firestore에 맞게 Date 객체를 그대로 사용 (Firestore가 지원함)
            }),
            timeoutPromise
          ]);

          folderUploadSuccessCount++;
          console.log(`✅ [${i + 1}/${folders.length}] 폴더 업로드 성공:`, folder.name);
        } catch (folderError) {
          folderUploadFailCount++;
          const errorMessage = folderError instanceof Error ? folderError.message : '알 수 없는 오류';
          console.error(`❌ [${i + 1}/${folders.length}] 폴더 업로드 실패:`, folder.name, errorMessage);

          // Firestore API 미활성화 에러 감지
          if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('SERVICE_DISABLED')) {
            console.warn('🚨 Firestore API가 활성화되지 않았습니다. Google Cloud Console에서 활성화해주세요.');
            console.warn('🔗 https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=toolix-8b791');
            // API 미활성화 시 더 이상 시도하지 않음
            break;
          }
        }
      }

      console.log(`📊 폴더 업로드 결과: 성공 ${folderUploadSuccessCount}개, 실패 ${folderUploadFailCount}개`);

      console.log(' Firestore에서 문서 다운로드 시작...');
      // Download documents from Firestore with timeout
      const downloadTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('다운로드 요청 시간이 초과되었습니다. 네트워크 연결을 확인해주세요.')), 15000); // 15초 타임아웃
      });

      let querySnapshot;
      try {
        querySnapshot = await Promise.race([
          getDocs(collection(db, 'users', user.uid, 'documents')),
          downloadTimeoutPromise
        ]) as any;
      } catch (downloadError) {
        const errorMessage = downloadError instanceof Error ? downloadError.message : '알 수 없는 오류';
        console.error('❌ 다운로드 실패:', errorMessage);

        if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('SERVICE_DISABLED')) {
          throw new Error('Firestore API가 활성화되지 않았습니다. Google Cloud Console에서 Firestore API를 활성화해주세요.\n🔗 https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=toolix-8b791');
        }
        throw downloadError;
      }

      console.log('📋 Firestore에서 찾은 문서 수:', querySnapshot.docs.length);

      let downloadSuccessCount = 0;
      let downloadSkipCount = 0;

      for (let i = 0; i < querySnapshot.docs.length; i++) {
        const docSnap = querySnapshot.docs[i];
        const data = docSnap.data() as Document;
        console.log(`📄 [${i + 1}/${querySnapshot.docs.length}] 다운로드 중:`, data.title);

        try {
          // Check if document exists in local DB
          const existing = await getDocument(data.id);
          if (!existing) {
            await saveDocument(data);
            downloadSuccessCount++;
            console.log(`💾 [${i + 1}/${querySnapshot.docs.length}] 로컬 DB에 저장됨:`, data.title);
          } else {
            // Compare updatedAt timestamps to determine which version is newer
            let remoteUpdatedAt: Date;
            try {
              remoteUpdatedAt = (data.updatedAt as any)?.toDate ? (data.updatedAt as any).toDate() : new Date(data.updatedAt);
            } catch {
              remoteUpdatedAt = new Date(data.updatedAt);
            }
            const localUpdatedAt = existing.updatedAt;
            
            if (remoteUpdatedAt > localUpdatedAt) {
              // Remote version is newer, update local
              await saveDocument(data);
              downloadSuccessCount++;
              console.log(`🔄 [${i + 1}/${querySnapshot.docs.length}] 최신 버전으로 업데이트됨:`, data.title);
            } else {
              // Local version is same or newer, skip
              downloadSkipCount++;
              console.log(`⏭️ [${i + 1}/${querySnapshot.docs.length}] 로컬 버전이 최신이거나 같음, 건너뜀:`, data.title);
            }
          }
        } catch (saveError) {
          console.error(`❌ [${i + 1}/${querySnapshot.docs.length}] 로컬 저장 실패:`, data.title, saveError);
        }
      }

      console.log(`📊 다운로드 결과: 새로 저장 ${downloadSuccessCount}개, 건너뜀 ${downloadSkipCount}개`);

      console.log('📥 Firestore에서 폴더 다운로드 시작...');

      // Download all folders from Firestore with timeout and error handling
      let folderDownloadSuccessCount = 0;
      let folderDownloadFailCount = 0;

      try {
        // Create a timeout promise for the entire folder download operation
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('요청 시간이 초과되었습니다. 네트워크 연결을 확인해주세요.')), 15000); // 15초 타임아웃
        });

        // Get all folders from Firestore
        const foldersQuery = query(collection(db, 'users', user.uid, 'folders'));
        const foldersSnapshot = await Promise.race([
          getDocs(foldersQuery),
          timeoutPromise
        ]) as any;

        console.log('📊 다운로드할 폴더 수:', foldersSnapshot.docs.length);

        for (let i = 0; i < foldersSnapshot.docs.length; i++) {
          const folderDoc = foldersSnapshot.docs[i];
          const folderData = folderDoc.data();
          console.log(`📁 [${i + 1}/${foldersSnapshot.docs.length}] 폴더 다운로드 중:`, folderData.name);

          try {
            // Save folder to local IndexedDB
            await saveFolder({
              id: folderDoc.id,
              name: folderData.name,
              parentId: folderData.parentId || null,
              createdAt: folderData.createdAt?.toDate() || new Date(),
              updatedAt: folderData.updatedAt?.toDate() || new Date(),
            });

            folderDownloadSuccessCount++;
            console.log(`✅ [${i + 1}/${foldersSnapshot.docs.length}] 폴더 다운로드 성공:`, folderData.name);
          } catch (folderSaveError) {
            folderDownloadFailCount++;
            const errorMessage = folderSaveError instanceof Error ? folderSaveError.message : '알 수 없는 오류';
            console.error(`❌ [${i + 1}/${foldersSnapshot.docs.length}] 폴더 저장 실패:`, folderData.name, errorMessage);
          }
        }

        console.log(`📊 폴더 다운로드 결과: 성공 ${folderDownloadSuccessCount}개, 실패 ${folderDownloadFailCount}개`);
      } catch (foldersError) {
        const errorMessage = foldersError instanceof Error ? foldersError.message : '알 수 없는 오류';
        console.error('❌ 폴더 다운로드 실패:', errorMessage);

        // Firestore API 미활성화 에러 감지
        if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('SERVICE_DISABLED')) {
          console.warn('🚨 Firestore API가 활성화되지 않았습니다. Google Cloud Console에서 활성화해주세요.');
          console.warn('🔗 https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=toolix-8b791');
        }
      }

      await loadDocuments(); // Refresh
      const finishedAt = new Date();
      setLastSyncAt(finishedAt);
      // sync finished
      const metaToStore = {
        lastSync: finishedAt.toISOString(),
        uploaded: uploadSuccessCount,
        uploadFailed: uploadFailCount,
        downloaded: downloadSuccessCount,
        downloadSkipped: downloadSkipCount,
        folderUploaded: folderUploadSuccessCount,
        folderUploadFailed: folderUploadFailCount,
        folderDownloaded: folderDownloadSuccessCount,
        folderDownloadFailed: folderDownloadFailCount,
        userId: user.uid,
      };
      try {
        localStorage.setItem('syncMeta', JSON.stringify(metaToStore));
        setSyncMeta({
          lastSync: finishedAt,
          uploaded: uploadSuccessCount,
          uploadFailed: uploadFailCount,
          downloaded: downloadSuccessCount,
          downloadSkipped: downloadSkipCount,
          folderUploaded: folderUploadSuccessCount,
          folderUploadFailed: folderUploadFailCount,
          folderDownloaded: folderDownloadSuccessCount,
          folderDownloadFailed: folderDownloadFailCount,
          userId: user.uid,
        });
      } catch (err) {
        console.warn('로컬스토리지 저장 실패:', err);
      }
      console.log('✅ 동기화 완료: Firestore와 로컬 DB가 동기화되었습니다.');
      toast.success(`동기화 완료! (문서: ${uploadSuccessCount}/${documents.length} 업로드, ${downloadSuccessCount} 다운로드 | 폴더: ${folderUploadSuccessCount}/${folders.length} 업로드, ${folderDownloadSuccessCount} 다운로드)`);
    } catch (error) {
      console.error('❌ 동기화 실패:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';

      // Firestore API 미활성화 에러 처리
      if (errorMessage.includes('Firestore API가 활성화되지 않았습니다')) {
        toast.error('Firestore API가 활성화되지 않았습니다. Google Cloud Console에서 활성화 후 다시 시도해주세요.', {
          duration: 8000,
        });
        console.warn('🔗 Firestore API 활성화 링크: https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=toolix-8b791');
      } else if (errorMessage.includes('요청 시간이 초과되었습니다') || errorMessage.includes('다운로드 요청 시간이 초과되었습니다')) {
        toast.error('네트워크 연결 문제가 있습니다. 인터넷 연결을 확인해주세요.', {
          duration: 5000,
        });
      } else {
        toast.error(`동기화 실패: ${errorMessage}`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const formatLastSync = (date: Date | null) => {
    if (!date) return '동기화된 기록이 없습니다';
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return '방금';
    if (diff < 60 * 60) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 60 * 60 * 24) return `${Math.floor(diff / (60 * 60))}시간 전`;
    return date.toLocaleString('ko-KR');
  };

  // Derived lists for rendering
  const allFiles = [
    ...documents.map(d => ({ ...d, fileType: 'document' as const, title: d.title })),
    ...images.map(img => ({ ...img, fileType: 'image' as const, title: img.name })),
    ...pdfs.map(p => ({ ...p, fileType: 'pdf' as const, title: p.name })),
  ];

  const visibleFolders = folders.filter(f => (activeFolderId ? f.parentId === activeFolderId : !f.parentId));

  const visibleFiles = allFiles.filter(file => (activeFolderId ? file.folderId === activeFolderId : !file.folderId));

  const filteredFiles = searchQuery ? visibleFiles.filter(f => (f.title || '').toLowerCase().includes(searchQuery.toLowerCase())) : visibleFiles;


  return (
    <div className="h-screen bg-white dark:bg-gray-900 overflow-hidden flex flex-col">
      {/* 헤더 */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">대시보드</h1>
        </div>
        {/* (Loader moved into sync tooltip) */}
        
        {/* 검색 바와 동기화 버튼 */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="파일 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="relative group">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              aria-label="동기화"
              className="p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60 disabled:cursor-not-allowed"
              title={isSyncing ? '동기화 중...' : '동기화'}
            >
              <svg
                className={`w-6 h-6 ${isSyncing ? 'animate-spin text-green-600' : 'text-green-600'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* Tooltip (rich) - appears on hover */}
            <div className={`pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute right-0 mt-2 w-64 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'} rounded-lg shadow-lg p-3 z-50 text-sm`}>
              <div className="flex items-center justify-between mb-2">
                <strong className="text-base">클라우드 및 백업 상태</strong>
              </div>

              <div className={`p-3 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <div className="flex items-center gap-3">
                  {isSyncing ? (
                    <svg className="w-5 h-5 animate-spin text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9"/></svg>
                  ) : (
                    <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                  )}
                  <div>
                    <div className="font-medium">클라우드 동기화</div>
                    <div className={`text-xs ${isDarkMode ? 'text-gray-200' : 'text-gray-600'}`}>{isSyncing ? '동기화 중...' : formatLastSync(lastSyncAt)}</div>
                  </div>
                </div>


                {/* 통계: 업로드/다운로드 성공/실패 카운트 */}
                <div className="mt-2 text-sm">
                  <div className={`text-xs ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>업로드: {syncMeta?.uploaded ?? '-' } 성공 / {syncMeta?.uploadFailed ?? '-'} 실패</div>
                  <div className={`text-xs ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>다운로드: {syncMeta?.downloaded ?? '-'} 새로 저장 / {syncMeta?.downloadSkipped ?? '-'} 건너뜀</div>
                </div>
              </div>

              <div className={`mt-3 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                <div>최종 동기화: {lastSyncAt ? lastSyncAt.toLocaleString('ko-KR') : '동기화 기록 없음'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 파일 그리드 */}
      <div className="px-6 pb-4">
        <nav className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2 mt-4">
            <button
              onClick={() => setActiveFolderId(null)}
              onDragOver={(e) => { e.preventDefault(); setDragOverBreadcrumbId('root'); }}
              onDragLeave={() => setDragOverBreadcrumbId(null)}
              onDrop={async (e) => {
                e.preventDefault();
                setDragOverBreadcrumbId(null);
                try {
                  const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
                  const payload = JSON.parse(raw);
                  const { id, fileType } = payload as { id: string; fileType: string };
                  if (fileType === 'document') {
                    await updateDocument(id, { folderId: undefined });
                    toast.success('문서를 상위(루트)로 이동했습니다.');
                    await loadDocuments();
                  } else if (fileType === 'image') {
                    await updateImage(id, { folderId: undefined } as any);
                    toast.success('이미지를 상위(루트)로 이동했습니다.');
                    await loadDocuments();
                  } else if (fileType === 'pdf') {
                    await updatePdf(id, { folderId: undefined } as any);
                    toast.success('PDF를 상위(루트)로 이동했습니다.');
                    await loadDocuments();
                  } else if (fileType === 'folder') {
                    // Move folder to root
                    await updateFolder(id, { parentId: undefined });
                    toast.success('폴더를 상위(루트)로 이동했습니다.');
                    await loadDocuments();
                  }
                } catch (err) {
                  console.error('상위(루트)로 이동 실패', err);
                  toast.error('폴더 이동 중 오류가 발생했습니다.');
                }
              }}
              className={`flex items-center gap-1 ${!activeFolderId ? 'font-semibold' : 'hover:underline'} ${dragOverBreadcrumbId === 'root' ? 'bg-blue-50 rounded px-1' : ''}`}
            >
              <House className="w-4 h-4" />
              <span>root</span>
            </button>
            {activeFolderId && (() => {
              const chain = getFolderChain(activeFolderId);
              return (
                <>
                  {chain.map((f, idx) => (
                    <React.Fragment key={`crumb-${f.id}`}>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                      {idx < chain.length - 1 ? (
                        <button
                          onClick={() => setActiveFolderId(f.id)}
                          onDragOver={(e) => { e.preventDefault(); setDragOverBreadcrumbId(f.id); }}
                          onDragLeave={() => setDragOverBreadcrumbId(null)}
                          onDrop={async (e) => {
                            e.preventDefault();
                            setDragOverBreadcrumbId(null);
                            try {
                              const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
                              const payload = JSON.parse(raw);
                              const { id, fileType } = payload as { id: string; fileType: string };
                              if (fileType === 'document') {
                                await updateDocument(id, { folderId: f.id });
                                toast.success('문서를 선택한 상위 폴더로 이동했습니다.');
                                await loadDocuments();
                              } else if (fileType === 'image') {
                                await updateImage(id, { folderId: f.id } as any);
                                toast.success('이미지를 선택한 상위 폴더로 이동했습니다.');
                                await loadDocuments();
                              } else if (fileType === 'pdf') {
                                await updatePdf(id, { folderId: f.id } as any);
                                toast.success('PDF를 선택한 상위 폴더로 이동했습니다.');
                                await loadDocuments();
                              } else if (fileType === 'folder') {
                                const draggedFolderId = id;
                                const targetFolderId = f.id;
                                if (draggedFolderId === targetFolderId || isMoveIntoDescendant(draggedFolderId, targetFolderId)) {
                                  toast.error('폴더를 그 폴더의 하위로 이동할 수 없습니다.');
                                } else {
                                  await updateFolder(draggedFolderId, { parentId: targetFolderId });
                                  toast.success('폴더를 선택한 상위 폴더로 이동했습니다.');
                                  await loadDocuments();
                                }
                              }
                            } catch (err) {
                              console.error('상위 폴더로 이동 실패', err);
                              toast.error('폴더 이동 중 오류가 발생했습니다.');
                            }
                          }}
                          className={`${dragOverBreadcrumbId === f.id ? 'bg-blue-50 rounded px-1' : 'hover:underline'}`}
                        >
                          {f.name}
                        </button>
                      ) : (
                        <span
                          onDragOver={(e) => { e.preventDefault(); setDragOverBreadcrumbId(f.id); }}
                          onDragLeave={() => setDragOverBreadcrumbId(null)}
                          onDrop={async (e) => {
                            e.preventDefault();
                            setDragOverBreadcrumbId(null);
                            try {
                              const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
                              const payload = JSON.parse(raw);
                              const { id, fileType } = payload as { id: string; fileType: string };
                              if (fileType === 'document') {
                                await updateDocument(id, { folderId: f.id });
                                toast.success('문서를 선택한 상위 폴더로 이동했습니다.');
                                await loadDocuments();
                              } else if (fileType === 'image') {
                                await updateImage(id, { folderId: f.id } as any);
                                toast.success('이미지를 선택한 상위 폴더로 이동했습니다.');
                                await loadDocuments();
                              } else if (fileType === 'pdf') {
                                await updatePdf(id, { folderId: f.id } as any);
                                toast.success('PDF를 선택한 상위 폴더로 이동했습니다.');
                                await loadDocuments();
                              } else if (fileType === 'folder') {
                                const draggedFolderId = id;
                                const targetFolderId = f.id;
                                if (draggedFolderId === targetFolderId || isMoveIntoDescendant(draggedFolderId, targetFolderId)) {
                                  toast.error('폴더를 그 폴더의 하위로 이동할 수 없습니다.');
                                } else {
                                  await updateFolder(draggedFolderId, { parentId: targetFolderId });
                                  toast.success('폴더를 선택한 상위 폴더로 이동했습니다.');
                                  await loadDocuments();
                                }
                              }
                            } catch (err) {
                              console.error('상위 폴더로 이동 실패', err);
                              toast.error('폴더 이동 중 오류가 발생했습니다.');
                            }
                          }}
                          className={`${dragOverBreadcrumbId === f.id ? 'bg-blue-50 rounded px-1 font-medium' : 'font-medium'}`}
                        >{f.name}</span>
                      )}
                    </React.Fragment>
                  ))}
                </>
              );
            })()}
        </nav>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 150px))' }}>
          {/* 폴더들 */}
          {visibleFolders
            .map((folder) => (
            <div
              key={`folder-${folder.id}`}
              draggable
              onDragStart={(e) => {
                try {
                  e.dataTransfer.setData('application/json', JSON.stringify({ id: folder.id, fileType: 'folder' }));
                } catch (err) {
                  e.dataTransfer.setData('text/plain', JSON.stringify({ id: folder.id, fileType: 'folder' }));
                }
                e.dataTransfer.effectAllowed = 'move';
              }}
              onClick={() => setActiveFolderId(activeFolderId === folder.id ? null : folder.id)}
              onDragOver={(e) => { e.preventDefault(); setDragOverFolderId(folder.id); }}
              onDragLeave={() => setDragOverFolderId(null)}
              onDrop={async (e) => {
                e.preventDefault();
                setDragOverFolderId(null);
                try {
                  const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
                  const payload = JSON.parse(raw);
                  const { id, fileType } = payload as { id: string; fileType: string };
                  if (fileType === 'document') {
                    await updateDocument(id, { folderId: folder.id });
                  } else if (fileType === 'image') {
                    await updateImage(id, { folderId: folder.id } as any);
                  } else if (fileType === 'pdf') {
                    await updatePdf(id, { folderId: folder.id } as any);
                  } else if (fileType === 'folder') {
                    // Prevent moving folder into itself or its descendants
                    const draggedFolderId = id;
                    const targetFolderId = folder.id;
                    const isDescendant = (draggedId: string, targetId: string) => {
                      let cur: string | null = targetId;
                      const map = new Map(folders.map(f => [f.id, f]));
                      while (cur) {
                        if (cur === draggedId) return true;
                        const f = map.get(cur) as Folder | undefined;
                        if (!f) break;
                        cur = f.parentId || null;
                      }
                      return false;
                    };
                    if (draggedFolderId === targetFolderId || isDescendant(draggedFolderId, targetFolderId)) {
                      toast.error('폴더를 그 폴더의 하위로 이동할 수 없습니다.');
                    } else {
                      await updateFolder(draggedFolderId, { parentId: targetFolderId });
                      toast.success('폴더를 이동했습니다.');
                      await loadDocuments();
                    }
                  }
                  if (fileType !== 'folder') {
                    toast.success('파일을 폴더로 이동했습니다.');
                    await loadDocuments();
                  }
                } catch (err) {
                  console.error('폴더로 이동 실패', err);
                  toast.error('폴더로 이동하지 못했습니다.');
                }
              }}
              className={`w-[150px] h-[150px] rounded-lg p-3 flex flex-col group cursor-pointer border ${dragOverFolderId === folder.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}
            >
              <div className="flex-1 flex items-center justify-center mb-2 relative">
                <FolderIcon className="w-10 h-10 text-yellow-500" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowManageMenu(showManageMenu === `folder-${folder.id}` ? null : `folder-${folder.id}`);
                  }}
                  className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded manage-button"
                >
                  <ThreeDotsVertical className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
                {showManageMenu === `folder-${folder.id}` && (
                  <div className="absolute top-6 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[120px] manage-menu">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRename(folder.id, 'folder', folder.name);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Pencil className="w-4 h-4" />
                      이름 변경
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(folder.id, 'folder', folder.name);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600"
                    >
                      <Trash className="w-4 h-4" />
                      삭제
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(folder.id, 'folder', folder.name);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      복사
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(folder.id, 'folder', folder.name);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      다운로드
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-medium truncate">{folder.name}</h3>
                <p className="text-xs text-gray-500">{formatDate(folder.createdAt.toString())}</p>
              </div>
            </div>
          ))}

          {/* (새로 만들기 버튼은 파일 리스트 이후에 렌더됩니다) */}

          {/* 파일 카드들 */}
          {visibleFiles.map((file) => (
            <div
              key={file.id}
              draggable
              onDragStart={(e) => {
                try {
                  e.dataTransfer.setData('application/json', JSON.stringify({ id: file.id, fileType: file.fileType }));
                } catch (err) {
                  e.dataTransfer.setData('text/plain', JSON.stringify({ id: file.id, fileType: file.fileType }));
                }
                e.dataTransfer.effectAllowed = 'move';
              }}
              onClick={() => handleFileClick(file)}
              className="w-[150px] h-[150px] border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-lg transition-all cursor-pointer bg-white dark:bg-gray-800 p-3 flex flex-col group"
            >
              <div className="flex-1 flex items-center justify-center mb-2 relative">
                {getFileIcon(file.fileType)}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowManageMenu(showManageMenu === `file-${file.id}` ? null : `file-${file.id}`);
                  }}
                  className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded manage-button"
                >
                  <ThreeDotsVertical className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
                {showManageMenu === `file-${file.id}` && (
                  <div className="absolute top-6 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[120px] manage-menu">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRename(file.id, file.fileType, file.title);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Pencil className="w-4 h-4" />
                      이름 변경
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(file.id, file.fileType, file.title);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600"
                    >
                      <Trash className="w-4 h-4" />
                      삭제
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(file.id, file.fileType, file.title);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      복사
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(file.id, file.fileType, file.title);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      다운로드
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-500 dark:group-hover:text-blue-400">
                  {file.title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(typeof (file as any).createdAt === 'string' ? (file as any).createdAt : (file as any).createdAt.toString())}
                </p>
              </div>
            </div>
          ))}

          {/* 새로 만들기 통합 버튼 (마지막 아이템) */}
          <div
            onClick={() => {
              setModalSelectedFolderId(activeFolderId || null);
              setShowNewFileModal(true);
            }}
            className="w-[150px] h-[150px] border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex flex-col items-center justify-center group cursor-pointer"
          >
            <svg className="w-10 h-10 text-gray-400 group-hover:text-blue-500 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" />
            </svg>
            <span className="text-sm font-medium text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400">새로 만들기</span>
          </div>
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
              <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">새로 만들기</h2>
              <div className="space-y-4">
                {/* Folder selector */}
                <div>
                  <label className="text-sm font-medium block mb-2">위치(폴더 선택)</label>
                  <select
                    value={modalSelectedFolderId ?? ''}
                    onChange={(e) => setModalSelectedFolderId(e.target.value || null)}
                    className="w-full p-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">root</option>
                    {folders.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>

                {/* Create folder inline */}
                <div>
                  <label className="text-sm font-medium block mb-2">새 폴더 만들기</label>
                  <div className="flex gap-2">
                    <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="폴더 이름" className="flex-1 p-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                    <button onClick={handleCreateFolderFromModal} className="px-3 py-2 bg-blue-600 text-white rounded">폴더 생성</button>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={handleCreateDocumentFromModal}
                    className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left flex items-center gap-3"
                  >
                    <FileText size={24} className="text-blue-500" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">문서</div>
                      <div className="text-sm text-gray-500">선택한 폴더에 마크다운 문서 생성</div>
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
                      <div className="text-sm text-gray-500">선택한 폴더에 이미지 또는 PDF 업로드</div>
                    </div>
                  </label>
                </div>

              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setShowNewFileModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors text-gray-900 dark:text-white"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
      )}

      {/* 이름 변경 모달 */}
      {showRenameModal && renameItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">이름 변경</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-2">새 이름</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full p-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="새 이름을 입력하세요"
                  autoFocus
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleRenameSubmit}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                변경
              </button>
              <button
                onClick={() => {
                  setShowRenameModal(false);
                  setRenameItem(null);
                  setNewName('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors text-gray-900 dark:text-white"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
