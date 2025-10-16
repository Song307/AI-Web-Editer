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

1. 의존성 설치:
```bash
npm install
```

2. 환경 변수 설정 (.env 파일 생성):
```env
REACT_APP_GEMINI_API_KEY=your_gemini_api_key_here
```

3. 개발 서버 실행:
```bash
npm start
```

브라우저에서 http://localhost:3000 접속

### 배포

Netlify를 통한 자동 배포 지원:
- `netlify.toml` 파일이 설정되어 있음
- 환경 변수는 Netlify 대시보드에서 설정

## API 키 설정

Google AI Studio에서 Gemini API 키를 발급받아야 합니다:
1. https://makersuite.google.com/app/apikey 접속
2. 새 API 키 생성
3. .env 파일 또는 Netlify 환경 변수에 설정

## 기술 스택

- **Frontend**: React 19, TypeScript
- **Editor**: TipTap
- **AI**: Google Gemini API
- **Storage**: IndexedDB, Local Storage
- **Deployment**: Netlify

## 프로젝트 구조

```
src/
├── components/
│   ├── Editor.tsx          # 메인 에디터 컴포넌트
│   └── Clipboard.tsx       # 클립보드 관리 컴포넌트
├── utils/
│   ├── ai.ts              # AI API 유틸리티
│   ├── db.ts              # IndexedDB 유틸리티
│   └── converter.ts       # 문서 변환 유틸리티
├── types/
│   └── turndown.d.ts      # 타입 정의
└── App.tsx                # 메인 앱 컴포넌트
```

## 사용 방법

1. **문서 생성**: "New Document" 버튼 클릭
2. **텍스트 편집**: 리치 텍스트 에디터 사용
3. **AI 기능 사용**: 텍스트 선택 후 AI 버튼들 클릭
4. **저장**: "Save" 버튼으로 로컬 저장
5. **클립보드**: Clipboard 탭에서 콘텐츠 관리

## 라이선스

이 프로젝트는 개인 학습 및 연구 목적으로 사용됩니다.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
