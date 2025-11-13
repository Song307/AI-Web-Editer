import React, { useEffect } from 'react';
import Modal from './Modal';
import ModalHeader from './ModalHeader';
import ModalBody from './ModalBody';
import ModalFooter from './ModalFooter';
import Input from './Input';
import Button from './Button';

interface InputModalProps {
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
  size?: 'small' | 'medium' | 'large';
  required?: boolean;
  error?: string;
}

const InputModal: React.FC<InputModalProps> = ({
  title = '입력',
  label,
  placeholder,
  value,
  confirmText = '확인',
  cancelText = '취소',
  isOpen,
  onChange,
  onConfirm,
  onCancel,
  size = 'small',
  required = false,
  error,
}) => {
  // ESC 키와 Enter 키 이벤트 처리
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter' && !error) {
        onConfirm();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel, onConfirm, error]);

  if (!isOpen) return null;

  return (
    <Modal size={size} onClose={onCancel}>
      <ModalHeader fileName={title} onClose={onCancel} />
      <ModalBody>
        <Input
          label={label}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          error={error}
        />
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onCancel}>
          {cancelText}
        </Button>
        <Button variant="primary" onClick={onConfirm} disabled={!!error}>
          {confirmText}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default InputModal;
