// src/utils/ai.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { VoiceParams } from '../types/secretary';

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;

if (!API_KEY) {
  console.warn('REACT_APP_GEMINI_API_KEY is not set. AI calls will fail until a valid key is provided.');
}

// Default model to try. Use the project's available Gemini model.
// If you see a 404 for a model, list available models by calling the REST endpoint:
// GET https://generativelanguage.googleapis.com/v1beta/models
// Recommended model (set per your note):
const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

// Debug log removed: API key load status

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null as any;

export const generateAIResponse = async (prompt: string): Promise<string> => {
  if (!genAI) {
    console.error('generateAIResponse: Missing Gemini API key');
    throw new Error('Gemini API key is missing');
  }

  try {
    console.log('AI 요청 시작:', prompt.substring(0, 50) + '...');

    // Try the configured model name, and if that returns a model-not-found
    // error, try the resource-style name ("models/<name>"). This handles
    // differences between returned model names from the ListModels endpoint.
    const triedVariants = [] as string[];
    const tryModel = async (modelName: string) => {
      triedVariants.push(modelName);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    };

    // First, try the plain DEFAULT_MODEL
    try {
      const text = await tryModel(DEFAULT_MODEL);
      console.log('AI 응답 성공 (model=', DEFAULT_MODEL, ')');
      return text;
    } catch (firstErr) {
      console.warn('First model attempt failed for', DEFAULT_MODEL, firstErr);
      // If the model looks like it's not found, try the prefixed form
      const prefixed = DEFAULT_MODEL.startsWith('models/') ? DEFAULT_MODEL : `models/${DEFAULT_MODEL}`;
      if (!triedVariants.includes(prefixed)) {
        try {
          const text = await tryModel(prefixed);
          console.log('AI 응답 성공 (model=', prefixed, ')');
          return text;
        } catch (secondErr) {
          console.warn('Second model attempt failed for', prefixed, secondErr);
          // fallthrough to error handling below
        }
      }
      // If both attempts failed, surface the original error for logging below
      throw firstErr;
    }
  } catch (error) {
    console.error('AI API error:', error);

    // If it's a model-not-found / 404 from the Generative API, try to
    // fetch the available models list to aid debugging.
    try {
      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
      const resp = await fetch(listUrl);
      if (resp.ok) {
        const models = await resp.json();
        console.warn('Available Generative Models:', models);
      } else {
        const txt = await resp.text();
        console.warn('Failed to list models, response:', resp.status, txt);
      }
    } catch (listErr) {
      console.warn('Error while fetching model list:', listErr);
    }

    throw new Error('Failed to generate AI response');
  }
};

export const researchTopic = async (topic: string): Promise<string> => {
  const prompt = `Please research and provide information about: ${topic}. Include key facts, current trends, and relevant insights.`;
  return generateAIResponse(prompt);
};

export const analyzeText = async (text: string): Promise<string> => {
  const prompt = `Analyze the following text for logical structure, coherence, and potential improvements: ${text}`;
  return generateAIResponse(prompt);
};

export const generatePersonaFeedback = async (text: string, persona: string): Promise<string> => {
  const prompt = `As a ${persona}, provide feedback on the following text: ${text}. Give constructive criticism and suggestions for improvement.`;
  return generateAIResponse(prompt);
};

export const answerQuestion = async (question: string): Promise<string> => {
  const prompt = `Please answer the following question clearly and comprehensively: ${question}`;
  return generateAIResponse(prompt);
};

// 이미지 분석 함수
export const analyzeImage = async (
  imageData: string,
  prompt: string = "이 이미지에 대해 자세히 설명해주세요."
): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite-preview-06-17' });
    
    // base64 데이터에서 data URL prefix 제거
    const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
    
    // MIME 타입 추출
    let mimeType = 'image/jpeg';
    if (imageData.startsWith('data:')) {
      const match = imageData.match(/data:([^;]+);/);
      if (match) mimeType = match[1];
    }
    
    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    };
    
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Image analysis error:', error);
    throw new Error('Failed to analyze image');
  }
};

// PDF 분석 함수 (여러 페이지 이미지를 받아서 분석)
export const analyzePDFPages = async (
  pageImages: string[],
  prompt: string = "이 PDF 문서를 분석하고 요약해주세요."
): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite-preview-06-17' });
    
    // 각 페이지 이미지를 imagePart로 변환
    const imageParts = pageImages.map(imageData => {
      const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
      return {
        inlineData: {
          data: base64Data,
          mimeType: 'image/png'
        }
      };
    });
    
    // 프롬프트 + 모든 페이지 이미지를 함께 전송
    const fullPrompt = `${prompt}\n\n이 PDF는 총 ${pageImages.length}개 페이지로 구성되어 있습니다. 모든 페이지의 내용을 종합하여 분석해주세요.`;
    
    const result = await model.generateContent([fullPrompt, ...imageParts]);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('PDF analysis error:', error);
    throw new Error('Failed to analyze PDF');
  }
};

// API 키 테스트 함수 - 더 이상 사용하지 않음 (실제 AI 기능 사용 시 에러 처리)
/*
export const testAPIKey = async (): Promise<boolean> => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent('Hello');
    const response = await result.response;
    return !!response.text();
  } catch (error) {
    console.error('API Key test failed:', error);
    return false;
  }
};

// AI 비서 목소리 파라미터 생성
export const generateVoiceParams = async (personality: string): Promise<VoiceParams> => {
  try {
    const prompt = `너는 Web Speech API의 목소리 프로필을 생성하는 전문가야.
내가 캐릭터 성격을 설명하면, 그 성격에 가장 어울리는 목소리 파라미터를 추천해 줘.

# 파라미터 규칙
- rate: 말하기 속도. 0.5(매우 느림) ~ 2(매우 빠름) 사이의 값. 기본값은 1.
- pitch: 목소리 톤. 0(매우 낮음) ~ 2(매우 높음) 사이의 값. 기본값은 1.

# 출력 규칙
- 다른 설명은 절대 하지 말고, 오직 JSON 형식으로만 응답해 줘.
- JSON 객체는 'rate'와 'pitch' 키를 반드시 포함해야 해.

# 예시
입력: "활발하고 명랑한 10대 소녀"
출력: {"rate": 1.3, "pitch": 1.4}

이제 내가 주는 성격으로 JSON을 생성해 줘:
${personality}`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite-preview-06-17' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    // JSON 파싱 시도
    try {
      const params = JSON.parse(text);
      return {
        rate: Math.max(0.5, Math.min(2, params.rate || 1)),
        pitch: Math.max(0, Math.min(2, params.pitch || 1)),
      };
    } catch (parseError) {
      console.warn('Failed to parse voice params JSON, using defaults:', text);
      return { rate: 1, pitch: 1 };
    }
  } catch (error) {
    console.error('Voice params generation error:', error);
    return { rate: 1, pitch: 1 };
  }
};
*/