// 목소리 관련 유틸리티 함수들

// Gemini API를 호출하는 함수
const callGeminiAPI = async (prompt: string): Promise<string> => {
  try {
    const response = await fetch('/.netlify/functions/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error('Gemini API 호출 실패');
    }

    const data = await response.json();
    return data.response || data.text || '';
  } catch (error) {
    console.error('Gemini API 호출 오류:', error);
    throw error;
  }
};

// AI 기반 음성 추천 함수 
export const recommendVoicesWithAI = async (
  name: string,
  gender: 'male' | 'female',
  personality: string
): Promise<{
  recommendedVoices: string[];
  voiceParams: { rate: number; pitch: number; voiceName: string };
  sampleTexts: string[];
}> => {
  const prompt = `
당신은 AI 비서 음성 추천 전문가입니다. 이름, 성별, 성격을 분석하여 최적의 음성 설정을 추천하세요.

**사용자 정보:**
- 이름: ${name}
- 성별: ${gender === 'male' ? '남성' : '여성'}
- 성격: ${personality}

**필수 규칙:**

1. **음성 모델 선택** (성별 절대 엄수!)
   ${gender === 'male' 
     ? '- 남성용: ko-KR-InJoonNeural, ko-KR-BongJinNeural, ko-KR-GookMinNeural 중 3개 선택' 
     : '- 여성용: ko-KR-SunHiNeural, ko-KR-YuJinNeural, ko-KR-JiMinNeural 중 3개 선택'}

2. **sampleTexts 생성** (각 추천 목소리마다 1개씩, 총 3개)
   ⚠️ 절대 금지: "안녕하세요, 저는 [이름]입니다. 잘 부탁드립니다." 같은 형식적 인사!
   
   ✅ 성격 키워드 → 말투 매칭:
   - "직장상사", "부장", "과장", "싸가지" → **반말 + 명령조**
     예: "야, ${name}이다. 본론만 말해."
   
   - "밝고", "활발", "명랑" → **존댓말 + 친근**
     예: "안녕하세요! ${name}이에요! 너무 반가워요!"
   
   - "차분", "진중", "성실" → **존댓말 + 격식**
     예: "${name}입니다. 최선을 다하겠습니다."
   
   - "귀엽", "애교", "사랑스러" → **존댓말 + 귀여움**
     예: "헤헤~ ${name}이에요! 귀엽죠?"
   
   - "친근", "다정", "따뜻" → **반말 + 친근**
     예: "안녕~ ${name}야! 편하게 대해~"

3. **voiceParams 설정**
   - voiceName: recommendedVoices[0]와 동일
   - rate: 밝음(1.2-1.3), 보통(1.0), 차분(0.9)
   - pitch: 남성(0.9-1.0), 여성(1.1-1.2)

**출력 형식** (JSON만, 설명 절대 금지!):
{
  "recommendedVoices": ["voiceName1", "voiceName2", "voiceName3"],
  "voiceParams": {
    "rate": 1.0,
    "pitch": 1.0,
    "voiceName": "voiceName1"
  },
  "sampleTexts": [
    "성격에 맞는 첫 번째 대사",
    "성격에 맞는 두 번째 대사",
    "성격에 맞는 세 번째 대사"
  ]
}

**즉시 JSON으로 응답하세요!**`;

  try {
    const response = await callGeminiAPI(prompt);
    console.log('🤖 Gemini 원본 응답:', response);

    // JSON 추출 (코드 블록, 백틱, 텍스트 제거)
    let jsonStr = response.trim();
    
    // ```json ... ``` 제거
    jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // 첫 { 부터 마지막 } 까지만 추출
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }

    console.log('📝 추출된 JSON 문자열:', jsonStr);

    try {
      const parsed = JSON.parse(jsonStr);
      console.log('✅ 파싱 성공:', parsed);

      // AI 응답 검증
      let recommendedVoices = parsed.recommendedVoices || getFallbackVoices(gender);
      let voiceParams = parsed.voiceParams || getFallbackVoiceParams(gender);
      let sampleTexts = parsed.sampleTexts || await generateFallbackSampleTexts(name, personality, 3);

      // 성별 검증
      const maleVoices = ['ko-KR-InJoonNeural', 'ko-KR-BongJinNeural', 'ko-KR-GookMinNeural', 'ko-KR-HyunsuNeural', 'ko-KR-HyunsuMultilingualNeural'];
      const femaleVoices = ['ko-KR-SunHiNeural', 'ko-KR-YuJinNeural', 'ko-KR-JiMinNeural', 'ko-KR-SeoHyeonNeural', 'ko-KR-SoonBokNeural'];

      if (gender === 'male' && !maleVoices.includes(recommendedVoices[0])) {
        console.warn('⚠️ 남성인데 잘못된 목소리, 폴백 사용');
        recommendedVoices = getFallbackVoices(gender);
        voiceParams.voiceName = recommendedVoices[0];
        sampleTexts = await generateFallbackSampleTexts(name, personality, 3);
      } else if (gender === 'female' && !femaleVoices.includes(recommendedVoices[0])) {
        console.warn('⚠️ 여성인데 잘못된 목소리, 폴백 사용');
        recommendedVoices = getFallbackVoices(gender);
        voiceParams.voiceName = recommendedVoices[0];
        sampleTexts = await generateFallbackSampleTexts(name, personality, 3);
      }

      // voiceName 일치 확인
      if (voiceParams.voiceName !== recommendedVoices[0]) {
        voiceParams.voiceName = recommendedVoices[0];
      }

      console.log('🎤 최종 추천 결과:', { recommendedVoices, voiceParams, sampleTexts });

      return {
        recommendedVoices,
        voiceParams,
        sampleTexts
      };
    } catch (parseError) {
      console.error('❌ JSON 파싱 실패:', parseError);
      console.error('파싱 시도한 문자열:', jsonStr);
      
      return {
        recommendedVoices: getFallbackVoices(gender),
        voiceParams: getFallbackVoiceParams(gender),
        sampleTexts: await generateFallbackSampleTexts(name, personality, 3)
      };
    }
  } catch (error) {
    console.error('❌ AI 음성 추천 실패:', error);
    return {
      recommendedVoices: getFallbackVoices(gender),
      voiceParams: getFallbackVoiceParams(gender),
      sampleTexts: await generateFallbackSampleTexts(name, personality, 3)
    };
  }
};

