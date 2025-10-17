import React from 'react';
import './Settings.css';
import './Settings.css';

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
    <div className="settings">
      <h2>{t.title}</h2>

      <div className="setting-group">
        <h3>{t.theme}</h3>
        <div className="theme-toggle-container">
          <button
            onClick={onToggleTheme}
            className={`theme-toggle-btn ${isDarkMode ? 'dark' : 'light'}`}
          >
            {isDarkMode ? '☀️ ' + t.lightMode : '🌙 ' + t.darkMode}
          </button>
        </div>
      </div>

      <div className="setting-group">
        <h3>{t.language}</h3>
        <div className="language-selector">
          <button
            onClick={() => onLanguageChange('ko')}
            className={`language-btn ${language === 'ko' ? 'active' : ''}`}
          >
            🇰🇷 {t.korean}
          </button>
          <button
            onClick={() => onLanguageChange('en')}
            className={`language-btn ${language === 'en' ? 'active' : ''}`}
          >
            🇺🇸 {t.english}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;