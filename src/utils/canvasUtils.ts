import { fabric } from 'fabric';

// 이미지 캔버스에 추가
export const addImageToCanvas = async (canvas: fabric.Canvas, imageSource: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    fabric.Image.fromURL(imageSource, (img) => {
      if (!img) {
        reject(new Error('Failed to load image'));
        return;
      }

      // 이미지 크기 조정 (캔버스에 맞게)
      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();
      const imgAspect = img.width! / img.height!;
      const canvasAspect = canvasWidth / canvasHeight;

      if (imgAspect > canvasAspect) {
        // 이미지가 더 넓은 경우
        img.scaleToWidth(canvasWidth * 0.8);
      } else {
        // 이미지가 더 높은 경우
        img.scaleToHeight(canvasHeight * 0.8);
      }

      // 캔버스 중앙에 배치
      img.set({
        left: (canvasWidth - img.getScaledWidth()) / 2,
        top: (canvasHeight - img.getScaledHeight()) / 2,
        selectable: true,
        hasControls: true,
        hasBorders: true,
      });

      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      resolve();
    }, {
      crossOrigin: 'anonymous'
    });
  });
};

// 텍스트 캔버스에 추가
export const addTextToCanvas = (canvas: fabric.Canvas): void => {
  const text = new fabric.IText('텍스트를 입력하세요', {
    left: canvas.getWidth() / 2 - 100,
    top: canvas.getHeight() / 2 - 20,
    width: 200,
    fontSize: 24,
    fill: '#000000',
    fontFamily: 'Arial',
    selectable: true,
    hasControls: true,
    hasBorders: true,
  });

  canvas.add(text);
  canvas.setActiveObject(text);
  canvas.renderAll();
};

// 도형 캔버스에 추가
export const addShapeToCanvas = (canvas: fabric.Canvas, shapeType: 'rectangle' | 'circle'): void => {
  let shape: fabric.Object;

  if (shapeType === 'rectangle') {
    shape = new fabric.Rect({
      left: canvas.getWidth() / 2 - 50,
      top: canvas.getHeight() / 2 - 50,
      width: 100,
      height: 100,
      fill: '#007bff',
      stroke: '#0056b3',
      strokeWidth: 2,
      selectable: true,
      hasControls: true,
      hasBorders: true,
    });
  } else {
    shape = new fabric.Circle({
      left: canvas.getWidth() / 2 - 50,
      top: canvas.getHeight() / 2 - 50,
      radius: 50,
      fill: '#28a745',
      stroke: '#1e7e34',
      strokeWidth: 2,
      selectable: true,
      hasControls: true,
      hasBorders: true,
    });
  }

  canvas.add(shape);
  canvas.setActiveObject(shape);
  canvas.renderAll();
};

// 이미지 자르기
export const cropImage = (
  canvas: fabric.Canvas,
  image: fabric.Image,
  cropBounds: { left: number; top: number; width: number; height: number }
): void => {
  const imgElement = image.getElement() as HTMLImageElement;
  const canvasElement = document.createElement('canvas');
  const ctx = canvasElement.getContext('2d');

  if (!ctx) return;

  canvasElement.width = cropBounds.width;
  canvasElement.height = cropBounds.height;

  // 원본 이미지에서 지정된 영역을 잘라내기
  ctx.drawImage(
    imgElement,
    cropBounds.left, cropBounds.top, cropBounds.width, cropBounds.height,
    0, 0, cropBounds.width, cropBounds.height
  );

  // 잘라낸 이미지를 데이터 URL로 변환
  const croppedDataUrl = canvasElement.toDataURL();

  // 새로운 이미지 오브젝트 생성
  fabric.Image.fromURL(croppedDataUrl, (croppedImg) => {
    if (!croppedImg) return;

    // 기존 이미지 위치에 새 이미지 배치
    croppedImg.set({
      left: image.left,
      top: image.top,
      scaleX: 1,
      scaleY: 1,
      selectable: true,
      hasControls: true,
      hasBorders: true,
    });

    // 기존 이미지 제거 및 새 이미지 추가
    canvas.remove(image);
    canvas.add(croppedImg);
    canvas.setActiveObject(croppedImg);
    canvas.renderAll();
  });
};

// 캔버스 내보내기
export const exportCanvas = (canvas: fabric.Canvas, format: 'png' | 'jpeg' | 'webp' = 'png'): string => {
  return canvas.toDataURL({
    format,
    quality: format === 'jpeg' ? 0.8 : 1,
    multiplier: 1,
  });
};

// 파일에서 이미지 로드
export const loadImageFromFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(new Error('File reading error'));
    reader.readAsDataURL(file);
  });
};

// 오브젝트 레이어 이동
export const moveObjectLayer = (
  canvas: fabric.Canvas,
  object: fabric.Object,
  direction: 'up' | 'down' | 'top' | 'bottom'
): void => {
  switch (direction) {
    case 'up':
      canvas.bringForward(object);
      break;
    case 'down':
      canvas.sendBackwards(object);
      break;
    case 'top':
      canvas.bringToFront(object);
      break;
    case 'bottom':
      canvas.sendToBack(object);
      break;
  }
  canvas.renderAll();
};

// 캔버스 줌
export const zoomCanvas = (
  canvas: fabric.Canvas,
  zoomType: 'in' | 'out' | 'fit' | 'reset' | 'set',
  value?: number
): void => {
  const currentZoom = canvas.getZoom();
  let newZoom = currentZoom;

  switch (zoomType) {
    case 'in':
      newZoom = Math.min(currentZoom * 1.2, 3); // 최대 300%
      break;
    case 'out':
      newZoom = Math.max(currentZoom / 1.2, 0.1); // 최소 10%
      break;
    case 'fit':
      // 캔버스 컨테이너에 맞게 조정
      const container = canvas.getElement()?.parentElement;
      if (container) {
        const containerWidth = container.clientWidth - 40; // 패딩 고려
        const containerHeight = container.clientHeight - 40;
        const canvasWidth = canvas.getWidth();
        const canvasHeight = canvas.getHeight();

        const scaleX = containerWidth / canvasWidth;
        const scaleY = containerHeight / canvasHeight;
        newZoom = Math.min(scaleX, scaleY, 1); // 컨테이너에 맞게 또는 100% 중 작은 값
      }
      break;
    case 'reset':
      newZoom = 1;
      break;
    case 'set':
      newZoom = value || 1;
      break;
  }

  const clampedZoom = Math.max(0.1, Math.min(3, newZoom)); // 10% ~ 300%
  canvas.setZoom(clampedZoom);
  canvas.renderAll();
};

// 캔버스 줌 설정 (특정 값으로)
export const setCanvasZoom = (canvas: fabric.Canvas, zoom: number): void => {
  const clampedZoom = Math.max(0.1, Math.min(3, zoom)); // 10% ~ 300%
  canvas.setZoom(clampedZoom);
  canvas.renderAll();
};

// 캔버스 팬 (이동)
export const panCanvas = (canvas: fabric.Canvas, deltaX: number, deltaY: number): void => {
  const vpt = canvas.viewportTransform;
  if (vpt) {
    vpt[4] += deltaX;
    vpt[5] += deltaY;
    canvas.requestRenderAll();
  }
};

// 캔버스 팬 리셋 (중앙으로)
export const resetCanvasPan = (canvas: fabric.Canvas): void => {
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  canvas.requestRenderAll();
};
