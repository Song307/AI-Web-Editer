import React from 'react';
import { X } from 'react-bootstrap-icons';

interface ModalHeaderProps {
  fileName: string;
  onClose?: () => void;
  showCloseButton?: boolean;
}

const ModalHeader: React.FC<ModalHeaderProps> = ({ fileName, onClose, showCloseButton = true }) => {
  return (
    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white m-0">
        {fileName}
      </h3>
      {showCloseButton && (
        <button
          onClick={onClose}
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md transition-colors"
          title="닫기"
        >
          <X size={20} />
        </button>
      )}
    </div>
  );
};

export default ModalHeader;