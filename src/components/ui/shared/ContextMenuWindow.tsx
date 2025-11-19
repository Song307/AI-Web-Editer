import React, { useEffect, useRef, useState } from 'react';
import { Star, Lightning, Activity, Eye } from 'react-bootstrap-icons';

interface IContextMenuAction {
  id: string;
  className?: string;
  label: string;
  icon: string;
  sections?: IContextMenuSection[];
  onClick?: () => void;
}

interface IContextMenuSection {
  id: string;
  actions: IContextMenuAction[];
}

interface ContextMenuWindowProps {
  sections: IContextMenuSection[];
  level: number;
  onActionClick: (action: IContextMenuAction) => void;
  onGenerateSections?: (level: number) => IContextMenuSection[];
  onClose: () => void;
}

const ContextMenuWindow: React.FC<ContextMenuWindowProps> = ({
  sections,
  level,
  onActionClick,
  onGenerateSections,
  onClose
}) => {
  const [activeExtension, setActiveExtension] = useState<string | null>(null);
  const [dynamicSections, setDynamicSections] = useState<{[key: string]: IContextMenuSection[]}>({});
  const windowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (windowRef.current && !windowRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleActionClick = (action: IContextMenuAction) => {
    // 무한 메뉴 액션인 경우
    if (action.label.includes('options') && onGenerateSections) {
      const nextLevelSections = onGenerateSections(level + 1);
      setDynamicSections(prev => ({
        ...prev,
        [action.id]: nextLevelSections
      }));
      setActiveExtension(activeExtension === action.id ? null : action.id);
    } else if (action.sections && action.sections.length > 0) {
      setActiveExtension(activeExtension === action.id ? null : action.id);
    } else {
      action.onClick?.();
      onClose();
    }
  };

  const getSpecialEffect = () => {
    if (level === 1) {
      return (
        <div className="special-effect">
          <Star />
        </div>
      );
    }
    if (level === 2) {
      return (
        <div className="sparkle-effect">
          <Lightning />
          <Lightning />
          <Lightning />
        </div>
      );
    }
    if (level === 3) {
      return (
        <div className="wave-effect escalation-level-3">
          <Activity />
        </div>
      );
    }
    return null;
  };

  const renderIcon = (iconName: string) => {
    // 간단한 아이콘 매핑 - 실제로는 더 많은 아이콘이 필요할 수 있음
    switch (iconName) {
      case 'star': return <Star />;
      case 'lightning': return <Lightning />;
      case 'activity': return <Activity />;
      case 'eye': return <Eye />;
      default: return <Star />;
    }
  };

  return (
    <div
      ref={windowRef}
      className={`context-menu-window ${level === 1 ? 'escalation-level-1' : ''}`}
      id="context-menu"
    >
      {getSpecialEffect()}
      {sections.map((section) => (
        <div key={section.id} className="context-menu-section">
          {section.actions.map((action) => (
            <div key={action.id} className="context-menu-extension">
              <button
                className={`context-menu-action ${action.className || ''}`}
                onClick={() => handleActionClick(action)}
              >
                {renderIcon(action.icon)}
                <span className="label">{action.label}</span>
                {(action.sections && action.sections.length > 0) || action.label.includes('options') ? (
                  <span className="fa-solid fa-caret-right">▶</span>
                ) : null}
              </button>
              {activeExtension === action.id && (
                <ContextMenuWindow
                  sections={dynamicSections[action.id] || action.sections || []}
                  level={level + 1}
                  onActionClick={onActionClick}
                  onGenerateSections={onGenerateSections}
                  onClose={onClose}
                />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default ContextMenuWindow;