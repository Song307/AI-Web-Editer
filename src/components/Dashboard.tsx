import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Image as ImageIcon, FileEarmarkPdf, Film, Plus, Search, Folder as FolderIcon, ChevronRight, House } from 'react-bootstrap-icons';
import { getAllDocuments, Document, saveDocument, saveImage, ImageFile, savePdf, PDFFile, getAllImages, getAllPdfs, getDocument, updateDocument, updateImage, updatePdf, Folder, getAllFolders, saveFolder, updateFolder } from '../utils/db';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import toast from 'react-hot-toast';

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
    userId?: string;
  } | null>(null);
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

      console.log('📥 Firestore에서 문서 다운로드 시작...');
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
            // update progress (download phase = 50-100%)
            // download progress tracked internally (no UI progress bar)
          } else {
            downloadSkipCount++;
            console.log(`⏭️ [${i + 1}/${querySnapshot.docs.length}] 이미 존재함, 건너뜀:`, data.title);
            // download progress tracked internally (no UI progress bar)
          }
        } catch (saveError) {
          console.error(`❌ [${i + 1}/${querySnapshot.docs.length}] 로컬 저장 실패:`, data.title, saveError);
        }
      }

      console.log(`📊 다운로드 결과: 새로 저장 ${downloadSuccessCount}개, 건너뜀 ${downloadSkipCount}개`);

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
          userId: user.uid,
        });
      } catch (err) {
        console.warn('로컬스토리지 저장 실패:', err);
      }
      console.log('✅ 동기화 완료: Firestore와 로컬 DB가 동기화되었습니다.');
      toast.success(`동기화 완료! (업로드: ${uploadSuccessCount}/${documents.length}, 다운로드: ${downloadSuccessCount})`);
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
        <nav className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
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
              <div className="flex-1 flex items-center justify-center mb-2">
                <FolderIcon className="w-10 h-10 text-yellow-500" />
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
              <div className="flex-1 flex items-center justify-center mb-2">
                {getFileIcon(file.fileType)}
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
    </div>
  );
};

export default Dashboard;
