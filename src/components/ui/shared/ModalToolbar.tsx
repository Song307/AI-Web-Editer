import React from 'react';

interface ModalToolbarProps {
  children: React.ReactNode;
}

const ModalToolbar: React.FC<ModalToolbarProps> = ({ children }) => {
  return (
    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex gap-2 items-center">
      {children}
    </div>
  );
};

export default ModalToolbar;