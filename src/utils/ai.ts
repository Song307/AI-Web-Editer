// src/utils/ai.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY!);

export const generateAIResponse = async (prompt: string): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
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