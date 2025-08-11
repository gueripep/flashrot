
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
      const response: any = await fetch(`${this.baseUrl}/gemini/generate/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }), // Change 'request' to 'prompt'
      });
      const jsonResponse = await response.json();
      const text = jsonResponse?.content ?? null;
      console.log('AI generation response:', jsonResponse);
      // const text = this.extractTextFromResult(result);
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

  private removeMarkdownCodeBlocks(text: string): string {
    // Remove ```xml and ``` code block markers
    return text
      .replace(/```xml\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
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

    // Remove markdown code blocks if present
    const cleanedDiscussion = this.removeMarkdownCodeBlocks(discussion);
    return cleanedDiscussion;
  }
}



export const aiService = new AIService();
