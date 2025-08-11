import { GoogleGenAI } from '@google/genai';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface GenerationOptions {
  model?: string;
  maxWords?: number;
  language?: string;
}

class AIService {
  private ai: GoogleGenAI | null = null;
  private initialized = false;
  private readonly defaultModel = 'gemini-2.0-flash';

  private async initialize(): Promise<void> {
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

  private async generateContent(prompt: string, options: GenerationOptions = {}): Promise<string | null> {
    await this.initialize();
    if (!this.ai) return null;

    try {
      const result: any = await this.ai.models.generateContent({
        model: options.model || this.defaultModel,
        contents: [
          { role: 'user', parts: [{ text: prompt }] },
        ],
      });

      const text = this.extractTextFromResult(result);
      if (!text) return null;
      return String(text).trim();
    } catch (error) {
      console.error('AI generation failed:', error);
      return null;
    }
  }

  private extractTextFromResult(result: any): string | null {
    return (
      result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ??
      result?.candidates?.[0]?.content?.parts?.[0]?.text ??
      result?.response?.text?.() ??
      result?.output_text ??
      null
    );
  }

  async generateAnswer(question: string, options: GenerationOptions = {}): Promise<string | null> {
    const prompt = [
      'Generate a clear, accurate, and concise answer for the following question.',
      '- Keep the same language as the question.',
      '- Plain text only, no lists or markdown formatting.',
      `- Target 1-3 sentences (max ~${options.maxWords || 100} words).`,
      '- Be factual and educational.',
      '',
      `Question: ${question}`,
      '',
      'Answer:',
    ].join('\n');

    return this.generateContent(prompt, options);
  }

  async generateSSMLDiscussion(front: string, back: string, options: GenerationOptions = {}): Promise<string> {
    const prompt = [
      'Create a short, engaging educational dialogue in SSML format about the topic in the flashcard.',
      '- Use <voice name="en-US-Wavenet-A"> and <voice name="en-US-Wavenet-B"> for different speakers.',
      `- Target 2–4 sentences (~${options.maxWords || 150} words).`,
      '- Structure:',
      '1. Hook or intriguing fact.',
      '2. Clear, concise explanation of the key concept(s).',
      '3. Real-world example or analogy.',
      '4. Optional wrap-up or surprising detail.',
      `Front of card: ${front}`,
      `Back of card: ${back}`,
      '',
      'Generated SSML discussion:',
    ].join('\n');

    const discussion = await this.generateContent(prompt, options);
    if (!discussion) {
      throw new Error('Failed to generate discussion');
    }

    return discussion;
  }
}

export const aiService = new AIService();
