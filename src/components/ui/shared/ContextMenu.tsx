import React, { useEffect, useRef, useState } from 'react';

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  anchorRect?: { left: number; right: number; top: number; bottom: number; width: number; height: number } | null;
  items: ContextMenuItem[];
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, anchorRect, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState({ x, y });

  // Set initial position and adjust if needed
  useEffect(() => {
    setAdjustedPosition({ x, y });

    // Adjust position after a brief delay to ensure menu is rendered
    const timer = setTimeout(() => {
      if (menuRef.current) {
        const menu = menuRef.current;
        const rect = menu.getBoundingClientRect();

        const menuWidth = rect.width;
        const menuHeight = rect.height;

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const margin = 8;

        let finalX = x;
        let finalY = y;
        const gap = 8; // gap between anchor and menu when using anchorRect

        if (anchorRect) {
          // Prefer centering under the anchor
          finalX = anchorRect.left + (anchorRect.width / 2) - (menuWidth / 2);
          finalY = anchorRect.bottom + gap;

          // If overflowing to the right, align the menu's right edge with the anchor's right edge (so it appears to the left)
          if (finalX + menuWidth > vw - margin) {
            finalX = Math.min(vw - margin - menuWidth, anchorRect.right - menuWidth);
          }

          // If still overflowing to the left, clamp to margin
          if (finalX < margin) {
            finalX = margin;
          }

          // If menu would go below viewport, try showing above the anchor
          if (finalY + menuHeight > vh - margin) {
            const aboveY = anchorRect.top - menuHeight - gap;
            if (aboveY >= margin) {
              finalY = aboveY;
            } else {
              // fallback: clamp to fit in viewport
              finalY = Math.max(margin, vh - menuHeight - margin);
            }
          }
        } else {
          // Adjust position to keep menu within viewport (fallback behavior)
          if (x + menuWidth > vw - margin) {
            finalX = Math.max(margin, x - menuWidth);
          }

          if (y + menuHeight > vh - margin) {
            finalY = Math.max(margin, y - menuHeight);
          }
        }

        setAdjustedPosition({ x: finalX, y: finalY });
      }
    }, 10);

    return () => clearTimeout(timer);
  }, [x, y, anchorRect]);

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


