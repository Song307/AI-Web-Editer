// src/utils/db.ts
export interface Document {
  id: string;
  title: string;
  content: string;
  contentType: 'html' | 'markdown'; // 저장 형식 추가
  createdAt: Date;
  updatedAt: Date;
}

export interface ImageFile {
  id: string;
  name: string;
  data: ArrayBuffer; // 이미지 바이너리 데이터
  type: string; // MIME 타입 (image/jpeg, image/png 등)
  size: number; // 파일 크기 (bytes)
  createdAt: Date;
}

export interface PDFFile {
  id: string;
  name: string;
  data: ArrayBuffer; // PDF 바이너리 데이터
  type: string; // MIME 타입 (application/pdf)
  size: number; // 파일 크기 (bytes)
  createdAt: Date;
}

export interface VideoFile {
  id: string;
  name: string;
  data: ArrayBuffer; // 동영상 바이너리 데이터
  type: string; // MIME 타입 (video/mp4, video/webm 등)
  size: number; // 파일 크기 (bytes)
  createdAt: Date;
}

const DB_NAME = 'AITextEditorDB';
const DB_VERSION = 4; // 버전 업그레이드 (동영상 저장소 추가)
const DOCUMENTS_STORE = 'documents';
const IMAGES_STORE = 'images';
const PDFS_STORE = 'pdfs';
const VIDEOS_STORE = 'videos';

let db: IDBDatabase | null = null;

