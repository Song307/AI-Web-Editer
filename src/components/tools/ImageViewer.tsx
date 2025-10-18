import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomOut, ZoomIn, ArrowClockwise, ArrowCounterclockwise, ArrowRepeat, Download, Fullscreen, FullscreenExit } from 'react-bootstrap-icons';
import { ImageFile } from '../../utils/db';
import Modal from '../UI/shared/Modal';
import ModalHeader from '../UI/shared/ModalHeader';
import ModalToolbar from '../UI/shared/ModalToolbar';

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
      setImageFullscreen(!imageFullscreen);
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
    <Modal ref={imageViewerRef} onClose={onClose} size="large" transparent={true}>
      <ModalHeader fileName={image.name} onClose={onClose} />

        <ModalToolbar>
          <button
            onClick={zoomImageOut}
            className="p-1.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
            title="축소"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-300 min-w-[60px] text-center">
            {Math.round(imageZoom * 100)}%
          </span>
          <button
            onClick={zoomImageIn}
            className="p-1.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
            title="확대"
          >
            <ZoomIn size={16} />
          </button>
          <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 8px' }} />
          <button
            onClick={rotateImageCounterClockwise}
            className="p-1.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
            title="반시계 방향 회전"
          >
            <ArrowCounterclockwise size={16} />
          </button>
          <button
            onClick={rotateImageClockwise}
            className="p-1.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
            title="시계 방향 회전"
          >
            <ArrowClockwise size={16} />
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-300 min-w-[40px] text-center">
            {imageRotation}°
          </span>
          <div className="w-px h-5 bg-gray-300 dark:bg-gray-500 mx-2" />
          <button
            onClick={resetImageZoom}
            className="p-1.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
            title="줌 초기화"
          >
            <ArrowRepeat size={16} />
          </button>
          <button
            onClick={resetImageRotation}
            className="p-1.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
            title="회전 초기화"
          >
            <ArrowRepeat size={16} />
          </button>
          <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 8px' }} />
          <button
            onClick={downloadImage}
            className="p-1.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
            title="다운로드"
          >
            <Download size={16} />
          </button>
          <button
            onClick={toggleImageFullscreen}
            className="p-1.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
            title={imageFullscreen ? '전체화면 종료' : '전체화면'}
          >
            {imageFullscreen ? <FullscreenExit size={16} /> : <Fullscreen size={16} />}
          </button>
      </ModalToolbar>

      <div className="flex-1 overflow-hidden flex items-center justify-center relative">
        <img
          src={URL.createObjectURL(new Blob([image.data], { type: image.type }))}
          alt={image.name}
          className={`max-w-full max-h-full ${imageZoom > 1 ? 'cursor-grab' : 'cursor-default'} select-none relative`}
          style={{
            transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
            transformOrigin: 'center',
            left: imagePosition.x,
            top: imagePosition.y
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          draggable={false}
        />
      </div>
    </Modal>
  );
};

export default ImageViewer;