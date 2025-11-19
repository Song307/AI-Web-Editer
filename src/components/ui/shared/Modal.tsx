import React, { forwardRef } from 'react';

interface ModalProps {
  children: React.ReactNode;
  onClose?: () => void;
  size?: 'small' | 'medium' | 'large';
  transparent?: boolean;
  fullscreen?: boolean;
}

const Modal = forwardRef<HTMLDivElement, ModalProps>(({ children, onClose, size = 'large', transparent = false, fullscreen = false }, ref) => {
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { maxWidth: '60vw', maxHeight: '60vh' };
      case 'medium':
        return { maxWidth: '80vw', maxHeight: '80vh' };
      case 'large':
      default:
        return { maxWidth: '90vw', maxHeight: '90vh' };
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center z-50 ${
        fullscreen ? 'bg-transparent' : transparent ? 'bg-transparent' : 'bg-black bg-opacity-80'
      }`}
      onClick={handleBackdropClick}
    >
      <div
        ref={ref}
        className={`relative flex flex-col overflow-hidden rounded-lg ${
          fullscreen 
            ? 'w-screen h-screen bg-transparent' 
            : size === 'small' 
              ? 'max-w-[60vw] max-h-[60vh]' 
              : size === 'medium'
                ? 'max-w-[80vw] max-h-[80vh]'
                : 'max-w-[90vw] max-h-[90vh]'
        } ${fullscreen ? 'bg-transparent' : 'bg-white dark:bg-gray-800'}`}
      >
        {children}
      </div>
    </div>
  );
});

export default Modal;