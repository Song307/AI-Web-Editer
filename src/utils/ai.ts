// src/utils/ai.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;

if (!API_KEY) {
  console.error('REACT_APP_GEMINI_API_KEY is not set');
  throw new Error('Gemini API key is missing');
}

console.log('API Key loaded:', API_KEY ? 'Yes' : 'No');

const genAI = new GoogleGenerativeAI(API_KEY);

export const generateAIResponse = async (prompt: string): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite-preview-06-17' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('AI API error:', error);
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
*/