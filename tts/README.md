# TTS (Text-to-Speech) 서버

AI 비서의 음성 생성을 위한 TTS 서버입니다.

## 📁 파일 구조

```
tts/
├── tts_server.py           # TTS API 서버 (edge-tts 사용)
├── test_tts.html          # TTS 테스트 페이지
├── start_tts_server.sh    # 서버 시작 스크립트
└── README.md              # 이 파일
```

## 🚀 서버 시작

### 방법 1: 직접 실행
```bash
cd tts
python3 tts_server.py
```

### 방법 2: 스크립트 사용
```bash
./tts/start_tts_server.sh
```

## 🧪 테스트

1. TTS 서버 시작 (포트 5003)
2. 브라우저에서 `tts/test_tts.html` 열기
3. 텍스트, 목소리, 속도, 톤 설정 후 테스트

## 📡 API 엔드포인트

**POST** `http://localhost:5003/test-tts`

### 요청 본문
```json
{
  "text": "안녕하세요",
  "voice": "ko-KR-SunHiNeural",
  "rate": 0,     // -10 ~ +10 (%)
  "pitch": 0     // -50 ~ +50 (Hz)
}
```

### 응답
```json
{
  "success": true,
  "audio": "base64_encoded_audio_data",
  "size": 12345
}
```

## 🎤 사용 가능한 목소리

### 여성
- `ko-KR-SunHiNeural` - 격식 있고 자신감 있는
- `ko-KR-YuJinNeural` - 밝고 명랑한
- `ko-KR-JiMinNeural` - 부드럽고 자연스러운
- `ko-KR-SeoHyeonNeural` - 호기심 많고 쾌활한
- `ko-KR-SoonBokNeural` - 생동감 있고 밝은

### 남성
- `ko-KR-InJoonNeural` - 캐주얼하고 친근한
- `ko-KR-BongJinNeural` - 안정적이고 신뢰감 있는
- `ko-KR-GookMinNeural` - 차분하고 진중한
- `ko-KR-HyunsuNeural` - 밝고 캐주얼한
- `ko-KR-HyunsuMultilingualNeural` - 격식 있고 명확한

## 🔧 의존성

- Python 3
- edge-tts (Microsoft Edge TTS)

## 📝 사용 위치

- `src/components/AISecretaryCreator.tsx` - 음성 추천 및 테스트
- `src/components/AISecretaryManager.tsx` - 비서 음성 재생