// 폴백 함수들
const getFallbackVoices = (gender: 'male' | 'female'): string[] => {
  const maleVoices = ['ko-KR-InJoonNeural', 'ko-KR-BongJinNeural', 'ko-KR-GookMinNeural'];
  const femaleVoices = ['ko-KR-SunHiNeural', 'ko-KR-YuJinNeural', 'ko-KR-JiMinNeural'];
  return gender === 'male' ? maleVoices : femaleVoices;
};

const getFallbackVoiceParams = (gender: 'male' | 'female') => {
  return {
    rate: 1.0,
    pitch: gender === 'male' ? 0.9 : 1.1,
    voiceName: gender === 'male' ? 'ko-KR-InJoonNeural' : 'ko-KR-SunHiNeural'
  };
};

const generateFallbackSampleTexts = async (name: string, personality: string, count: number): Promise<string[]> => {
  try {
    console.log('🔄 AI 샘플 텍스트 생성 시도:', { name, personality, count });
    
    const prompt = `
당신은 AI 비서 대사 작가입니다. 주어진 이름과 성격에 맞는 ${count}개의 독특한 인사말을 생성하세요.

**정보:**
- 이름: ${name}
- 성격: ${personality}

**규칙:**
1. 절대 금지: "반갑습니다", "잘 부탁드립니다" 같은 형식적 표현
2. 성격에 딱 맞는 말투 사용
3. 각각 완전히 다른 표현으로 작성
4. 짧고 임팩트 있게 (1-2문장)

**성격별 가이드:**
- 직장상사/부장/과장 → 반말, 명령조, 직설적
- 밝고 활발 → 존댓말, 이모티콘, 친근
- 차분/진중 → 존댓말, 격식, 정중
- 귀엽고 애교 → 존댓말, 귀여운 말투
- 친근/다정 → 반말, 부드러움

**출력 형식 (JSON만, 배열로!):**
["첫 번째 대사", "두 번째 대사", "세 번째 대사"]

**즉시 JSON 배열로 응답!**`;

    const response = await callGeminiAPI(prompt);
    console.log('🤖 AI 샘플 응답:', response);
    
    // JSON 추출
    let jsonStr = response.trim();
    jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    const firstBracket = jsonStr.indexOf('[');
    const lastBracket = jsonStr.lastIndexOf(']');
    
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
    }
    
    const parsed = JSON.parse(jsonStr);
    
    if (Array.isArray(parsed) && parsed.length >= count) {
      console.log('✅ AI 샘플 생성 성공:', parsed);
      return parsed.slice(0, count);
    }
    
    throw new Error('AI 응답이 배열이 아니거나 개수가 부족함');
  } catch (error) {
    console.error('❌ AI 샘플 생성 실패:', error);
    
    // 최소한의 기본 메시지만 반환
    return Array(count).fill(`안녕하세요, ${name}입니다.`);
  }
};

// 음성 표시 이름 매핑
export const getVoiceDisplayName = (voiceName: string) => {
  const voiceMap: { [key: string]: string } = {
    'ko-KR-InJoonNeural': '인준 (캐주얼)',
    'ko-KR-BongJinNeural': '봉진 (안정적)',
    'ko-KR-GookMinNeural': '국민 (진중함)',
    'ko-KR-HyunsuNeural': '현수 (밝음)',
    'ko-KR-HyunsuMultilingualNeural': '현수 (격식)',
    'ko-KR-SunHiNeural': '선희 (격식)',
    'ko-KR-YuJinNeural': '유진 (명랑)',
    'ko-KR-JiMinNeural': '지민 (부드러움)',
    'ko-KR-SeoHyeonNeural': '서현 (호기심)',
    'ko-KR-SoonBokNeural': '순복 (생동감)'
  };
  return voiceMap[voiceName] || voiceName;
};

// 모든 사용 가능한 목소리 목록 반환 (성별 필터링)
export const getAllAvailableVoices = (gender?: 'male' | 'female') => {
  const maleVoices = [
    'ko-KR-InJoonNeural',
    'ko-KR-BongJinNeural',
    'ko-KR-GookMinNeural',
    'ko-KR-HyunsuNeural',
    'ko-KR-HyunsuMultilingualNeural'
  ];
  
  const femaleVoices = [
    'ko-KR-SunHiNeural',
    'ko-KR-YuJinNeural',
    'ko-KR-JiMinNeural',
    'ko-KR-SeoHyeonNeural',
    'ko-KR-SoonBokNeural'
  ];

  // 성별이 지정되면 해당 성별 목소리만 반환
  if (gender === 'male') {
    return maleVoices;
  } else if (gender === 'female') {
    return femaleVoices;
  }

  // 성별 미지정 시 모든 목소리 반환
  return [...maleVoices, ...femaleVoices];
};