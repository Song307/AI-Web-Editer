import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as fabric from 'fabric';
import {
  Palette, Type, Square, Circle, Image as ImageIcon,
  Scissors, ArrowRepeat, GripHorizontal, GripVertical, ArrowsMove,
  ZoomIn, ZoomOut, ArrowCounterclockwise, ArrowClockwise, Save, Upload, Download,
  Trash2, Copy, Eye, EyeSlash
} from 'react-bootstrap-icons';
import { useCanvas } from '../hooks/useCanvas';
import { useImageFilters, ImageFilters } from '../hooks/useImageFilters';
import {
  addImageToCanvas,
  addTextToCanvas,
  addShapeToCanvas,
  cropImage,
  exportCanvas,
  loadImageFromFile,
  moveObjectLayer,
  zoomCanvas
} from '../utils/canvasUtils';
import { saveEditedImage, getAllEditedImages, EditedImageFile } from '../utils/db';
import toast from 'react-hot-toast';

interface ImageEditorProps {
  initialImage?: EditedImageFile;
  onSave?: (imageData: string, filename: string) => void;
  onClose?: () => void;
}

const ImageEditor: React.FC<ImageEditorProps> = ({
  initialImage,
  onSave,
  onClose
}) => {
  // 상태 관리
  const [selectedTool, setSelectedTool] = useState<string>('select');
  const [isCropping, setIsCropping] = useState(false);
  const [cropRect, setCropRect] = useState<any>(null);
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [showProperties, setShowProperties] = useState(false);

  // 커스텀 훅 사용
  const { canvasRef, canvas, isReady, undo, redo, canUndo, canRedo, clearCanvas } = useCanvas({
    width: 800,
    height: 600,
    backgroundColor: '#f8f9fa'
  });

  const { filters, applyFilters, updateFilter, resetFilters, hasActiveFilters } = useImageFilters();

  // 파일 입력 ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 초기 이미지 로드
  useEffect(() => {
    if (isReady && initialImage && canvas) {
      addImageToCanvas(canvas, initialImage.content).catch(console.error);
    }
  }, [isReady, initialImage, canvas]);

  // 캔버스 이벤트 리스너
  useEffect(() => {
    if (!canvas) return;

    // 오브젝트 선택 이벤트
    const handleSelection = (e: any) => {
      setSelectedObject(e.selected?.[0] || null);
      setShowProperties(!!e.selected?.[0]);
    };

    // 오브젝트 선택 해제 이벤트
    const handleSelectionCleared = () => {
      setSelectedObject(null);
      setShowProperties(false);
    };

    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', handleSelectionCleared);

    return () => {
      canvas.off('selection:created', handleSelection);
      canvas.off('selection:updated', handleSelection);
      canvas.off('selection:cleared', handleSelectionCleared);
    };
  }, [canvas]);

  // 도구 선택 핸들러
  const handleToolSelect = useCallback((tool: string) => {
    setSelectedTool(tool);

    if (!canvas) return;

    // 기존 선택 해제
    canvas.discardActiveObject();

    switch (tool) {
      case 'select':
        canvas.selection = true;
        canvas.forEachObject((obj: any) => obj.selectable = true);
        break;
      case 'crop':
        setIsCropping(true);
        canvas.selection = false;
        canvas.forEachObject((obj: any) => obj.selectable = false);
        break;
      default:
        canvas.selection = false;
        canvas.forEachObject((obj: any) => obj.selectable = false);
    }

    canvas.renderAll();
  }, [canvas]);

  // 이미지 업로드 핸들러
  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !canvas) return;

    try {
      const imageUrl = await loadImageFromFile(file);
      await addImageToCanvas(canvas, imageUrl);
      toast.success('이미지가 추가되었습니다.');
    } catch (error) {
      toast.error('이미지 업로드에 실패했습니다.');
    }
  }, [canvas]);

  // 텍스트 추가 핸들러
  const handleAddText = useCallback(() => {
    if (!canvas) return;
    addTextToCanvas(canvas);
    setSelectedTool('select');
    canvas.selection = true;
    canvas.forEachObject((obj: any) => obj.selectable = true);
  }, [canvas]);

  // 도형 추가 핸들러
  const handleAddShape = useCallback((shapeType: 'rectangle' | 'circle') => {
    if (!canvas) return;
    addShapeToCanvas(canvas, shapeType);
    setSelectedTool('select');
    canvas.selection = true;
    canvas.forEachObject((obj: any) => obj.selectable = true);
  }, [canvas]);

  // 자르기 핸들러
  const handleCrop = useCallback(() => {
    if (!canvas || !cropRect) return;

    const activeObject = canvas.getActiveObject();
    if (activeObject && activeObject.type === 'image') {
      const bounds = cropRect.getBoundingRect();
      cropImage(canvas, activeObject as any, bounds);
      canvas.remove(cropRect);
      setCropRect(null);
      setIsCropping(false);
      setSelectedTool('select');
      canvas.selection = true;
      canvas.forEachObject((obj: any) => obj.selectable = true);
      toast.success('이미지가 잘렸습니다.');
    }
  }, [canvas, cropRect]);

  // 회전 핸들러
  const handleRotate = useCallback(() => {
    if (!canvas || !selectedObject) return;
    selectedObject.rotate((selectedObject.angle || 0) + 90);
    canvas.renderAll();
  }, [canvas, selectedObject]);

  // 반전 핸들러
  const handleFlip = useCallback((direction: 'horizontal' | 'vertical') => {
    if (!canvas || !selectedObject) return;
    if (direction === 'horizontal') {
      selectedObject.flipX = !selectedObject.flipX;
    } else {
      selectedObject.flipY = !selectedObject.flipY;
    }
    canvas.renderAll();
  }, [canvas, selectedObject]);

  // 레이어 이동 핸들러
  const handleMoveLayer = useCallback((direction: 'up' | 'down' | 'top' | 'bottom') => {
    if (!canvas || !selectedObject) return;
    moveObjectLayer(canvas, selectedObject, direction);
  }, [canvas, selectedObject]);

  // 줌 핸들러
  const handleZoom = useCallback((zoomType: 'in' | 'out' | 'fit' | 'reset') => {
    if (!canvas) return;
    zoomCanvas(canvas, zoomType);
  }, [canvas]);

  // 내보내기 핸들러
  const handleExport = useCallback((format: 'png' | 'jpeg' | 'webp') => {
    if (!canvas) return;

    const dataUrl = exportCanvas(canvas, format);
    const link = document.createElement('a');
    link.download = `edited-image.${format}`;
    link.href = dataUrl;
    link.click();

    toast.success(`${format.toUpperCase()} 파일로 내보내기 완료!`);
  }, [canvas]);

  // 저장 핸들러
  const handleSave = useCallback(async () => {
    if (!canvas) return;

    try {
      const dataUrl = exportCanvas(canvas, 'png');
      const filename = `edited-image-${Date.now()}.png`;

      // IndexedDB에 저장
      await saveEditedImage({
        id: Date.now().toString(),
        name: filename,
        content: dataUrl,
        folder: 'edited',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      onSave?.(dataUrl, filename);
      toast.success('이미지가 저장되었습니다.');
    } catch (error) {
      toast.error('저장에 실패했습니다.');
    }
  }, [canvas, onSave]);

  // 필터 적용 핸들러
  const handleApplyFilters = useCallback(() => {
    if (!canvas || !selectedObject || selectedObject.type !== 'image') return;
    applyFilters(selectedObject as any);
  }, [canvas, selectedObject, applyFilters]);

  // 마우스 휠 줌 이벤트
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!canvas) return;
    e.preventDefault();
    const zoomType = e.deltaY > 0 ? 'out' : 'in';
    zoomCanvas(canvas, zoomType);
  }, [canvas]);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* 좌측 툴바 */}
      <div className="w-16 bg-white shadow-lg flex flex-col items-center py-4 space-y-2">
        {/* 선택 도구 */}
        <button
          onClick={() => handleToolSelect('select')}
          className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
            selectedTool === 'select' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'
          }`}
          title="선택"
        >
          <ArrowsMove size={20} />
        </button>

        {/* 자르기 도구 */}
        <button
          onClick={() => handleToolSelect('crop')}
          className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
            selectedTool === 'crop' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'
          }`}
          title="자르기"
        >
          <Scissors size={20} />
        </button>

        {/* 텍스트 추가 */}
        <button
          onClick={handleAddText}
          className="w-12 h-12 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
          title="텍스트 추가"
        >
          <Type size={20} />
        </button>

        {/* 사각형 추가 */}
        <button
          onClick={() => handleAddShape('rectangle')}
          className="w-12 h-12 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
          title="사각형 추가"
        >
          <Square size={20} />
        </button>

        {/* 원 추가 */}
        <button
          onClick={() => handleAddShape('circle')}
          className="w-12 h-12 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
          title="원 추가"
        >
          <Circle size={20} />
        </button>

        {/* 이미지 추가 */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-12 h-12 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
          title="이미지 추가"
        >
          <ImageIcon size={20} />
        </button>

        {/* 속성 패널 토글 */}
        <button
          onClick={() => setShowProperties(!showProperties)}
          className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
            showProperties ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'
          }`}
          title="속성 패널"
        >
          <Palette size={20} />
        </button>
      </div>

      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col">
        {/* 상단 바 */}
        <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            {/* Undo/Redo */}
            <button
              onClick={undo}
              disabled={!canUndo}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="실행 취소"
            >
              <ArrowCounterclockwise size={18} />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="다시 실행"
            >
              <ArrowClockwise size={18} />
            </button>

            {/* 구분선 */}
            <div className="w-px h-6 bg-gray-300 mx-2" />

            {/* 회전 */}
            <button
              onClick={handleRotate}
              disabled={!selectedObject}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="회전"
            >
              <ArrowRepeat size={18} />
            </button>

            {/* 반전 */}
            <button
              onClick={() => handleFlip('horizontal')}
              disabled={!selectedObject}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="좌우 반전"
            >
              <GripHorizontal size={18} />
            </button>
            <button
              onClick={() => handleFlip('vertical')}
              disabled={!selectedObject}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="상하 반전"
            >
              <GripVertical size={18} />
            </button>

            {/* 구분선 */}
            <div className="w-px h-6 bg-gray-300 mx-2" />

            {/* 레이어 이동 */}
            <button
              onClick={() => handleMoveLayer('up')}
              disabled={!selectedObject}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="맨 앞으로"
            >
              <Eye size={18} />
            </button>
            <button
              onClick={() => handleMoveLayer('down')}
              disabled={!selectedObject}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="맨 뒤로"
            >
              <EyeSlash size={18} />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {/* 줌 컨트롤 */}
            <button
              onClick={() => handleZoom('out')}
              className="p-2 rounded hover:bg-gray-100"
              title="축소"
            >
              <ZoomOut size={18} />
            </button>
            <button
              onClick={() => handleZoom('fit')}
              className="p-2 rounded hover:bg-gray-100"
              title="화면 맞춤"
            >
              <ArrowsMove size={18} />
            </button>
            <button
              onClick={() => handleZoom('in')}
              className="p-2 rounded hover:bg-gray-100"
              title="확대"
            >
              <ZoomIn size={18} />
            </button>

            {/* 구분선 */}
            <div className="w-px h-6 bg-gray-300 mx-2" />

            {/* 내보내기 */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => handleExport('png')}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                title="PNG로 내보내기"
              >
                PNG
              </button>
              <button
                onClick={() => handleExport('jpeg')}
                className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                title="JPEG로 내보내기"
              >
                JPEG
              </button>
              <button
                onClick={() => handleExport('webp')}
                className="px-3 py-1 text-sm bg-purple-500 text-white rounded hover:bg-purple-600"
                title="WebP로 내보내기"
              >
                WebP
              </button>
            </div>

            {/* 저장 */}
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center space-x-1"
              title="저장"
            >
              <Save size={16} />
              <span>저장</span>
            </button>
          </div>
        </div>

        {/* 캔버스 영역 */}
        <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
          <div className="relative">
            <canvas
              ref={canvasRef}
              onWheel={handleWheel}
              className="border border-gray-300 shadow-lg"
              style={{ maxWidth: '100%', maxHeight: '100%' }}
            />

            {/* 자르기 모드 오버레이 */}
            {isCropping && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <div className="bg-white p-4 rounded-lg shadow-lg">
                  <p className="text-sm mb-3">자르고 싶은 영역을 드래그하세요</p>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleCrop}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      자르기
                    </button>
                    <button
                      onClick={() => {
                        setIsCropping(false);
                        setSelectedTool('select');
                        if (canvas) {
                          canvas.selection = true;
                          canvas.forEachObject((obj: any) => obj.selectable = true);
                          if (cropRect) {
                            canvas.remove(cropRect);
                            setCropRect(null);
                          }
                        }
                      }}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                      취소
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 우측 속성 패널 */}
      {showProperties && (
        <div className="w-80 bg-white shadow-lg border-l border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">속성</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* 오브젝트 속성 */}
            {selectedObject && (
              <div>
                <h4 className="text-sm font-semibold mb-3">오브젝트 속성</h4>
                <div className="space-y-3">
                  {/* 위치 */}
                  <div>
                    <label className="block text-sm font-medium mb-1">위치</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={Math.round(selectedObject.left || 0)}
                        onChange={(e) => {
                          selectedObject.set('left', parseInt(e.target.value));
                          canvas?.renderAll();
                        }}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="X"
                      />
                      <input
                        type="number"
                        value={Math.round(selectedObject.top || 0)}
                        onChange={(e) => {
                          selectedObject.set('top', parseInt(e.target.value));
                          canvas?.renderAll();
                        }}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="Y"
                      />
                    </div>
                  </div>

                  {/* 크기 */}
                  <div>
                    <label className="block text-sm font-medium mb-1">크기</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={Math.round((selectedObject.width || 0) * (selectedObject.scaleX || 1))}
                        onChange={(e) => {
                          const scale = parseInt(e.target.value) / (selectedObject.width || 1);
                          selectedObject.set('scaleX', scale);
                          canvas?.renderAll();
                        }}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="너비"
                      />
                      <input
                        type="number"
                        value={Math.round((selectedObject.height || 0) * (selectedObject.scaleY || 1))}
                        onChange={(e) => {
                          const scale = parseInt(e.target.value) / (selectedObject.height || 1);
                          selectedObject.set('scaleY', scale);
                          canvas?.renderAll();
                        }}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="높이"
                      />
                    </div>
                  </div>

                  {/* 회전 */}
                  <div>
                    <label className="block text-sm font-medium mb-1">회전</label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={selectedObject.angle || 0}
                      onChange={(e) => {
                        selectedObject.set('angle', parseInt(e.target.value));
                        canvas?.renderAll();
                      }}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-500 mt-1">{Math.round(selectedObject.angle || 0)}°</div>
                  </div>

                  {/* 투명도 */}
                  <div>
                    <label className="block text-sm font-medium mb-1">투명도</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={selectedObject.opacity || 1}
                      onChange={(e) => {
                        selectedObject.set('opacity', parseFloat(e.target.value));
                        canvas?.renderAll();
                      }}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-500 mt-1">{Math.round((selectedObject.opacity || 1) * 100)}%</div>
                  </div>

                  {/* 색상 (도형인 경우) */}
                  {selectedObject.fill && typeof selectedObject.fill === 'string' && (
                    <div>
                      <label className="block text-sm font-medium mb-1">색상</label>
                      <input
                        type="color"
                        value={selectedObject.fill}
                        onChange={(e) => {
                          selectedObject.set('fill', e.target.value);
                          canvas?.renderAll();
                        }}
                        className="w-full h-8 border border-gray-300 rounded"
                      />
                    </div>
                  )}

                  {/* 텍스트 속성 (텍스트인 경우) */}
                  {selectedObject.type === 'i-text' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-1">폰트 크기</label>
                        <input
                          type="number"
                          value={(selectedObject as any).fontSize || 24}
                          onChange={(e) => {
                            (selectedObject as any).set('fontSize', parseInt(e.target.value));
                            canvas?.renderAll();
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          min="8"
                          max="100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">텍스트 색상</label>
                        <input
                          type="color"
                          value={(selectedObject as any).fill as string || '#000000'}
                          onChange={(e) => {
                            (selectedObject as any).set('fill', e.target.value);
                            canvas?.renderAll();
                          }}
                          className="w-full h-8 border border-gray-300 rounded"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* 이미지 필터 (이미지가 선택된 경우) */}
            {selectedObject && selectedObject.type === 'image' && (
              <div>
                <h4 className="text-sm font-semibold mb-3">이미지 필터</h4>
                <div className="space-y-3">
                  {/* 밝기 */}
                  <div>
                    <label className="block text-sm font-medium mb-1">밝기</label>
                    <input
                      type="range"
                      min="-1"
                      max="1"
                      step="0.1"
                      value={filters.brightness}
                      onChange={(e) => updateFilter('brightness', parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-500 mt-1">{filters.brightness.toFixed(1)}</div>
                  </div>

                  {/* 대비 */}
                  <div>
                    <label className="block text-sm font-medium mb-1">대비</label>
                    <input
                      type="range"
                      min="-1"
                      max="1"
                      step="0.1"
                      value={filters.contrast}
                      onChange={(e) => updateFilter('contrast', parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-500 mt-1">{filters.contrast.toFixed(1)}</div>
                  </div>

                  {/* 채도 */}
                  <div>
                    <label className="block text-sm font-medium mb-1">채도</label>
                    <input
                      type="range"
                      min="-1"
                      max="1"
                      step="0.1"
                      value={filters.saturation}
                      onChange={(e) => updateFilter('saturation', parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-500 mt-1">{filters.saturation.toFixed(1)}</div>
                  </div>

                  {/* 세피아 */}
                  <div>
                    <label className="block text-sm font-medium mb-1">세피아</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={filters.sepia}
                      onChange={(e) => updateFilter('sepia', parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-500 mt-1">{filters.sepia.toFixed(1)}</div>
                  </div>

                  {/* 흑백 */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="grayscale"
                      checked={filters.grayscale}
                      onChange={(e) => updateFilter('grayscale', e.target.checked)}
                      className="mr-2"
                    />
                    <label htmlFor="grayscale" className="text-sm font-medium">흑백</label>
                  </div>

                  {/* 블러 */}
                  <div>
                    <label className="block text-sm font-medium mb-1">블러</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={filters.blur}
                      onChange={(e) => updateFilter('blur', parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-500 mt-1">{filters.blur.toFixed(1)}</div>
                  </div>

                  {/* 샤프닝 */}
                  <div>
                    <label className="block text-sm font-medium mb-1">샤프닝</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={filters.sharpen}
                      onChange={(e) => updateFilter('sharpen', parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <div className="text-xs text-gray-500 mt-1">{filters.sharpen.toFixed(1)}</div>
                  </div>

                  {/* 필터 적용 버튼 */}
                  <button
                    onClick={handleApplyFilters}
                    className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                  >
                    필터 적용
                  </button>

                  {/* 필터 초기화 */}
                  <button
                    onClick={() => {
                      resetFilters();
                      if (selectedObject && selectedObject.type === 'image') {
                        (selectedObject as any).filters = [];
                        canvas?.renderAll();
                      }
                    }}
                    className="w-full py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
                  >
                    필터 초기화
                  </button>
                </div>
              </div>
            )}

            {/* 선택된 오브젝트가 없을 때 */}
            {!selectedObject && (
              <div className="text-center text-gray-500 py-8">
                <Palette size={48} className="mx-auto mb-4 opacity-50" />
                <p>오브젝트를 선택하면 속성을 편집할 수 있습니다.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 숨겨진 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
    </div>
  );
};

export default ImageEditor;
