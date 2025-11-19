import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { House, ClipboardCheck, Database, Palette, Robot, ChatDots, Gear, PinAngle, PinAngleFill } from 'react-bootstrap-icons';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { User } from 'firebase/auth';

interface MenubarProps {
  isDarkMode: boolean;
  language: 'ko' | 'en';
  isCompactLayout: boolean;
  user: User | null;
  onHoverChange?: (isHovered: boolean) => void;
  // notify parent when menubar visibility changes (shown/hidden)
  onVisibleChange?: (visible: boolean) => void;
}

const Menubar: React.FC<MenubarProps> = ({ isDarkMode, language, isCompactLayout, user, onHoverChange, onVisibleChange }) => {
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
    // {
    //   icon: Palette,
    //   label: language === 'ko' ? '이미지 편집' : 'Image Editor',
    //   path: '/image-editor',
    // },
    // {
    //   icon: Robot,
    //   label: language === 'ko' ? 'AI 비서' : 'AI Secretary',
    //   path: '/ai-secretary',
    // },
    {
      icon: ChatDots,
      label: language === 'ko' ? 'AI 어시스턴트' : 'AI Assistant',
      path: '/ai-assistant',
    }
  ];

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      alert('로그아웃 완료!');
    } catch (error) {
      alert('로그아웃 실패: ' + (error as Error).message);
    }
  };

  // Show when not hidden or when hovered (both layouts). For spaced layout we'll
  // hide fully (translateX(-100%)) when hidden, but hovering the left edge will reveal it.
  const shouldShow = !isHidden || isHovered;

  // Menu geometry
  const menubarInset = isCompactLayout ? 0 : 16; // px inset from left when shown
  const menubarWidth = 80; // px (matches style width)
  // When hidden we must shift by inset + width to fully move the bar off-screen
  const hideShiftPx = menubarInset + menubarWidth;
  const transformStyle = shouldShow ? 'translateX(0)' : `translateX(-${hideShiftPx}px)`;

  // Notify parent about visibility changes so the main content can animate margin
  useEffect(() => {
    if (onVisibleChange) onVisibleChange(shouldShow);
  }, [shouldShow, onVisibleChange]);

  return (
    <>
      {/* Hover Trigger Area - 화면 좌측 끝 */}
      {/* Hover trigger (left edge). When hidden, hovering the left edge reveals the menubar
          for both compact and spaced layouts. */}
      {isHidden && !isHovered && (
        // Left-edge hover trigger: placed at the very left of the viewport so the user
        // can move the mouse to the screen edge to reveal the menubar (not hovering the menubar itself).
        <div
          className="fixed left-0 top-0 bottom-0"
          onMouseEnter={() => setIsHovered(true)}
          // wider trigger so it's easy to hit, extremely high z-index to avoid being covered
          style={{ width: '20px', zIndex: 9999, background: 'transparent', pointerEvents: 'auto' }}
        />
      )}

      <aside 
        className={`bg-white dark:bg-gray-900 flex flex-col border-gray-200 dark:border-gray-700 backdrop-blur-xl overflow-visible scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent py-4 px-2 fixed z-50 transition-transform duration-300 ease-in-out ${
          isCompactLayout 
            ? 'border-r' 
            : 'rounded-xl shadow-lg border'
        }`}
        style={{
          width: `${menubarWidth}px`,
          minWidth: `${menubarWidth}px`,
          transform: transformStyle,
          // when not compact layout, inset the menubar to create surrounding spacing
          left: isCompactLayout ? 0 : `${menubarInset}px`,
          top: isCompactLayout ? 0 : `${menubarInset}px`,
          bottom: isCompactLayout ? 0 : `${menubarInset}px`
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
          {/* 로그아웃 버튼 */}
          {user && (
            <div className="relative group">
              <button
                onClick={handleLogout}
                className="flex items-center justify-center w-12 h-12 rounded-lg cursor-pointer transition-all text-gray-700 dark:text-gray-200 hover:bg-red-100 dark:hover:bg-red-900 hover:text-red-600 dark:hover:text-red-400"
                title={language === 'ko' ? '로그아웃' : 'Logout'}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16,17 21,12 16,7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
              {/* Custom Tooltip */}
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-[100] shadow-lg">
                {language === 'ko' ? '로그아웃' : 'Logout'}
                <div className="absolute right-full top-1/2 -translate-y-1/2 mr-[-1px] border-[6px] border-transparent border-r-gray-900 dark:border-r-gray-700"></div>
              </div>
            </div>
          )}

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
