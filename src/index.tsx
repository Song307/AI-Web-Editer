import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// IndexedDB 강제 초기화 헬퍼 함수 (개발/디버깅용)
// 콘솔에서 window.resetDB() 실행 가능
(window as any).resetDB = () => {
  console.log('🔄 IndexedDB 완전 초기화 시작...');
  const dbName = 'AITextEditorDB';
  const deleteRequest = indexedDB.deleteDatabase(dbName);
  
  deleteRequest.onsuccess = () => {
    console.log('✅ IndexedDB 삭제 완료');
    console.log('🔄 페이지 새로고침 중...');
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };
  
  deleteRequest.onerror = () => {
    console.error('❌ IndexedDB 삭제 실패');
  };
  
  deleteRequest.onblocked = () => {
    console.warn('⚠️ IndexedDB 삭제가 차단됨. 모든 탭을 닫고 다시 시도하세요.');
  };
};

console.log('💡 Tip: IndexedDB 문제가 있으면 콘솔에서 "resetDB()" 실행하세요');

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
