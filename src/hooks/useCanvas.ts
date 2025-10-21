import { useState, useRef, useEffect, useCallback } from 'react';
import { fabric } from 'fabric';

interface UseCanvasOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
}

interface UseCanvasReturn {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  canvas: fabric.Canvas | null;
  isReady: boolean;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearCanvas: () => void;
}

export const useCanvas = (options: UseCanvasOptions = {}): UseCanvasReturn => {
  const { width = 800, height = 600, backgroundColor = '#ffffff' } = options;
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
  // useRef로 history 관리 (클로저 문제 해결)
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);

  // 캔버스 초기화
  useEffect(() => {
    if (!canvasRef.current) return;

    const fabricCanvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor,
      selection: true,
      preserveObjectStacking: true,
    });

    // 히스토리 초기화
    const initialState = JSON.stringify(fabricCanvas.toJSON());
    historyRef.current = [initialState];
    historyIndexRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);

    setCanvas(fabricCanvas);
    setIsReady(true);

    // 캔버스 변경 이벤트 리스너
    const handleCanvasChange = () => {
      if (!fabricCanvas) return;
      
      const currentState = JSON.stringify(fabricCanvas.toJSON());
      const currentHistory = historyRef.current;
      const currentIndex = historyIndexRef.current;
      
      const newHistory = currentHistory.slice(0, currentIndex + 1);
      newHistory.push(currentState);
      
      if (newHistory.length > 50) { // 최대 50개의 히스토리 유지
        newHistory.shift();
      }
      
      historyRef.current = newHistory;
      historyIndexRef.current = newHistory.length - 1;
      setCanUndo(newHistory.length > 1);
      setCanRedo(false);
    };

    fabricCanvas.on('object:added', handleCanvasChange);
    fabricCanvas.on('object:removed', handleCanvasChange);
    fabricCanvas.on('object:modified', handleCanvasChange);

    return () => {
      fabricCanvas.dispose();
    };
  }, [width, height, backgroundColor]);

  // 실행 취소
  const undo = useCallback(() => {
    if (!canvas || historyIndexRef.current <= 0) return;

    const previousState = historyRef.current[historyIndexRef.current - 1];
    canvas.loadFromJSON(previousState, () => {
      canvas.renderAll();
      historyIndexRef.current = historyIndexRef.current - 1;
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(true);
    });
  }, [canvas]);

  // 다시 실행
  const redo = useCallback(() => {
    if (!canvas || historyIndexRef.current >= historyRef.current.length - 1) return;

    const nextState = historyRef.current[historyIndexRef.current + 1];
    canvas.loadFromJSON(nextState, () => {
      canvas.renderAll();
      historyIndexRef.current = historyIndexRef.current + 1;
      setCanUndo(true);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    });
  }, [canvas]);

  // 캔버스 클리어
  const clearCanvas = useCallback(() => {
    if (!canvas) return;
    
    canvas.clear();
    canvas.setBackgroundColor(backgroundColor, () => {
      canvas.renderAll();
    });
    
    // 히스토리 초기화
    const initialState = JSON.stringify(canvas.toJSON());
    historyRef.current = [initialState];
    historyIndexRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
  }, [canvas, backgroundColor]);

  const result: UseCanvasReturn = {
    canvasRef: canvasRef as unknown as React.RefObject<HTMLCanvasElement>,
    canvas,
    isReady,
    undo,
    redo,
    canUndo,
    canRedo,
    clearCanvas,
  };

  return result;
};
