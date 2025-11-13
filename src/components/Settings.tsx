import React from 'react';

interface SettingsProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  language: 'ko' | 'en';
  onLanguageChange: (language: 'ko' | 'en') => void;
  isCompactLayout: boolean;
  onToggleLayout: () => void;
  isMenubarHidden?: boolean;
  onToggleMenubar?: () => void;
  isFocusMode?: boolean;
  isTypewriterMode?: boolean;
  onToggleFocusMode?: () => void;
  onToggleTypewriterMode?: () => void;
}

const Settings: React.FC<SettingsProps> = ({
  isDarkMode,
  onToggleTheme,
  language,
  onLanguageChange,
  isCompactLayout,
  onToggleLayout,
  isFocusMode = false,
  isTypewriterMode = false,
  onToggleFocusMode,
  onToggleTypewriterMode,
}) => {
  const texts = {
    ko: {
      title: '환경설정',
      theme: '테마',
      language: '언어',
      layout: '레이아웃',
      lightMode: '라이트 모드',
      darkMode: '다크 모드',
      korean: '한국어',
      english: 'English',
      compactLayout: '컴팩트 레이아웃',
      spacedLayout: '여백 레이아웃',
      layoutDescription: '화면 요소들 사이에 여백을 적용합니다',
    },
    en: {
      title: 'Settings',
      theme: 'Theme',
      language: 'Language',
      layout: 'Layout',
      lightMode: 'Light Mode',
      darkMode: 'Dark Mode',
      korean: '한국어',
      english: 'English',
      compactLayout: 'Compact Layout',
      spacedLayout: 'Spaced Layout',
      layoutDescription: 'Apply spacing between screen elements',
    },
  };

  const t = texts[language];

  return (
    <div className="p-6 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
      <h2 className="mb-6 text-3xl font-bold text-gray-900 dark:text-gray-100">{t.title}</h2>

      <div className="mb-8 p-5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{t.theme}</h3>
        <div className="flex items-center">
          <button
            onClick={onToggleTheme}
            className={`px-6 py-3 border-2 rounded-xl font-semibold cursor-pointer transition-all duration-300 flex items-center gap-2 ${
              isDarkMode
                ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-indigo-500 shadow-lg transform -translate-y-0.5'
                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:border-indigo-500 hover:shadow-md hover:transform hover:-translate-y-0.5'
            }`}
          >
            {isDarkMode ? '☀️ ' + t.lightMode : '🌙 ' + t.darkMode}
          </button>
        </div>
      </div>

      <div className="mb-8 p-5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">편집기 모드</h3>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">포커스 모드와 타이프라이터 모드를 설정합니다.</p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">포커스 모드</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">현재 블록을 강조하고 나머지를 흐리게 표시합니다</div>
            </div>
            <button
              onClick={onToggleFocusMode}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${isFocusMode ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white' : 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100'}`}
            >
              {isFocusMode ? '켜짐' : '끔'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">타이프라이터 모드</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">커서가 항상 화면 세로 중앙에 위치하도록 스크롤합니다</div>
            </div>
            <button
              onClick={onToggleTypewriterMode}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${isTypewriterMode ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white' : 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100'}`}
            >
              {isTypewriterMode ? '켜짐' : '끔'}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-8 p-5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{t.layout}</h3>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">{t.layoutDescription}</p>
        <div className="flex items-center">
          <button
            onClick={onToggleLayout}
            className={`px-6 py-3 border-2 rounded-xl font-semibold cursor-pointer transition-all duration-300 flex items-center gap-2 ${
              isCompactLayout
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:border-indigo-500 hover:shadow-md hover:transform hover:-translate-y-0.5'
                : 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-indigo-500 shadow-lg transform -translate-y-0.5'
            }`}
          >
            {isCompactLayout ? '📐 ' + t.spacedLayout : '📦 ' + t.compactLayout}
          </button>
        </div>
      </div>

      <div className="mb-8 p-5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{t.language}</h3>
        <div className="flex gap-3">
          <button
            onClick={() => onLanguageChange('ko')}
            className={`flex-1 px-4 py-3 border-2 rounded-xl font-medium cursor-pointer transition-all duration-300 flex items-center justify-center gap-2 ${
              language === 'ko'
                ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-indigo-500 shadow-lg transform -translate-y-0.5'
                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:border-indigo-500 hover:shadow-md hover:transform hover:-translate-y-0.5'
            }`}
          >
            🇰🇷 {t.korean}
          </button>
          <button
            onClick={() => onLanguageChange('en')}
            className={`flex-1 px-4 py-3 border-2 rounded-xl font-medium cursor-pointer transition-all duration-300 flex items-center justify-center gap-2 ${
              language === 'en'
                ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-indigo-500 shadow-lg transform -translate-y-0.5'
                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:border-indigo-500 hover:shadow-md hover:transform hover:-translate-y-0.5'
            }`}
          >
            🇺🇸 {t.english}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;