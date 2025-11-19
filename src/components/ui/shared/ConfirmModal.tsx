import React, { useEffect } from 'react';
import Modal from './Modal';
import ModalHeader from './ModalHeader';
import ModalBody from './ModalBody';
import ModalFooter from './ModalFooter';
import Button from './Button';

interface ConfirmModalProps {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  deleteText?: string;
  isOpen: boolean;
  onConfirm?: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'danger';
  children?: React.ReactNode;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  deleteText,
  isOpen,
  onConfirm,
  onCancel,
  onDelete,
  size = 'small',
  variant = 'default',
  children,
}) => {
  // ESC 키 이벤트 처리
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <Modal size={size} onClose={onCancel}>
      <ModalHeader fileName={title} onClose={onCancel} />
      <ModalBody>
        {message && (
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
            {message}
          </p>
        )}
        {children}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onCancel}>
          {cancelText}
        </Button>
        {onDelete && (
          <Button variant="danger" onClick={onDelete}>
            {deleteText}
          </Button>
        )}
        {onConfirm && (
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmText}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
};

export default ConfirmModal;


