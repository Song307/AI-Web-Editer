import React, { useEffect } from 'react';
import Modal from './Modal';
import ModalHeader from './ModalHeader';
import ModalBody from './ModalBody';
import ModalFooter from './ModalFooter';
import Button from './Button';

interface TabCloseConfirmModalProps {
  isOpen: boolean;
  onDelete: () => void;
  onSave: () => void;
  onCancel: () => void;
}

const TabCloseConfirmModal: React.FC<TabCloseConfirmModalProps> = ({
  isOpen,
  onDelete,
  onSave,
  onCancel,
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
    <Modal size="small" onClose={onCancel}>
      <ModalHeader fileName="저장되지 않은 변경사항" onClose={onCancel} />
      <ModalBody>
        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
          문서에 저장되지 않은 변경사항이 있습니다. 정말로 삭제하시겠습니까?
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onCancel}>
          취소
        </Button>
        <Button variant="primary" onClick={onSave}>
          저장
        </Button>
        <Button variant="danger" onClick={onDelete}>
          삭제
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default TabCloseConfirmModal;