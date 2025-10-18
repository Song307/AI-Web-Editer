import React, { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  ZoomOut,
  ZoomIn,
  ArrowClockwise,
  ArrowCounterclockwise,
  ArrowRepeat,
  Download,
  ArrowLeft,
  ArrowRight,
  Search,
  List,
  ChevronLeft,
  ChevronRight,
  Fullscreen,
  FullscreenExit,
  InfoCircle
} from 'react-bootstrap-icons';

// PDF.js 워커를 로컬 public 폴더에서 로드하도록 설정
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface PDFViewerProps {
  file?: File | null;
  pdfData?: string | ArrayBuffer;
  fileName?: string;
  onClose?: () => void;
  toolbarVisible?: boolean;
  customToolbar?: React.ReactNode;
}

const PDFViewer = forwardRef<any, PDFViewerProps>(({ file, pdfData, fileName, onClose, toolbarVisible = true, customToolbar }, ref) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 새로운 기능들을 위한 상태
  const [scale, setScale] = useState(1.0); // 줌 레벨
  const [rotation, setRotation] = useState(0); // 회전 각도 (0, 90, 180, 270)
  const [blobUrl, setBlobUrl] = useState<string | null>(null); // 다운로드를 위한 Blob URL
  
  // 드래그-투-팬을 위한 상태
  const [position, setPosition] = useState({ x: 0, y: 0 }); // PDF 위치
  const [isDragging, setIsDragging] = useState(false); // 드래그 중인지 여부
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 }); // 드래그 시작 위치
  
  // 썸네일 사이드바와 검색을 위한 상태
  const [showThumbnails, setShowThumbnails] = useState(false); // 썸네일 사이드바 표시 여부
  const [searchText, setSearchText] = useState(''); // 검색 텍스트
  const [searchResults, setSearchResults] = useState<any[]>([]); // 검색 결과
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1); // 현재 검색 결과 인덱스
  const [pageSizes, setPageSizes] = useState<{ [key: number]: { width: number; height: number } }>({}); // 각 페이지의 크기 정보
  const pdfDocumentRef = useRef<any>(null); // PDF 문서 참조
  const thumbnailsListRef = useRef<HTMLDivElement>(null); // 썸네일 리스트 참조
  const thumbnailsSidebarRef = useRef<HTMLDivElement>(null); // 썸네일 사이드바 참조
  const isSidebarHoverRef = useRef<boolean>(false); // 사이드바 호버 상태 추적
  const lockScrollRef = useRef<boolean>(false); // 완전 분리를 위한 잠금 플래그
  
  // 풀스크린과 PDF 정보 표시를 위한 상태
  const [isFullscreen, setIsFullscreen] = useState(false); // 풀스크린 모드 여부
  const [showPdfInfo, setShowPdfInfo] = useState(false); // PDF 정보 표시 여부
  const [pdfInfo, setPdfInfo] = useState<any>(null); // PDF 메타데이터 정보
  const viewerRef = useRef<HTMLDivElement>(null); // 뷰어 컨테이너 참조
  const mainViewerRef = useRef<HTMLDivElement>(null); // 메인 PDF 뷰어 영역 참조

  // PDF 데이터 처리
  const processedPdfData = React.useMemo(() => {
    if (!pdfData && !file) {
      return null;
    }
    
    if (!pdfData) return file;
    
    // pdfData가 ArrayBuffer인 경우 Blob URL로 변환
    if (pdfData instanceof ArrayBuffer) {
      const blob = new Blob([pdfData], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url); // 다운로드를 위해 Blob URL 저장
      return url;
    }
    
    // pdfData가 string인 경우 그대로 사용
    return pdfData;
  }, [pdfData, file]);

  useImperativeHandle(ref, () => ({
    zoomIn,
    zoomOut,
    resetZoom,
    rotateClockwise,
    rotateCounterClockwise,
    resetRotation,
    goToPrevPage,
    goToNextPage,
    goToPage,
    toggleThumbnails,
    togglePdfInfo,
    downloadPDF,
    toggleFullscreen,
    // expose a small status getter
    getState: () => ({ rotation, pageNumber, numPages })
  }));

  // 드래그-투-팬 기능
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) { // 줌인된 상태에서만 드래그 허용
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  // 줌 관련 함수
  const zoomIn = () => setScale(s => Math.min(s + 0.1, 4));
  const zoomOut = () => setScale(s => Math.max(s - 0.1, 0.25));
  const resetZoom = () => setScale(1);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // 회전 기능
  const rotateClockwise = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const rotateCounterClockwise = () => {
    setRotation(prev => (prev - 90 + 360) % 360);
  };

  const resetRotation = () => {
    setRotation(0);
  };

  // 다운로드 기능
  const downloadPDF = () => {
    if (!blobUrl && !file) return;

    const link = document.createElement('a');
    link.href = blobUrl || URL.createObjectURL(file!);
    link.download = fileName || file?.name || 'document.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 썸네일 사이드바 토글
  const toggleThumbnails = () => {
    setShowThumbnails(prev => !prev);
  };

  // 검색 기능
  const performSearch = useCallback(async (text: string) => {
    if (!text.trim() || !pdfDocumentRef.current) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      return;
    }

    try {
      const pdf = pdfDocumentRef.current;
      const results: any[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');

        // 대소문자 구분 없는 검색
        const regex = new RegExp(text, 'gi');
        let match;
        while ((match = regex.exec(pageText)) !== null) {
          results.push({
            pageNumber: pageNum,
            text: match[0],
            index: match.index
          });
        }
      }

      setSearchResults(results);
      setCurrentSearchIndex(results.length > 0 ? 0 : -1);

      // 첫 번째 검색 결과로 페이지 이동
      if (results.length > 0) {
        setPageNumber(results[0].pageNumber);
      }
    } catch (error) {
      console.error('검색 중 오류:', error);
    }
  }, []);

  // 다음 검색 결과로 이동
  const goToNextSearchResult = () => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIndex);
    setPageNumber(searchResults[nextIndex].pageNumber);
  };

  // 이전 검색 결과로 이동
  const goToPrevSearchResult = () => {
    if (searchResults.length === 0) return;
    const prevIndex = currentSearchIndex === 0 ? searchResults.length - 1 : currentSearchIndex - 1;
    setCurrentSearchIndex(prevIndex);
    setPageNumber(searchResults[prevIndex].pageNumber);
  };

  // 검색 텍스트 변경 핸들러
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setSearchText(text);
    performSearch(text);
  };

  // 풀스크린 모드 토글
  const toggleFullscreen = useCallback(async () => {
    if (!viewerRef.current) return;

    try {
      if (!isFullscreen) {
        // 풀스크린 진입
        if (viewerRef.current.requestFullscreen) {
          await viewerRef.current.requestFullscreen();
        } else if ((viewerRef.current as any).webkitRequestFullscreen) {
          await (viewerRef.current as any).webkitRequestFullscreen();
        } else if ((viewerRef.current as any).mozRequestFullScreen) {
          await (viewerRef.current as any).mozRequestFullScreen();
        } else if ((viewerRef.current as any).msRequestFullscreen) {
          await (viewerRef.current as any).msRequestFullscreen();
        }
      } else {
        // 풀스크린 종료
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (error) {
      console.error('풀스크린 모드 전환 실패:', error);
    }
  }, [isFullscreen]);

  // 풀스크린 상태 변경 감지
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    // ESC 키로 풀스크린 종료 감지
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  // 키보드 이벤트 핸들러 (좌우 화살표로 페이지 이동)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // PDF 뷰어가 활성화되어 있고, 입력 필드가 아닌 경우에만 처리
      if (!viewerRef.current?.contains(document.activeElement as Node) && 
          document.activeElement?.tagName !== 'INPUT' && 
          document.activeElement?.tagName !== 'TEXTAREA') {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          goToPrevPage();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          goToNextPage();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [numPages]); // numPages가 변경될 때마다 리스너 재설정

  // PDF 정보 표시 토글
  const togglePdfInfo = () => {
    setShowPdfInfo(prev => !prev);
  };

  // PDF 메타데이터 추출
  const extractPdfInfo = useCallback(async (pdf: any) => {
    if (!pdf) return;

    try {
      const info = await pdf.getMetadata();
      const fileSize = file ? (file.size / 1024 / 1024).toFixed(2) + ' MB' : '알 수 없음';

      setPdfInfo({
        title: info.info?.Title || fileName || '제목 없음',
        author: info.info?.Author || '알 수 없음',
        subject: info.info?.Subject || '없음',
        creator: info.info?.Creator || '알 수 없음',
        producer: info.info?.Producer || '알 수 없음',
        creationDate: info.info?.CreationDate ? new Date(info.info.CreationDate).toLocaleString() : '알 수 없음',
        modificationDate: info.info?.ModDate ? new Date(info.info.ModDate).toLocaleString() : '알 수 없음',
        fileSize,
        pages: pdf.numPages,
        currentZoom: `${Math.round(scale * 100)}%`,
        currentRotation: `${rotation}°`
      });
    } catch (error) {
      console.error('PDF 정보 추출 실패:', error);
      setPdfInfo({
        title: fileName || '제목 없음',
        author: '알 수 없음',
        fileSize: file ? (file.size / 1024 / 1024).toFixed(2) + ' MB' : '알 수 없음',
        pages: pdf?.numPages || '알 수 없음',
        currentZoom: `${Math.round(scale * 100)}%`,
        currentRotation: `${rotation}°`
      });
    }
  }, [file, fileName, scale, rotation]);

  // PDF 로드 시 정보 추출
  useEffect(() => {
    if (pdfDocumentRef.current) {
      extractPdfInfo(pdfDocumentRef.current);
    }
  }, [pdfDocumentRef.current, extractPdfInfo]);

  // 썸네일 사이드바 스크롤 분리를 위한 useEffect
  // Replace: we'll attach/detach the document wheel listener on pointer enter/leave
  const wheelHandlerRef = useRef<((e: WheelEvent) => void) | null>(null);

  const addDocWheelListener = () => {
    if (wheelHandlerRef.current) return; // already attached
    const handler = (e: WheelEvent) => {
      if (!isSidebarHoverRef.current) return;
      const sidebar = thumbnailsSidebarRef.current;
      if (!sidebar) return;
      // Only act if event target is inside the sidebar
      const target = e.target as Node;
      if (!sidebar.contains(target)) return;

      e.preventDefault();
      e.stopPropagation();
      sidebar.scrollTop += e.deltaY;
    };
    wheelHandlerRef.current = handler;
    document.addEventListener('wheel', handler, { passive: false, capture: true });
  };

  const removeDocWheelListener = () => {
    const handler = wheelHandlerRef.current;
    if (!handler) return;
    document.removeEventListener('wheel', handler, { capture: true } as any);
    wheelHandlerRef.current = null;
  };

  // Ensure we remove listener on unmount
  useEffect(() => {
    return () => {
      removeDocWheelListener();
    };
  }, []);

  // PDF 문서 로드 성공 시 참조 저장
  const onDocumentLoadSuccessWithRef = useCallback(async (pdf: any) => {
    setNumPages(pdf.numPages);
    setPageNumber(1);
    setLoading(false);
    setError(null);
    pdfDocumentRef.current = pdf;
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('PDF 로드 오류:', error);
    setError('PDF 파일을 로드할 수 없습니다.');
    setLoading(false);
  }, []);

  const onLoadStart = useCallback(() => {
    setLoading(true);
    setError(null);
  }, []);

  const goToPrevPage = () => {
    setPageNumber(prev => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber(prev => Math.min(prev + 1, numPages || 1));
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= (numPages || 1)) {
      setPageNumber(page);
    }
  };

  if (!file && !pdfData) {
    return (
      <div className="pdf-viewer-container">
        <div className="pdf-viewer-content">
          <div className="pdf-placeholder">
            <p>PDF 파일을 선택해주세요.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-viewer-container" ref={viewerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {toolbarVisible && customToolbar ? customToolbar : toolbarVisible && (
        <div className="pdf-viewer-toolbar">
        {/* 썸네일 토글 버튼 */}
        <div className="pdf-sidebar-controls">
          <button onClick={toggleThumbnails} className={`pdf-tool-btn ${showThumbnails ? 'active' : ''}`} title="썸네일 사이드바">
            <List size={16} />
          </button>
        </div>

        {/* 줌 컨트롤 */}
        <div className="pdf-zoom-controls">
          <button onClick={zoomOut} className="pdf-tool-btn" title="축소">
            <ZoomOut size={16} />
          </button>
          <span className="pdf-zoom-level">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} className="pdf-tool-btn" title="확대">
            <ZoomIn size={16} />
          </button>
          <button onClick={resetZoom} className="pdf-tool-btn" title="원래 크기로">
            <ArrowRepeat size={16} />
          </button>
        </div>

        {/* 회전 컨트롤 */}
        <div className="pdf-rotation-controls">
          <button onClick={rotateCounterClockwise} className="pdf-tool-btn" title="반시계방향 회전">
            <ArrowCounterclockwise size={16} />
          </button>
          <span className="pdf-rotation-angle">{rotation}°</span>
          <button onClick={rotateClockwise} className="pdf-tool-btn" title="시계방향 회전">
            <ArrowClockwise size={16} />
          </button>
          <button onClick={resetRotation} className="pdf-tool-btn" title="회전 초기화">
            <ArrowRepeat size={16} />
          </button>
        </div>

        {/* 페이지 네비게이션 */}
        <div className="pdf-navigation-controls">
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className="pdf-nav-btn"
            style={{ width: '28px', padding: '4px 6px' }}
          >
            <ArrowLeft size={16} />
          </button>

          <span className="pdf-page-info">
            <input
              type="number"
              min={1}
              max={numPages || 1}
              value={pageNumber}
              onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
              className="pdf-page-input"
              disabled={numPages === null}
            />
            / {numPages === null ? '로딩 중...' : numPages}
          </span>

          <button
            onClick={goToNextPage}
            disabled={pageNumber >= (numPages || 1)}
            className="pdf-nav-btn"
            style={{ width: '28px', padding: '4px 6px' }}
          >
            <ArrowRight size={16} />
          </button>
        </div>

        {/* 검색 컨트롤 */}
        <div className="pdf-search-controls">
          <div className="pdf-search-input-wrapper">
            <Search size={14} className="pdf-search-icon" />
            <input
              type="text"
              placeholder="PDF에서 검색..."
              value={searchText}
              onChange={handleSearchChange}
              className="pdf-search-input"
            />
            {searchResults.length > 0 && (
              <span className="pdf-search-results">
                {currentSearchIndex + 1}/{searchResults.length}
              </span>
            )}
          </div>
          {searchResults.length > 0 && (
            <div className="pdf-search-nav">
              <button onClick={goToPrevSearchResult} className="pdf-tool-btn" title="이전 검색 결과">
                <ChevronLeft size={14} />
              </button>
              <button onClick={goToNextSearchResult} className="pdf-tool-btn" title="다음 검색 결과">
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* 다운로드 버튼 */}
        <div className="pdf-download-controls">
          <button onClick={downloadPDF} className="pdf-tool-btn" title="다운로드">
            <Download size={16} />
          </button>
        </div>

        {/* 고급 기능 컨트롤 */}
        <div className="pdf-advanced-controls">
          <button onClick={toggleFullscreen} className="pdf-tool-btn" title="풀스크린">
            {isFullscreen ? <FullscreenExit size={16} /> : <Fullscreen size={16} />}
          </button>
          <button onClick={togglePdfInfo} className={`pdf-tool-btn ${showPdfInfo ? 'active' : ''}`} title="PDF 정보">
            <InfoCircle size={16} />
          </button>
        </div>
      </div>
      )}

      <div className="pdf-viewer-content" style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'visible' }}>
        {/* 썸네일 사이드바 */}
        {showThumbnails && (
          <div
            className="pdf-thumbnails-sidebar"
            ref={thumbnailsSidebarRef}
            style={{ flex: `0 0 ${isFullscreen ? '300px' : '250px'}`, display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', overscrollBehavior: 'contain' }}
            onPointerEnter={() => {
              // 마우스가 사이드바에 올라오면 상태 플래그 설정 및 wheel 리스너 attach
              isSidebarHoverRef.current = true;
              addDocWheelListener();
            }}
            onPointerLeave={() => {
              // 떠나면 복구 및 wheel 리스너 제거
              isSidebarHoverRef.current = false;
              removeDocWheelListener();
            }}
          >
            <div className="pdf-thumbnails-header" style={{ flexShrink: 0, padding: '12px 16px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#374151' }}>페이지</h4>
            </div>
            <div className="pdf-thumbnails-list" ref={thumbnailsListRef} style={{ flex: 1, overflowY: 'auto', padding: '4px', display: 'flex', flexDirection: 'column', gap: '4px', minHeight: 0, overscrollBehavior: 'contain' }}>
              {Array.from({ length: numPages || 0 }, (_, index) => {
                const pageSize = pageSizes[index + 1];
                const aspectRatio = pageSize ? pageSize.width / pageSize.height : 0.707; // 기본 A4 비율 (210/297 ≈ 0.707)
                const thumbnailWidth = isFullscreen ? 280 : 230; // 전체화면에서는 더 큰 썸네일
                const thumbnailHeight = thumbnailWidth / aspectRatio;
                
                return (
                  <div
                    key={index + 1}
                    className={`pdf-thumbnail-item ${pageNumber === index + 1 ? 'active' : ''}`}
                    onClick={() => setPageNumber(index + 1)}
                    style={{ 
                      width: '100%', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center',
                      cursor: 'pointer',
                      padding: '2px',
                      borderRadius: '4px',
                      border: pageNumber === index + 1 ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                      backgroundColor: pageNumber === index + 1 ? '#eff6ff' : '#ffffff'
                    }}
                  >
                    <div className="pdf-thumbnail-page" style={{ width: `${thumbnailWidth}px`, height: `${thumbnailHeight}px`, maxHeight: isFullscreen ? '300px' : '200px', border: '1px solid #d1d5db', borderRadius: '2px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
                      <Document
                        file={processedPdfData}
                        loading=""
                        className="pdf-thumbnail-doc"
                      >
                        <Page
                          pageNumber={index + 1}
                          scale={0.3}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          className="pdf-thumbnail-page-content"
                          loading=""
                          onLoadSuccess={(page) => {
                            // 페이지 크기 정보가 아직 없거나 변경된 경우에만 업데이트
                            if (!pageSizes[index + 1] || pageSizes[index + 1].width !== page.width || pageSizes[index + 1].height !== page.height) {
                              setPageSizes(prev => ({
                                ...prev,
                                [index + 1]: { width: page.width, height: page.height }
                              }));
                            }
                          }}
                        />
                      </Document>
                    </div>
                    <div className="pdf-thumbnail-number" style={{ marginTop: '2px', fontSize: '11px', fontWeight: '500', color: '#6b7280' }}>{index + 1}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 메인 PDF 뷰어 */}
  <div ref={mainViewerRef} className={`pdf-main-viewer ${showThumbnails ? 'with-sidebar' : ''}`} style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {/* PDF 정보 패널 */}
          {showPdfInfo && pdfInfo && (
            <div className="pdf-info-panel">
              <div className="pdf-info-header">
                <h4>PDF 정보</h4>
                <button onClick={togglePdfInfo} className="pdf-info-close">×</button>
              </div>
              <div className="pdf-info-content">
                <div className="pdf-info-row">
                  <span className="pdf-info-label">제목:</span>
                  <span className="pdf-info-value">{pdfInfo.title}</span>
                </div>
                <div className="pdf-info-row">
                  <span className="pdf-info-label">저자:</span>
                  <span className="pdf-info-value">{pdfInfo.author}</span>
                </div>
                <div className="pdf-info-row">
                  <span className="pdf-info-label">주제:</span>
                  <span className="pdf-info-value">{pdfInfo.subject}</span>
                </div>
                <div className="pdf-info-row">
                  <span className="pdf-info-label">생성자:</span>
                  <span className="pdf-info-value">{pdfInfo.creator}</span>
                </div>
                <div className="pdf-info-row">
                  <span className="pdf-info-label">생성일:</span>
                  <span className="pdf-info-value">{pdfInfo.creationDate}</span>
                </div>
                <div className="pdf-info-row">
                  <span className="pdf-info-label">수정일:</span>
                  <span className="pdf-info-value">{pdfInfo.modificationDate}</span>
                </div>
                <div className="pdf-info-row">
                  <span className="pdf-info-label">파일 크기:</span>
                  <span className="pdf-info-value">{pdfInfo.fileSize}</span>
                </div>
                <div className="pdf-info-row">
                  <span className="pdf-info-label">총 페이지:</span>
                  <span className="pdf-info-value">{pdfInfo.pages}</span>
                </div>
                <div className="pdf-info-row">
                  <span className="pdf-info-label">현재 줌:</span>
                  <span className="pdf-info-value">{pdfInfo.currentZoom}</span>
                </div>
                <div className="pdf-info-row">
                  <span className="pdf-info-label">현재 회전:</span>
                  <span className="pdf-info-value">{pdfInfo.currentRotation}</span>
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div className="pdf-loading">
              <div className="loading-spinner"></div>
              <p>PDF를 로딩 중...</p>
            </div>
          )}

          {error && (
            <div className="pdf-error">
              <p>❌ {error}</p>
            </div>
          )}

          {!loading && !error && (
            <div
              className="pdf-page-container"
              style={{
                transform: `translate(${position.x}px, ${position.y}px)`,
                transition: isDragging ? 'none' : 'transform 0.2s ease',
                cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                userSelect: 'none'
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
            >
              <Document
                file={processedPdfData as any}
                onLoadSuccess={onDocumentLoadSuccessWithRef}
                onLoadError={onDocumentLoadError}
                onLoadStart={onLoadStart}
                loading=""
                className="pdf-document"
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  rotate={rotation}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="pdf-page"
                  loading=""
                />
              </Document>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default PDFViewer;