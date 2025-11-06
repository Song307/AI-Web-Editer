// src/utils/db.ts

export interface SecretaryCreationData {
  name: string;
  gender: 'male' | 'female';
  personality: string;
  imageUrl?: string;
  voiceParams: {
    rate: number;
    pitch: number;
    voiceName: string;
  };
}

export interface VoiceParams {
  rate: number;
  pitch: number;
  voiceName: string;
}

export interface AISecretary {
  id: string;
  name: string;
  gender: 'male' | 'female';
  personality: string;
  personalityPrompt: string;
  imageUrl?: string;
  voiceParams: {
    rate: number;
    pitch: number;
    voiceName: string;
  };
  createdAt: Date;
  updatedAt: Date;
}export interface Document {
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

export interface EditedImageFile {
  id: string;
  name: string;
  content: string; // Base64 encoded image data
  folder: string; // 폴더 경로
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}


const DB_NAME = 'AITextEditorDB';
const DB_VERSION = 12; // 버전 올림 - 브라우저에 이미 버전 12가 존재
const DOCUMENTS_STORE = 'documents';
const IMAGES_STORE = 'images';
const PDFS_STORE = 'pdfs';
const VIDEOS_STORE = 'videos';
const AI_SECRETARIES_STORE = 'aiSecretaries';

let db: IDBDatabase | null = null;

export const deleteAndReinitDB = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log('IndexedDB 삭제 및 재초기화 시작');
    
    // 기존 연결 닫기
    if (db) {
      console.log('기존 DB 연결 닫기');
      db.close();
      db = null;
    }

    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);

    deleteRequest.onerror = () => {
      console.error('데이터베이스 삭제 실패:', deleteRequest.error);
      reject(deleteRequest.error);
    };

    deleteRequest.onblocked = () => {
      console.warn('데이터베이스 삭제가 차단됨 - 모든 탭을 닫아주세요');
      reject(new Error('데이터베이스 삭제가 차단되었습니다. 모든 탭을 닫고 다시 시도하세요.'));
    };

    deleteRequest.onsuccess = () => {
      console.log('데이터베이스 삭제 성공, 재초기화 진행');
      // 약간의 지연을 두고 재초기화
      setTimeout(() => {
        initDB().then(resolve).catch(reject);
      }, 100);
    };
  });
};

export const forceInitDB = async (): Promise<void> => {
  console.log('강제 데이터베이스 초기화 시작');
  try {
    // 데이터베이스 삭제 후 재생성
    await deleteAndReinitDB();
    console.log('강제 데이터베이스 초기화 완료');
  } catch (error) {
    console.error('강제 데이터베이스 초기화 실패:', error);
    throw error;
  }
};

