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
      style={{
        position: 'fixed',
        top: `${adjustedPosition.y}px`,
        left: `${adjustedPosition.x}px`,
        zIndex: 999999,
        background: 'white',
        border: '1px solid #ccc',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        minWidth: '150px',
        maxWidth: '200px',
        overflow: 'hidden',
        pointerEvents: 'auto',
        fontSize: '14px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
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
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '10px 14px',
            background: 'transparent',
            border: 'none',
            color: item.danger ? '#ef4444' : 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-secondary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};

export default ContextMenu;


