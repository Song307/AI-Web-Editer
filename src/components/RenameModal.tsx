import React, { useEffect } from 'react';

interface RenameModalProps {
  title?: string;
  label?: string;
  placeholder?: string;
  value: string;
  confirmText?: string;
  cancelText?: string;
  isOpen: boolean;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const RenameModal: React.FC<RenameModalProps> = ({
  title = '이름 변경',
  label = '새 이름',
  placeholder = '이름을 입력하세요',
  value,
  confirmText = '확인',
  cancelText = '취소',
  isOpen,
  onChange,
  onConfirm,
  onCancel,
}) => {
  // ESC 키와 Enter 키 이벤트 처리
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        onConfirm();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="m-0 mb-3 text-gray-900 dark:text-gray-100 text-lg font-semibold">{title}</h3>
        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">{label}</label>
          <input
            type="text"
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white border-none rounded-md cursor-pointer transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RenameModal;


