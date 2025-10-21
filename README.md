# AI Text Editor

AI를 활용한 클라이언트 사이드 텍스트 에디터 웹 서비스입니다. Gemini API를 핵심 엔진으로 하여 실시간 AI 리서치, 텍스트 분석, 페르소나 피드백 등의 기능을 제공합니다.

## 주요 기능

### AI 기능
- **AI 리서치**: 선택된 텍스트에 대한 정보 검색 및 분석
- **AI 텍스트 분석**: 문서의 논리 구조 및 개선점 분석
- **AI 페르소나 피드백**: 특정 역할의 관점에서 피드백 제공

### 편집 기능
- 리치 텍스트 에디터 (TipTap 기반)
- 문서 저장/불러오기 (IndexedDB)
- 클립보드 관리 (텍스트/이미지)

### 문서 변환
- HTML ↔ Markdown 변환
- 파일 업로드 및 변환 지원

## 설치 및 실행

### 로컬 개발 환경

# AI Web Editer

작업 공간(Workspace) 기반 로컬 웹 편집기. 문서(텍스트), 이미지, PDF, 동영상을 관리하고 미리보기·편집·정리한다.

설명용(PDA 스타일): 짧고 직접적인 문장, 명령형·기술적 표현 사용.

---

## 요약
- SPA: React + TypeScript
- 스타일: Tailwind CSS
- 스토리지: 로컬 기반(DB 유틸리티: `src/utils/db.ts`)
- 핵심 기능: 업로드, 미리보기(이미지/PDF/비디오), 편집(이름 변경 등), 삭제, 드래그앤드롭, 컨텍스트 메뉴

## 탭 및 화면
- 전체보기(All)
	- 문서·이미지·PDF·동영상 통합 표시
	- 뷰 모드: 그리드, 리스트, 트리
- 문서(Documents)
	- 문서 목록, 열기, 이름 변경, 삭제
- 이미지(Images)
	- 업로드, 미리보기, 전용 뷰어(확대·다운로드)
- PDF
	- 업로드, 뷰어(확대·축소·회전·썸네일 토글)
- 동영상(Videos)
	- 업로드, 재생

각 파일 카드의 우측 상단 ‘...’ 버튼으로 컨텍스트 메뉴(열기·이름 변경·삭제)를 호출한다.
	- 문서, 이미지, PDF, 동영상을 한 곳에서 통합하여 표시
	- 그리드/리스트/트리 보기 제공
- 문서(Documents)
	- 텍스트 기반 문서 목록
	- 미리보기/열기, 이름 변경, 삭제
- 이미지(Images)
	- 이미지 업로드 및 미리보기
	- 이미지 전용 뷰어를 통한 확대/다운로드 등
- PDF
	- PDF 업로드 및 뷰어(축소/확대, 회전, 썸네일 토글 등)
- 동영상(Videos)
	- 동영상 업로드 및 재생

각 항목마다 오른쪽 상단의 `...` 버튼으로 컨텍스트 메뉴(열기/이름 변경/삭제 등)를 열 수 있습니다.

## 시스템 구조(폴더 개요)
## 코드 구조
루트: `src/`
- `components/`
	- `WorkspacePage.tsx`: 메인 화면, 탭/뷰 모드/컨텍스트 메뉴
	- `Editor.tsx`: 문서 편집기
	- `tools/`: `ImageViewer.tsx`, `PDFViewer.tsx`, `VideoPlayer.tsx`
	- `UI/shared/`: `Modal`, `ContextMenu`, `ConfirmModal`, `RenameModal` 등
- `hooks/`: 커스텀 훅
- `utils/`: `db.ts`, `converter.ts`, `ai.ts` 등 비즈니스 로직
- `types/`: 타입 선언

정적 파일: `public/`, 빌드 출력: `build/`

## 데이터 모델(주요 타입 요약)
## 데이터 모델(요약)
모델 정의는 `src/utils/db.ts` 참고
- Document
	- `id`, `title`, `content`, `updatedAt`, `folder?`
- ImageFile
	- `id`, `name`, `data`(ArrayBuffer), `type`, `size`, `createdAt`, `folder?`
- PDFFile / VideoFile
	- ImageFile과 유사한 스키마

## Context Menu(컨텍스트 메뉴) 동작 및 튜닝
## 컨텍스트 메뉴 동작
- 초기 좌표: `WorkspacePage.tsx`의 `openContextForItem`에서 버튼 `getBoundingClientRect()`를 읽어 상태로 설정
- 보정 로직: `ContextMenu.tsx`에서 메뉴 실제 크기를 측정해 뷰포트 초과 시 좌우 또는 상하로 플립(또는 클램프)함

조정 포인트
- `openContextForItem`: `offsetX`, `offsetY`, `estimatedMenuWidth`
- `ContextMenu.tsx`: `min-w[...]`, `max-w[...]`, `margin`, `gap`

## 개발자 가이드
### 요구 환경
- Node.js(권장 LTS), npm

### 주요 의존성
- React, TypeScript, Tailwind CSS
- react-bootstrap-icons, react-hot-toast

### 배포
- `npm run build` 후 `build/`를 정적 호스팅(serve/Netlify/Vercel 등)에 배포

### 주의사항 / TODO
- ESLint 경고(미사용 변수, useEffect 의존성 등) 일부 존재. 정리 필요
- `ContextMenu`에 caret(화살표) 추가하면 UX 개선
- 로컬 저장소(`src/utils/db.ts`)를 서버 API로 교체하면 백엔드 통합 가능

### 컨트리뷰션
- 브랜치 기반 작업, PR 생성
- 커밋 태그: `feat:`, `fix:`, `chore:` 등

### 저작자
- 레포 소유자: Song307

---

추가 요청: 영문판, 스크린샷, 배지(logo/CI) 등을 원하면 알려라. 적용해서 커밋 준비함.


