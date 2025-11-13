
// 브라우저 콘솔에서 실행할 IndexedDB 초기화 코드
// F12를 눌러 개발자 도구를 열고 Console 탭에서 아래 코드를 실행하세요:

// 1. 현재 데이터베이스 삭제
indexedDB.deleteDatabase('AITextEditorDB').onsuccess = function() {
  console.log('데이터베이스가 삭제되었습니다. 페이지를 새로고침하세요.');
};

// 2. 또는 다음 코드로 데이터베이스 버전을 강제로 업그레이드
const request = indexedDB.open('AITextEditorDB', 7);
request.onupgradeneeded = function(event) {
  console.log('데이터베이스 업그레이드 진행 중...');
  const db = event.target.result;
  // 필요한 오브젝트 스토어들이 자동으로 생성됩니다.
};
request.onsuccess = function() {
  console.log('데이터베이스 초기화 완료');
};

