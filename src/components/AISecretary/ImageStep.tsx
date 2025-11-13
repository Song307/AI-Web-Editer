import React, { useRef } from 'react';
import { ImageStepProps } from './types';
import { Upload, X } from 'react-bootstrap-icons';

const ImageStep: React.FC<ImageStepProps> = ({
  imageUrl,
  setImageUrl,
  onNext,
  onPrev,
  imageMode,
  setImageMode
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 미리 제공된 아바타 목록
  const availableAvatars = [
    { id: 'avatar1', src: '/images/Avatar/avatar1.svg', name: '기본 아바타 1' },
    { id: 'avatar2', src: '/images/Avatar/avatar2.svg', name: '기본 아바타 2' },
    { id: 'avatar3', src: '/images/Avatar/avatar3.svg', name: '기본 아바타 3' },
    { id: 'avatar4', src: '/images/Avatar/avatar4.svg', name: '기본 아바타 4' },
    { id: 'avatar5', src: '/images/Avatar/avatar5.svg', name: '기본 아바타 5' }
  ];

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setImageUrl(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAvatarSelect = (avatarSrc: string) => {
    setImageUrl(avatarSrc);
  };

  return (
    <div className="space-y-4">
      {/* Mode Selection Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setImageMode('avatar')}
          className={`flex-1 px-3 py-2 rounded-lg transition-all text-sm ${
            imageMode === 'avatar'
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          👤 아바타
        </button>
        <button
          onClick={() => setImageMode('upload')}
          className={`flex-1 px-3 py-2 rounded-lg transition-all text-sm ${
            imageMode === 'upload'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          📁 업로드
        </button>
      </div>

      {/* Avatar Selection Mode */}
      {imageMode === 'avatar' && (
        <div className="grid grid-cols-5 gap-2">
          {availableAvatars.map((avatar) => (
            <button
              key={avatar.id}
              onClick={() => handleAvatarSelect(avatar.src)}
              className={`relative p-2 rounded-lg border-2 transition-all ${
                imageUrl === avatar.src
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-green-300'
              }`}
            >
              <img
                src={avatar.src}
                alt={avatar.name}
                className="w-full h-auto"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/images/Avatar/avatar1.svg';
                }}
              />
              {imageUrl === avatar.src && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">
                  ✓
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Upload Mode */}
      {imageMode === 'upload' && (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          
          {imageUrl && !imageUrl.startsWith('/images/') ? (
            <div className="relative">
              <img
                src={imageUrl}
                alt="업로드된 이미지"
                className="w-32 h-32 rounded-lg object-cover mx-auto border-2 border-gray-200 dark:border-gray-600"
              />
              <button
                onClick={handleRemoveImage}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors flex items-center justify-center text-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 transition-all"
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400">이미지 업로드</p>
            </button>
          )}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={onPrev}
          className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-all text-sm"
        >
          ← 이전
        </button>
        <button
          onClick={onNext}
          className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white rounded-lg font-medium transition-all text-sm"
        >
          다음 →
        </button>
      </div>
    </div>
  );
};

export default ImageStep;