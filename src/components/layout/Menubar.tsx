import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { House, ClipboardCheck, Database, Palette, Robot, ChatDots, Gear, PinAngle, PinAngleFill } from 'react-bootstrap-icons';

interface MenubarProps {
  isDarkMode: boolean;
  language: 'ko' | 'en';
  isCompactLayout: boolean;
  onHoverChange?: (isHovered: boolean) => void;
}

const Menubar: React.FC<MenubarProps> = ({ isDarkMode, language, isCompactLayout, onHoverChange }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isHidden, setIsHidden] = useState(() => {
    const saved = localStorage.getItem('isMenubarHidden');
    return saved ? JSON.parse(saved) : false;
  });
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    localStorage.setItem('isMenubarHidden', JSON.stringify(isHidden));
  }, [isHidden]);

  useEffect(() => {
    if (onHoverChange) {
      onHoverChange(isHovered && isHidden);
    }
  }, [isHovered, isHidden, onHoverChange]);

  const menuItems = [
    {
      icon: House,
      label: language === 'ko' ? '대시보드' : 'Dashboard',
      path: '/dashboard',
    },
    {
      icon: ClipboardCheck,
      label: language === 'ko' ? '클립보드' : 'Clipboard',
      path: '/clipboard',
    },
    {
      icon: Database,
      label: language === 'ko' ? '저장소' : 'Storage',
      path: '/storage',
    },
    {
      icon: Palette,
      label: language === 'ko' ? '이미지 편집' : 'Image Editor',
      path: '/image-editor',
    },
    {
      icon: Robot,
      label: language === 'ko' ? 'AI 비서' : 'AI Secretary',
      path: '/ai-secretary',
    },
    {
      icon: ChatDots,
      label: language === 'ko' ? 'AI 어시스턴트' : 'AI Assistant',
      path: '/ai-assistant',
    },
  ];

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const shouldShow = !isHidden || isHovered;

  return (
    <>
      {/* Hover Trigger Area - 화면 좌측 끝 */}
      {isHidden && !isHovered && (
        <div
          className="fixed left-0 top-0 bottom-0 w-2 z-40"
          onMouseEnter={() => setIsHovered(true)}
        />
      )}

      <aside 
        className={`bg-white dark:bg-gray-900 flex flex-col border-gray-200 dark:border-gray-700 backdrop-blur-xl overflow-visible scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent py-4 px-2 fixed left-0 top-0 bottom-0 z-50 transition-transform duration-300 ease-in-out ${
          isCompactLayout 
            ? 'border-r' 
            : 'rounded-xl shadow-lg border'
        }`}
        style={{ 
          width: '80px', 
          minWidth: '80px',
          transform: shouldShow ? 'translateX(0)' : 'translateX(-100%)'
        }}
        onMouseLeave={() => {
          if (isHidden) setIsHovered(false);
        }}
      >
        {/* Menu Items */}
        <div className="flex flex-col gap-2 items-center flex-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <div key={item.path} className="relative group">
                <button
                  onClick={() => handleNavigation(item.path)}
                  className={`flex items-center justify-center w-12 h-12 rounded-lg cursor-pointer transition-all ${
                    active
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon size={24} />
                </button>
                {/* Custom Tooltip */}
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-[100] shadow-lg">
                  {item.label}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 mr-[-1px] border-[6px] border-transparent border-r-gray-900 dark:border-r-gray-700"></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Section - 설정 & 숨기기 버튼 */}
        <div className="flex flex-col gap-2 items-center mt-auto pt-4 border-t border-gray-200 dark:border-gray-700">
          {/* 설정 버튼 */}
          <div className="relative group">
            <button
              onClick={() => handleNavigation('/settings')}
              className={`flex items-center justify-center w-12 h-12 rounded-lg cursor-pointer transition-all ${
                isActive('/settings')
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Gear size={24} />
            </button>
            {/* Custom Tooltip */}
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-[100] shadow-lg">
              {language === 'ko' ? '설정' : 'Settings'}
              <div className="absolute right-full top-1/2 -translate-y-1/2 mr-[-1px] border-[6px] border-transparent border-r-gray-900 dark:border-r-gray-700"></div>
            </div>
          </div>

          {/* 숨기기/고정 버튼 */}
          <div className="relative group">
            <button
              onClick={() => setIsHidden(!isHidden)}
              className="flex items-center justify-center w-12 h-12 rounded-lg cursor-pointer transition-all text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {isHidden ? <PinAngle size={24} /> : <PinAngleFill size={24} />}
            </button>
            {/* Custom Tooltip */}
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-[100] shadow-lg">
              {isHidden ? (language === 'ko' ? '메뉴바 고정' : 'Pin Menu') : (language === 'ko' ? '메뉴바 숨기기' : 'Hide Menu')}
              <div className="absolute right-full top-1/2 -translate-y-1/2 mr-[-1px] border-[6px] border-transparent border-r-gray-900 dark:border-r-gray-700"></div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Menubar;
