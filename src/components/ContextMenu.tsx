import React, { useEffect, useRef, useState } from 'react';

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState({ x, y });

  console.log('ContextMenu received position:', { x, y });

  // Set initial position and adjust if needed
  useEffect(() => {
    console.log('ContextMenu useEffect triggered with:', { x, y });
    setAdjustedPosition({ x, y });

    // Adjust position after a brief delay to ensure menu is rendered
    const timer = setTimeout(() => {
      if (menuRef.current) {
        const menu = menuRef.current;
        const rect = menu.getBoundingClientRect();
        console.log('Menu actual position in DOM:', { left: rect.left, top: rect.top, width: rect.width, height: rect.height });

        const menuWidth = rect.width;
        const menuHeight = rect.height;

        console.log('Menu dimensions:', { menuWidth, menuHeight, rect });

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const margin = 8;

        let finalX = x;
        let finalY = y;

        // Adjust position to keep menu within viewport
        if (x + menuWidth > vw - margin) {
          finalX = Math.max(margin, x - menuWidth);
          console.log('Adjusted X for right overflow:', { originalX: x, finalX, menuWidth, vw });
        }

        if (y + menuHeight > vh - margin) {
          finalY = Math.max(margin, y - menuHeight);
          console.log('Adjusted Y for bottom overflow:', { originalY: y, finalY, menuHeight, vh });
        }

        console.log('Final adjusted position:', { finalX, finalY });
        setAdjustedPosition({ x: finalX, y: finalY });
      }
    }, 10);

    return () => clearTimeout(timer);
  }, [x, y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onScroll = () => onClose();
    const onResize = () => onClose();

    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-[999999] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg min-w-[150px] max-w-[200px] overflow-hidden pointer-events-auto text-sm font-sans"
      style={{
        top: `${adjustedPosition.y}px`,
        left: `${adjustedPosition.x}px`,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, idx) => (
        <button
          key={idx}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className={`block w-full text-left px-3.5 py-2.5 bg-transparent border-none cursor-pointer text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
            item.danger 
              ? 'text-red-500 dark:text-red-400' 
              : 'text-gray-900 dark:text-gray-100'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};

export default ContextMenu;


