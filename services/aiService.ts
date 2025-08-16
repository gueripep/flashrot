
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../constants/config';

interface GenerationOptions {
  model?: string;
  maxWords?: number;
  language?: string;
}

class AIService {
  private baseUrl = 'http://192.168.1.3:8000';
  private readonly defaultModel = 'gemini-2.0-flash';


  private async generateContent(prompt: string, options: GenerationOptions = {}): Promise<string | null> {
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      console.log(`Using token: ${token}`);
      const response: any = await fetch(`${this.baseUrl}/gemini/generate/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt }), // Change 'request' to 'prompt'
      });
      const jsonResponse = await response.json();
      const text = jsonResponse?.content ?? null;
      // const text = this.extractTextFromResult(result);
      if (!text) return null;
      return String(text).trim();
    } catch (error) {
      console.error('AI generation failed:', error);
      return null;
    }
  }

  private removeMarkdownCodeBlocks(text: string): string {
    // Remove ```xml and ``` code block markers
    return text
      .replace(/```xml\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
  }

  async generateAnswer(question: string, options: GenerationOptions = {}): Promise<string | null> {
    const prompt = [
      'Generate a short answer for the following question.',
      '- Plain text only, no lists or markdown formatting.',
      `- Target 1 sentence (max ~${options.maxWords || 30} words).`,
      '- Be factual and educational.',
      '',
      `Question: ${question}`,
      '',
      'Answer:',
    ].join('\n');

    return this.generateContent(prompt, options);
  }

  async generateCourse(front: string, back: string, options: GenerationOptions = {}): Promise<string> {
    const prompt = [
      'Create a short, engaging educational course about the topic in the flashcard.',
      `- Target 2–4 sentences (~${options.maxWords || 150} words).`,
      '- Structure:',
      '1. Hook or intriguing fact.',
      '2. Clear, concise explanation of the key concept(s).',
      '3. Real-world example or analogy.',
      '4. Optional wrap-up or surprising detail.',
      `Front of card: ${front}`,
      `Back of card: ${back}`,
      '',
      'Generated course:',
    ].join('\n');

    const discussion = await this.generateContent(prompt, options);
    if (!discussion) {
      throw new Error('Failed to generate discussion');
    }

    // Remove markdown code blocks if present
    const cleanedDiscussion = this.removeMarkdownCodeBlocks(discussion);
    return cleanedDiscussion;
  }
}



export const aiService = new AIService();
