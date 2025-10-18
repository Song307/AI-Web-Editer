import React from 'react';

interface SettingsProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  language: 'ko' | 'en';
  onLanguageChange: (language: 'ko' | 'en') => void;
}

const Settings: React.FC<SettingsProps> = ({
  isDarkMode,
  onToggleTheme,
  language,
  onLanguageChange,
}) => {
  const texts = {
    ko: {
      title: '환경설정',
      theme: '테마',
      language: '언어',
      lightMode: '라이트 모드',
      darkMode: '다크 모드',
      korean: '한국어',
      english: 'English',
    },
    en: {
      title: 'Settings',
      theme: 'Theme',
      language: 'Language',
      lightMode: 'Light Mode',
      darkMode: 'Dark Mode',
      korean: '한국어',
      english: 'English',
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