export const initDB = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log('IndexedDB 초기화 시작, 버전:', DB_VERSION);

    // 이미 초기화된 데이터베이스가 있으면 닫기
    if (db) {
      console.log('기존 데이터베이스 연결 닫기');
      db.close();
      db = null;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB 초기화 실패:', request.error);
      console.error('에러 이벤트:', event);
      reject(request.error);
    };

    request.onblocked = () => {
      console.warn('IndexedDB 초기화가 차단됨 - 다른 탭에서 데이터베이스를 사용 중');
      reject(new Error('데이터베이스가 다른 탭에서 사용 중입니다. 다른 탭을 닫고 다시 시도하세요.'));
    };

    request.onsuccess = (event) => {
      db = request.result;
      console.log('IndexedDB 초기화 성공, 사용 가능한 오브젝트 스토어:', Array.from(db.objectStoreNames));
      console.log('데이터베이스 버전:', db.version);

      // 필수 객체 스토어가 모두 있는지 확인
      const requiredStores = [DOCUMENTS_STORE, IMAGES_STORE, PDFS_STORE, VIDEOS_STORE, AI_SECRETARIES_STORE];
      const missingStores = requiredStores.filter(store => !db!.objectStoreNames.contains(store));
      
      if (missingStores.length > 0) {
        console.error('누락된 객체 스토어:', missingStores);
        console.log('데이터베이스 재생성 필요');
        db!.close();
        db = null;
        // 버전을 올려서 다시 시도
        indexedDB.deleteDatabase(DB_NAME).onsuccess = () => {
          setTimeout(() => {
            initDB().then(resolve).catch(reject);
          }, 100);
        };
        return;
      }

      // 데이터베이스 연결이 끊어졌을 때 재연결
      db.onversionchange = () => {
        console.log('데이터베이스 버전 변경 감지, 연결 종료');
        db?.close();
        db = null;
      };

      resolve();
    };

    request.onupgradeneeded = (event) => {
      console.log('데이터베이스 업그레이드 필요, 현재 버전:', event.oldVersion, '새 버전:', event.newVersion);
      const upgradeDb = (event.target as IDBOpenDBRequest).result;

      // 문서 저장소 (기존)
      if (!upgradeDb.objectStoreNames.contains(DOCUMENTS_STORE)) {
        const store = upgradeDb.createObjectStore(DOCUMENTS_STORE, { keyPath: 'id' });
        store.createIndex('title', 'title', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        console.log('문서 저장소 생성됨');
      }

      // 이미지 저장소 (기존)
      if (!upgradeDb.objectStoreNames.contains(IMAGES_STORE)) {
        const imageStore = upgradeDb.createObjectStore(IMAGES_STORE, { keyPath: 'id' });
        imageStore.createIndex('name', 'name', { unique: false });
        imageStore.createIndex('createdAt', 'createdAt', { unique: false });
        console.log('이미지 저장소 생성됨');
      }

      // PDF 저장소 (신규)
      if (!upgradeDb.objectStoreNames.contains(PDFS_STORE)) {
        const pdfStore = upgradeDb.createObjectStore(PDFS_STORE, { keyPath: 'id' });
        pdfStore.createIndex('name', 'name', { unique: false });
        pdfStore.createIndex('createdAt', 'createdAt', { unique: false });
        console.log('PDF 저장소 생성됨');
      }

      // 동영상 저장소 (신규)
      if (!upgradeDb.objectStoreNames.contains(VIDEOS_STORE)) {
        const videoStore = upgradeDb.createObjectStore(VIDEOS_STORE, { keyPath: 'id' });
        videoStore.createIndex('name', 'name', { unique: false });
        videoStore.createIndex('createdAt', 'createdAt', { unique: false });
        console.log('동영상 저장소 생성됨');
      }

      // AI 비서 저장소 (신규)
      if (!upgradeDb.objectStoreNames.contains(AI_SECRETARIES_STORE)) {
        const aiSecretaryStore = upgradeDb.createObjectStore(AI_SECRETARIES_STORE, { keyPath: 'id' });
        aiSecretaryStore.createIndex('name', 'name', { unique: false });
        aiSecretaryStore.createIndex('createdAt', 'createdAt', { unique: false });
        console.log('AI 비서 저장소 생성됨');
      }

      console.log('데이터베이스 업그레이드 완료, 최종 저장소 목록:', Array.from(upgradeDb.objectStoreNames));
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
  console.log('getAllDocuments called');
  
  try {
    if (!db) {
      console.log('Database not initialized, initializing...');
      await initDB();
      if (!db) {
        throw new Error('Database initialization failed');
      }
    }
    
    console.log('Database connection established, creating transaction...');
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = db!.transaction([DOCUMENTS_STORE], 'readonly');
        console.log('Transaction created, getting object store...');
        
        const store = transaction.objectStore(DOCUMENTS_STORE);
        console.log('Object store retrieved, creating request...');
        
        const request = store.getAll();
        console.log('Request created, setting up handlers...');
        
        request.onerror = () => {
          console.error('Error in getAll request:', request.error);
          reject(request.error || new Error('Unknown error in getAll request'));
        };
        
        request.onsuccess = () => {
          console.log('getAll request successful, result:', request.result);
          if (!Array.isArray(request.result)) {
            console.error('Unexpected result format:', request.result);
            reject(new Error('Expected an array of documents'));
            return;
          }
          resolve(request.result);
        };
        
        transaction.oncomplete = () => {
          console.log('Transaction completed');
        };
        
        transaction.onerror = (event) => {
          console.error('Transaction error:', event);
          reject(transaction.error || new Error('Unknown transaction error'));
        };
        
      } catch (error) {
        console.error('Error in getAllDocuments promise:', error);
        reject(error);
      }
    });
  } catch (error) {
    console.error('Error in getAllDocuments function:', error);
    throw error;
  }
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
// 편집된 이미지 저장소 상수
const EDITED_IMAGES_STORE = 'editedImages';

