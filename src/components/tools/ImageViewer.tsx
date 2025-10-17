import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomOut, ZoomIn, ArrowClockwise, ArrowCounterclockwise, ArrowRepeat, Download, Fullscreen, FullscreenExit } from 'react-bootstrap-icons';
import { ImageFile } from '../../utils/db';

interface ImageViewerProps {
  image: ImageFile | null;
  onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ image, onClose }) => {
  const [imageZoom, setImageZoom] = useState(1.0);
  const [imageRotation, setImageRotation] = useState(0);
  const [imageFullscreen, setImageFullscreen] = useState(false);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageViewerRef = useRef<HTMLDivElement>(null);

  // 이미지 뷰어 기능 함수들
  const zoomImageIn = () => {
    setImageZoom(prev => Math.min(prev + 0.1, 3.0));
  };

  const zoomImageOut = () => {
    setImageZoom(prev => Math.max(prev - 0.1, 0.1));
  };

  const resetImageZoom = () => {
    setImageZoom(1.0);
  };

  const rotateImageClockwise = () => {
    setImageRotation(prev => (prev + 90) % 360);
  };

  const rotateImageCounterClockwise = () => {
    setImageRotation(prev => (prev - 90 + 360) % 360);
  };

  const resetImageRotation = () => {
    setImageRotation(0);
  };

  const downloadImage = () => {
    if (!image) return;

    const blob = new Blob([image.data], { type: image.type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = image.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleImageFullscreen = async () => {
    if (!imageViewerRef.current) return;

    try {
      if (!imageFullscreen) {
        if (imageViewerRef.current.requestFullscreen) {
          await imageViewerRef.current.requestFullscreen();
        } else if ((imageViewerRef.current as any).webkitRequestFullscreen) {
          await (imageViewerRef.current as any).webkitRequestFullscreen();
        } else if ((imageViewerRef.current as any).mozRequestFullScreen) {
          await (imageViewerRef.current as any).mozRequestFullScreen();
        } else if ((imageViewerRef.current as any).msRequestFullscreen) {
          await (imageViewerRef.current as any).msRequestFullscreen();
        }
      } else {
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
  };

  // 이미지 뷰어 마우스 이벤트 핸들러들
  const handleMouseDown = (e: React.MouseEvent) => {
    if (imageZoom > 1) { // 줌이 1보다 클 때만 드래그 허용
      setIsDragging(true);
      setDragStart({
        x: e.clientX - imagePosition.x,
        y: e.clientY - imagePosition.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && imageZoom > 1) {
      setImagePosition({
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

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (image) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [image, onClose]);

  // 이미지 변경 시 상태 초기화
  useEffect(() => {
    if (image) {
      setImageZoom(1.0);
      setImageRotation(0);
      setImageFullscreen(false);
      setImagePosition({ x: 0, y: 0 });
      setIsDragging(false);
    }
  }, [image]);

  if (!image) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div
        ref={imageViewerRef}
        style={{
          position: 'relative',
          maxWidth: '90vw',
          maxHeight: '90vh',
          background: 'var(--bg-primary)',
          borderRadius: 'var(--border-radius)',
          overflow: 'hidden'
        }}
      >
        {/* Image Viewer Header */}
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
            {image.name}
          </h3>
          <button
            onClick={onClose}
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

        {/* Image Viewer Controls */}
        <div style={{
          padding: '8px 16px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          gap: '8px',
          alignItems: 'center'
        }}>
          <button
            onClick={zoomImageOut}
            style={{
              padding: '6px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
            title="축소"
          >
            <ZoomOut size={16} />
          </button>
          <span style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            minWidth: '60px',
            textAlign: 'center'
          }}>
            {Math.round(imageZoom * 100)}%
          </span>
          <button
            onClick={zoomImageIn}
            style={{
              padding: '6px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
            title="확대"
          >
            <ZoomIn size={16} />
          </button>
          <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 8px' }} />
          <button
            onClick={rotateImageCounterClockwise}
            style={{
              padding: '6px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
            title="반시계 방향 회전"
          >
            <ArrowCounterclockwise size={16} />
          </button>
          <button
            onClick={rotateImageClockwise}
            style={{
              padding: '6px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
            title="시계 방향 회전"
          >
            <ArrowClockwise size={16} />
          </button>
          <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 8px' }} />
          <button
            onClick={resetImageZoom}
            style={{
              padding: '6px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
            title="줌 초기화"
          >
            <ArrowRepeat size={16} />
          </button>
          <button
            onClick={resetImageRotation}
            style={{
              padding: '6px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
            title="회전 초기화"
          >
            <ArrowRepeat size={16} />
          </button>
          <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 8px' }} />
          <button
            onClick={downloadImage}
            style={{
              padding: '6px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
            title="다운로드"
          >
            <Download size={16} />
          </button>
          <button
            onClick={toggleImageFullscreen}
            style={{
              padding: '6px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
            title={imageFullscreen ? '전체화면 종료' : '전체화면'}
          >
            {imageFullscreen ? <FullscreenExit size={16} /> : <Fullscreen size={16} />}
          </button>
        </div>

        {/* Image Display */}
        <div
          style={{
            padding: '20px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '400px',
            cursor: imageZoom > 1 ? 'grab' : 'default',
            overflow: 'hidden'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <img
            src={URL.createObjectURL(new Blob([image.data], { type: image.type }))}
            alt={image.name}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              transform: `scale(${imageZoom}) rotate(${imageRotation}deg) translate(${imagePosition.x}px, ${imagePosition.y}px)`,
              transition: isDragging ? 'none' : 'transform 0.1s ease',
              userSelect: 'none'
            }}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
};

export default ImageViewer;