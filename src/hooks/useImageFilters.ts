import { useState, useCallback } from 'react';
import { fabric } from 'fabric';

export interface ImageFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  sepia: number;
  grayscale: boolean;
  blur: number;
  sharpen: number;
}

interface UseImageFiltersReturn {
  filters: ImageFilters;
  applyFilters: (image: fabric.Image) => void;
  updateFilter: (key: keyof ImageFilters, value: number | boolean) => void;
  resetFilters: () => void;
  hasActiveFilters: boolean;
}

const defaultFilters: ImageFilters = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sepia: 0,
  grayscale: false,
  blur: 0,
  sharpen: 0,
};

export const useImageFilters = (): UseImageFiltersReturn => {
  const [filters, setFilters] = useState<ImageFilters>(defaultFilters);

  // 필터 적용
  const applyFilters = useCallback((image: fabric.Image) => {
    const fabricFilters: fabric.IBaseFilter[] = [];

    // 밝기 필터
    if (filters.brightness !== 0) {
      fabricFilters.push(new fabric.Image.filters.Brightness({
        brightness: filters.brightness
      }));
    }

    // 대비 필터
    if (filters.contrast !== 0) {
      fabricFilters.push(new fabric.Image.filters.Contrast({
        contrast: filters.contrast
      }));
    }

    // 채도 필터
    if (filters.saturation !== 0) {
      fabricFilters.push(new fabric.Image.filters.Saturation({
        saturation: filters.saturation
      }));
    }

    // 세피아 필터
    if (filters.sepia > 0) {
      fabricFilters.push(new fabric.Image.filters.Sepia());
    }

    // 흑백 필터
    if (filters.grayscale) {
      fabricFilters.push(new fabric.Image.filters.Grayscale());
    }

    // 블러 필터
    if (filters.blur > 0) {
      fabricFilters.push(new fabric.Image.filters.Blur({
        blur: filters.blur
      }));
    }

    // 샤프닝 필터 (커스텀 구현)
    if (filters.sharpen > 0) {
      fabricFilters.push(new fabric.Image.filters.Convolute({
        matrix: [
          0, -filters.sharpen, 0,
          -filters.sharpen, 1 + 4 * filters.sharpen, -filters.sharpen,
          0, -filters.sharpen, 0
        ]
      }));
    }

    image.filters = fabricFilters;
    image.applyFilters();
    image.canvas?.renderAll();
  }, [filters]);

  // 필터 업데이트
  const updateFilter = useCallback((key: keyof ImageFilters, value: number | boolean) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  // 필터 초기화
  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  // 활성 필터 확인
  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'grayscale') {
      return value === true;
    }
    return value !== 0;
  });

  return {
    filters,
    applyFilters,
    updateFilter,
    resetFilters,
    hasActiveFilters,
  };
};