// 편집된 이미지 저장하기
export const saveEditedImage = async (image: EditedImageFile): Promise<void> => {
  if (!db) await initDB();
  const transaction = db!.transaction([EDITED_IMAGES_STORE], 'readwrite');
  const store = transaction.objectStore(EDITED_IMAGES_STORE);
  return new Promise((resolve, reject) => {
    const request = store.put(image);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// 모든 편집된 이미지 가져오기
export const getAllEditedImages = async (): Promise<EditedImageFile[]> => {
  if (!db) await initDB();
  const transaction = db!.transaction([EDITED_IMAGES_STORE], 'readonly');
  const store = transaction.objectStore(EDITED_IMAGES_STORE);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// 편집된 이미지 가져오기 (ID로)
export const getEditedImage = async (id: string): Promise<EditedImageFile | null> => {
  if (!db) await initDB();
  const transaction = db!.transaction([EDITED_IMAGES_STORE], 'readonly');
  const store = transaction.objectStore(EDITED_IMAGES_STORE);
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

// 편집된 이미지 삭제하기
export const deleteEditedImage = async (id: string): Promise<void> => {
  if (!db) await initDB();
  const transaction = db!.transaction([EDITED_IMAGES_STORE], 'readwrite');
  const store = transaction.objectStore(EDITED_IMAGES_STORE);
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// AI 비서 저장하기
export const saveAISecretary = async (secretaryData: SecretaryCreationData): Promise<AISecretary> => {
  try {
    // 데이터베이스 초기화 확인 및 재시도
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      if (!db) {
        console.log(`DB 초기화 시도 (${retries + 1}/${maxRetries})`);
        await initDB();
      }
      
      if (db && db.objectStoreNames.contains(AI_SECRETARIES_STORE)) {
        break; // 성공
      }
      
      console.log(`AI 비서 저장소 없음, 강제 초기화 (${retries + 1}/${maxRetries})`);
      await forceInitDB();
      retries++;
      
      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms 대기
      }
    }

    // 최종 확인
    if (!db || !db.objectStoreNames.contains(AI_SECRETARIES_STORE)) {
      throw new Error('AI 비서 저장소를 생성할 수 없습니다. 페이지를 새로고침해주세요.');
    }

    const secretary: AISecretary = {
      id: Date.now().toString(),
      name: secretaryData.name,
      gender: secretaryData.gender,
      personality: secretaryData.personality,
      personalityPrompt: `너는 ${secretaryData.personality} 성격을 가진 AI 비서야. 사용자의 요청에 대해 이 성격을 반영해서 답변해줘.`,
      imageUrl: secretaryData.imageUrl,
      voiceParams: secretaryData.voiceParams,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log('AI 비서 저장 시도:', secretary);

    const transaction = db!.transaction([AI_SECRETARIES_STORE], 'readwrite');
    const store = transaction.objectStore(AI_SECRETARIES_STORE);
    return new Promise((resolve, reject) => {
      const request = store.add(secretary);
      request.onsuccess = () => {
        console.log('AI 비서 저장 성공, ID:', secretary.id);
        resolve(secretary);
      };
      request.onerror = () => {
        console.error('AI 비서 저장 실패:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('AI 비서 저장 중 예외 발생:', error);
    throw error;
  }
};

// 모든 AI 비서 가져오기
export const getAllAISecretaries = async (): Promise<AISecretary[]> => {
  try {
    // 데이터베이스 초기화 확인
    if (!db) {
      console.log('DB가 초기화되지 않음, 초기화 시도');
      await initDB();
    }

    if (!db || !db.objectStoreNames.contains(AI_SECRETARIES_STORE)) {
      console.log('AI 비서 저장소가 없음, 강제 초기화 시도');
      await forceInitDB();
    }

    // 최종 확인
    if (!db || !db.objectStoreNames.contains(AI_SECRETARIES_STORE)) {
      console.warn('AI 비서 저장소를 찾을 수 없음, 빈 배열 반환');
      return [];
    }

    console.log('AI 비서 목록 조회 시도');
    const transaction = db!.transaction([AI_SECRETARIES_STORE], 'readonly');
    const store = transaction.objectStore(AI_SECRETARIES_STORE);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        console.log('AI 비서 목록 조회 성공, 개수:', request.result?.length || 0);
        resolve(request.result || []);
      };
      request.onerror = () => {
        console.error('AI 비서 목록 조회 실패:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('AI 비서 목록 조회 중 예외 발생:', error);
    return []; // 에러 시 빈 배열 반환
  }
};

// AI 비서 업데이트하기
export const updateAISecretary = async (id: string, updates: Partial<AISecretary>): Promise<void> => {
  try {
    // 데이터베이스 초기화 확인
    if (!db) {
      await initDB();
    }
    
    if (!db || !db.objectStoreNames.contains(AI_SECRETARIES_STORE)) {
      console.log('AI 비서 저장소가 없음, 강제 초기화 시도');
      await forceInitDB();
    }

    if (!db || !db.objectStoreNames.contains(AI_SECRETARIES_STORE)) {
      throw new Error('AI 비서 저장소를 찾을 수 없습니다.');
    }

    const transaction = db!.transaction([AI_SECRETARIES_STORE], 'readwrite');
    const store = transaction.objectStore(AI_SECRETARIES_STORE);
    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const secretary = getRequest.result;
        if (secretary) {
          const updatedSecretary = { ...secretary, ...updates, updatedAt: new Date() };
          const putRequest = store.put(updatedSecretary);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error('AI Secretary not found'));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  } catch (error) {
    console.error('AI 비서 업데이트 중 예외 발생:', error);
    throw error;
  }
};

// AI 비서 삭제
export const deleteAISecretary = async (id: string): Promise<void> => {
  try {
    // 데이터베이스 초기화 확인
    if (!db) {
      await initDB();
    }
    
    if (!db || !db.objectStoreNames.contains(AI_SECRETARIES_STORE)) {
      console.log('AI 비서 저장소가 없음, 강제 초기화 시도');
      await forceInitDB();
    }

    if (!db || !db.objectStoreNames.contains(AI_SECRETARIES_STORE)) {
      throw new Error('AI 비서 저장소를 찾을 수 없습니다.');
    }

    console.log('AI 비서 삭제 시도, ID:', id);
    const transaction = db!.transaction([AI_SECRETARIES_STORE], 'readwrite');
    const store = transaction.objectStore(AI_SECRETARIES_STORE);
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => {
        console.log('AI 비서 삭제 성공, ID:', id);
        resolve();
      };
      request.onerror = () => {
        console.error('AI 비서 삭제 실패, ID:', id, '오류:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('AI 비서 삭제 중 예외 발생:', error);
    throw error;
  }
};
