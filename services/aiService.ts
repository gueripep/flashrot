import { GoogleGenAI } from '@google/genai';
import AsyncStorage from '@react-native-async-storage/async-storage';

class AIService {
  private ai: GoogleGenAI | null = null;
  private initialized = false;

  private async initialize() {
    if (this.initialized) return;
    try {
      const apiKey = await AsyncStorage.getItem('gemini_api_key');
      if (apiKey) {
        this.ai = new GoogleGenAI({ apiKey });
      }
    } catch (e) {
      console.warn('AI init failed:', e);
    } finally {
      this.initialized = true;
    }
  }

  async reformulateAnswer(question: string, answer: string): Promise<string | null> {
    await this.initialize();
    if (!this.ai) return null;

    try {
      const prompt = [
        'Rewrite the following answer to be clearer and more concise while preserving meaning and facts.',
        '- Keep the same language as the input.',
        '- Plain text only, no lists or markdown.',
        '- Target 1-2 sentences (max ~60 words).',
        '',
        `Question: ${question}`,
        `Answer: ${answer}`,
        '',
        'Rewritten answer:',
      ].join('\n');

      const result: any = await this.ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          { role: 'user', parts: [{ text: prompt }] },
        ],
      });

      // Extract text from various possible shapes
      const text =
        result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ??
        result?.candidates?.[0]?.content?.parts?.[0]?.text ??
        result?.response?.text?.() ??
        result?.output_text ??
        null;

      if (!text) return null;
      return String(text).trim();
    } catch (error) {
      console.error('AI reformulate failed:', error);
      return null;
    }
  }
}

export const aiService = new AIService();