export const initDB = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // 문서 저장소 (기존)
      if (!db.objectStoreNames.contains(DOCUMENTS_STORE)) {
        const store = db.createObjectStore(DOCUMENTS_STORE, { keyPath: 'id' });
        store.createIndex('title', 'title', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      
      // 이미지 저장소 (신규)
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        const imageStore = db.createObjectStore(IMAGES_STORE, { keyPath: 'id' });
        imageStore.createIndex('name', 'name', { unique: false });
        imageStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // PDF 저장소 (신규)
      if (!db.objectStoreNames.contains(PDFS_STORE)) {
        const pdfStore = db.createObjectStore(PDFS_STORE, { keyPath: 'id' });
        pdfStore.createIndex('name', 'name', { unique: false });
        pdfStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 동영상 저장소 (신규)
      if (!db.objectStoreNames.contains(VIDEOS_STORE)) {
        const videoStore = db.createObjectStore(VIDEOS_STORE, { keyPath: 'id' });
        videoStore.createIndex('name', 'name', { unique: false });
        videoStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
};

export const saveDocument = async (doc: Document): Promise<void> => {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([DOCUMENTS_STORE], 'readwrite');
    const store = transaction.objectStore(DOCUMENTS_STORE);
    const request = store.put(doc);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const getDocument = async (id: string): Promise<Document | null> => {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([DOCUMENTS_STORE], 'readonly');
    const store = transaction.objectStore(DOCUMENTS_STORE);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
};

export const getAllDocuments = async (): Promise<Document[]> => {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([DOCUMENTS_STORE], 'readonly');
    const store = transaction.objectStore(DOCUMENTS_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

export const deleteDocument = async (id: string): Promise<void> => {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([DOCUMENTS_STORE], 'readwrite');
    const store = transaction.objectStore(DOCUMENTS_STORE);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const updateDocument = async (id: string, updates: Partial<Document>): Promise<void> => {
  if (!db) await initDB();
  
  // 먼저 기존 문서를 가져옴
  const existingDoc = await getDocument(id);
  if (!existingDoc) {
    throw new Error('Document not found');
  }
  
  // 업데이트된 문서 생성
  const updatedDoc: Document = {
    ...existingDoc,
    ...updates,
    updatedAt: new Date()
  };
  
  // 저장
  return saveDocument(updatedDoc);
};

// ===== 이미지 관련 함수들 =====

export const saveImage = async (image: ImageFile): Promise<void> => {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([IMAGES_STORE], 'readwrite');
    const store = transaction.objectStore(IMAGES_STORE);
    const request = store.put(image);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const getImage = async (id: string): Promise<ImageFile | null> => {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([IMAGES_STORE], 'readonly');
    const store = transaction.objectStore(IMAGES_STORE);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
};

export const getAllImages = async (): Promise<ImageFile[]> => {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([IMAGES_STORE], 'readonly');
    const store = transaction.objectStore(IMAGES_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

export const deleteImage = async (id: string): Promise<void> => {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([IMAGES_STORE], 'readwrite');
    const store = transaction.objectStore(IMAGES_STORE);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const updateImage = async (id: string, updates: Partial<ImageFile>): Promise<void> => {
  if (!db) await initDB();
  
  // 먼저 기존 이미지를 가져옴
  const existingImage = await getImage(id);
  if (!existingImage) {
    throw new Error('Image not found');
  }
  
  // 업데이트된 이미지 생성
  const updatedImage: ImageFile = {
    ...existingImage,
    ...updates
  };
  
  // 저장
  return saveImage(updatedImage);
};

// PDF 관련 함수들
export const savePdf = async (pdf: PDFFile): Promise<void> => {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([PDFS_STORE], 'readwrite');
    const store = transaction.objectStore(PDFS_STORE);
    const request = store.put(pdf);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const getPdf = async (id: string): Promise<PDFFile | null> => {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([PDFS_STORE], 'readonly');
    const store = transaction.objectStore(PDFS_STORE);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
};

export const getAllPdfs = async (): Promise<PDFFile[]> => {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([PDFS_STORE], 'readonly');
    const store = transaction.objectStore(PDFS_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
};

export const deletePdf = async (id: string): Promise<void> => {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([PDFS_STORE], 'readwrite');
    const store = transaction.objectStore(PDFS_STORE);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const updatePdf = async (id: string, updates: Partial<PDFFile>): Promise<void> => {
  if (!db) await initDB();

  // 먼저 기존 PDF를 가져옴
  const existingPdf = await getPdf(id);
  if (!existingPdf) {
    throw new Error('PDF not found');
  }

  // 업데이트된 PDF 생성
  const updatedPdf: PDFFile = {
    ...existingPdf,
    ...updates
  };

  // 저장
  return savePdf(updatedPdf);
};

// ===== 동영상 관련 함수들 =====

// 모든 동영상 가져오기
export const getAllVideos = async (): Promise<VideoFile[]> => {
  if (!db) await initDB();
  const transaction = db!.transaction([VIDEOS_STORE], 'readonly');
  const store = transaction.objectStore(VIDEOS_STORE);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// 동영상 저장하기
export const saveVideo = async (video: VideoFile): Promise<void> => {
  if (!db) await initDB();
  const transaction = db!.transaction([VIDEOS_STORE], 'readwrite');
  const store = transaction.objectStore(VIDEOS_STORE);
  return new Promise((resolve, reject) => {
    const request = store.put(video);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// 동영상 가져오기 (ID로)
export const getVideo = async (id: string): Promise<VideoFile | null> => {
  if (!db) await initDB();
  const transaction = db!.transaction([VIDEOS_STORE], 'readonly');
  const store = transaction.objectStore(VIDEOS_STORE);
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

// 동영상 삭제하기
export const deleteVideo = async (id: string): Promise<void> => {
  if (!db) await initDB();
  const transaction = db!.transaction([VIDEOS_STORE], 'readwrite');
  const store = transaction.objectStore(VIDEOS_STORE);
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// 동영상 업데이트하기
export const updateVideo = async (id: string, updates: Partial<VideoFile>): Promise<void> => {
  if (!db) await initDB();

  // 먼저 기존 동영상을 가져옴
  const existingVideo = await getVideo(id);
  if (!existingVideo) {
    throw new Error('Video not found');
  }

  const updatedVideo: VideoFile = {
    ...existingVideo,
    ...updates
  };

  // 저장
  await saveVideo(updatedVideo);
};