import { GoogleGenAI } from '@google/genai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import mime from 'mime';

interface WavConversionOptions {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
}

class TTSService {
  private apiKey: string | null = null;
  private ai: GoogleGenAI | null = null;
  private initialized: boolean = false;

  constructor() {
    // Don't initialize immediately to avoid AsyncStorage issues during bundling
  }

  private async initializeAPI() {
    if (this.initialized) return;
    
    try {
      // Get API key from storage or environment
      const storedKey = await AsyncStorage.getItem('gemini_api_key');
      if (storedKey) {
        this.apiKey = storedKey;
        this.ai = new GoogleGenAI({
          apiKey: this.apiKey,
        });
      }
      this.initialized = true;
    } catch (error) {
      console.warn('Failed to initialize TTS service:', error);
      this.initialized = true; // Mark as initialized even if it failed
    }
  }

  async setApiKey(apiKey: string) {
    try {
      this.apiKey = apiKey;
      await AsyncStorage.setItem('gemini_api_key', apiKey);
      this.ai = new GoogleGenAI({
        apiKey: this.apiKey,
      });
      this.initialized = true;
    } catch (error) {
      console.error('Failed to set API key:', error);
      throw error;
    }
  }

  async getApiKey(): Promise<string | null> {
    await this.initializeAPI();
    
    if (!this.apiKey) {
      try {
        this.apiKey = await AsyncStorage.getItem('gemini_api_key');
      } catch (error) {
        console.warn('Failed to get API key from storage:', error);
        return null;
      }
    }
    return this.apiKey;
  }

  private parseMimeType(mimeType: string): WavConversionOptions {
    const [fileType, ...params] = mimeType.split(';').map(s => s.trim());
    const [_, format] = fileType.split('/');

    const options: Partial<WavConversionOptions> = {
      numChannels: 1,
    };

    if (format && format.startsWith('L')) {
      const bits = parseInt(format.slice(1), 10);
      if (!isNaN(bits)) {
        options.bitsPerSample = bits;
      }
    }

    for (const param of params) {
      const [key, value] = param.split('=').map(s => s.trim());
      if (key === 'rate') {
        options.sampleRate = parseInt(value, 10);
      }
    }

    return options as WavConversionOptions;
  }

  private createWavHeader(dataLength: number, options: WavConversionOptions): ArrayBuffer {
    const {
      numChannels,
      sampleRate,
      bitsPerSample,
    } = options;

    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    // RIFF header
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + dataLength, true); // ChunkSize
    view.setUint32(8, 0x57415645, false); // "WAVE"

    // fmt chunk
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true); // Subchunk1Size (PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
    view.setUint16(22, numChannels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, byteRate, true); // ByteRate
    view.setUint16(32, blockAlign, true); // BlockAlign
    view.setUint16(34, bitsPerSample, true); // BitsPerSample

    // data chunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, dataLength, true); // Subchunk2Size

    return buffer;
  }

  private convertToWav(rawData: string, mimeType: string): ArrayBuffer {
    const options = this.parseMimeType(mimeType);
    const audioData = Uint8Array.from(atob(rawData), c => c.charCodeAt(0));
    const wavHeader = this.createWavHeader(audioData.length, options);
    
    const result = new Uint8Array(wavHeader.byteLength + audioData.length);
    result.set(new Uint8Array(wavHeader), 0);
    result.set(audioData, wavHeader.byteLength);
    
    return result.buffer;
  }

  async generateTTS(text: string): Promise<string | null> {
    await this.initializeAPI();
    
    if (!this.ai) {
      throw new Error('TTS service not initialized. Please set API key first.');
    }

    console.log('🎵 Generating TTS for text:', text.substring(0, 50) + '...');

    // First, let's test if the basic API connection works
    try {
      console.log('🧪 Testing basic API connection...');
      const testResult = await this.ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }]
      });
      console.log('✅ Basic API test successful');
    } catch (testError) {
      console.error('❌ Basic API test failed:', testError);
      throw new Error('Basic API connection failed. Check your API key and network connection.');
    }

    try {
      const config = {
        temperature: 1,
        responseModalities: ['audio'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Rasalgethi',
            }
          }
        },
      };

      const model = 'gemini-2.5-flash-preview-tts';
      const contents = [
        {
          role: 'user',
          parts: [
            {
              text: text,
            },
          ],
        },
      ];

      console.log('🔧 Request config:', JSON.stringify(config, null, 2));
      console.log('📝 Request contents:', JSON.stringify(contents, null, 2));
      console.log('🎯 Model:', model);

      console.log('📡 Making API request to Gemini...');
      let response;
      try {
        response = await this.ai.models.generateContentStream({
          model,
          config,
          contents,
        });
      } catch (apiError) {
        console.error('❌ API request failed:', apiError);
        
        // Try with a simpler config as fallback
        console.log('🔄 Trying with simplified config...');
        const simpleConfig = {
          responseModalities: ['audio'],
        };
        
        try {
          response = await this.ai.models.generateContentStream({
            model: 'gemini-2.5-flash-preview-tts',
            config: simpleConfig,
            contents,
          });
          console.log('✅ Fallback request succeeded');
        } catch (fallbackError) {
          console.error('❌ Fallback request also failed:', fallbackError);
          throw apiError; // Throw the original error
        }
      }

      console.log('✅ API response received, starting to process stream...');
      let chunkCount = 0;
      
      // Add a timeout to detect if the stream hangs
      const streamTimeout = setTimeout(() => {
        console.log('⏰ Stream has been processing for more than 30 seconds...');
      }, 30000);
      
      try {
        for await (const chunk of response) {
          chunkCount++;
          console.log(`📦 Processing chunk ${chunkCount}:`, JSON.stringify(chunk, null, 2));
          
          if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
            console.log('⚠️ Chunk missing expected structure, skipping...');
            continue;
          }

          if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
            const inlineData = chunk.candidates[0].content.parts[0].inlineData;
            let fileExtension = mime.getExtension(inlineData.mimeType || '');
            let audioBuffer: ArrayBuffer;

            if (!fileExtension) {
              fileExtension = 'wav';
              audioBuffer = this.convertToWav(inlineData.data || '', inlineData.mimeType || '');
            } else {
              const uint8Array = Uint8Array.from(atob(inlineData.data || ''), c => c.charCodeAt(0));
              audioBuffer = uint8Array.buffer;
            }

            // Save to file system
            const fileName = `tts_${Date.now()}.${fileExtension}`;
            const filePath = `${FileSystem.documentDirectory}${fileName}`;
            
            console.log('💾 Saving audio file to:', filePath);
            
            const uint8Array = new Uint8Array(audioBuffer);
            const base64String = btoa(String.fromCharCode(...uint8Array));
            
          
            await FileSystem.writeAsStringAsync(filePath, base64String, {
              encoding: FileSystem.EncodingType.Base64,
            });

            console.log('✅ Audio file saved successfully:', fileName);
            return filePath;
          }
        }
      } finally {
        clearTimeout(streamTimeout);
      }

      console.log(`❌ No audio data received from API after processing ${chunkCount} chunks`);
      console.log('🔍 If chunkCount is 0, the stream never yielded any chunks');
      return null;
    } catch (error: any) {
      // 🔴 DEBUGGER: Catch errors
      debugger;
      console.error('❌ Error generating TTS:', error);
      
      // Check for quota exceeded error
      if (error?.message?.includes('429') || error?.message?.includes('quota') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
        const quotaError = new Error('TTS quota exceeded. You have reached the daily limit for TTS requests. Please try again tomorrow or upgrade your plan.');
        quotaError.name = 'QuotaExceededError';
        throw quotaError;
      }
      
      throw error;
    }
  }

  async generateCardAudio(cardId: string, questionText: string, answerText: string): Promise<{ questionAudio: string | null; answerAudio: string | null }> {
    await this.initializeAPI();
    
    console.log('🔊 Starting audio generation for card:', cardId);
    console.log('📝 Question:', questionText.substring(0, 30) + '...');
    console.log('📝 Answer:', answerText.substring(0, 30) + '...');
    console.log('🔑 API Key exists:', !!this.apiKey);
    console.log('🤖 AI instance exists:', !!this.ai);
    
    try {
      const [questionAudio, answerAudio] = await Promise.all([
        this.generateTTS(questionText),
        this.generateTTS(answerText)
      ]);

      console.log('🎵 Question audio generated:', questionAudio ? '✅' : '❌');
      console.log('🎵 Answer audio generated:', answerAudio ? '✅' : '❌');
      
      if (questionAudio) console.log('📁 Question audio path:', questionAudio);
      if (answerAudio) console.log('📁 Answer audio path:', answerAudio);

      // Store audio file paths in AsyncStorage for the card
      const audioData = {
        questionAudio,
        answerAudio,
        generatedAt: new Date().toISOString()
      };

      await AsyncStorage.setItem(`card_audio_${cardId}`, JSON.stringify(audioData));
      console.log('💾 Audio metadata saved for card:', cardId);

      return { questionAudio, answerAudio };
    } catch (error) {
      console.error('❌ Error generating card audio:', error);
      console.error('📋 Error details:', JSON.stringify(error, null, 2));
      return { questionAudio: null, answerAudio: null };
    }
  }

  async getCardAudio(cardId: string): Promise<{ questionAudio: string | null; answerAudio: string | null }> {
    try {
      const audioDataString = await AsyncStorage.getItem(`card_audio_${cardId}`);
      if (audioDataString) {
        const audioData = JSON.parse(audioDataString);
        
        // Check if files still exist
        const questionExists = audioData.questionAudio ? await FileSystem.getInfoAsync(audioData.questionAudio) : null;
        const answerExists = audioData.answerAudio ? await FileSystem.getInfoAsync(audioData.answerAudio) : null;

        return {
          questionAudio: questionExists?.exists ? audioData.questionAudio : null,
          answerAudio: answerExists?.exists ? audioData.answerAudio : null
        };
      }
      return { questionAudio: null, answerAudio: null };
    } catch (error) {
      console.error('Error getting card audio:', error);
      return { questionAudio: null, answerAudio: null };
    }
  }

  async deleteCardAudio(cardId: string): Promise<void> {
    try {
      const audioData = await this.getCardAudio(cardId);
      
      // Delete audio files
      if (audioData.questionAudio) {
        await FileSystem.deleteAsync(audioData.questionAudio, { idempotent: true });
      }
      if (audioData.answerAudio) {
        await FileSystem.deleteAsync(audioData.answerAudio, { idempotent: true });
      }

      // Remove from storage
      await AsyncStorage.removeItem(`card_audio_${cardId}`);
    } catch (error) {
      console.error('Error deleting card audio:', error);
    }
  }

  // Debug method to inspect audio files
  async debugAudioFiles(): Promise<void> {
    try {
      console.log('🔍 DEBUG: Checking audio files...');
      console.log('📁 Document Directory:', FileSystem.documentDirectory);
      
      if (!FileSystem.documentDirectory) {
        console.log('❌ No document directory available');
        return;
      }

      const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
      const audioFiles = files.filter(file => file.startsWith('tts_'));
      
      console.log('🎵 Found', audioFiles.length, 'TTS audio files:');
      audioFiles.forEach(file => {
        console.log('  📄', file);
      });

      // Check AsyncStorage for audio metadata
      const keys = await AsyncStorage.getAllKeys();
      const audioKeys = keys.filter(key => key.startsWith('card_audio_'));
      
      console.log('💾 Found', audioKeys.length, 'audio metadata entries:');
      for (const key of audioKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const audioData = JSON.parse(data);
          console.log('  🔑', key, ':', {
            questionAudio: audioData.questionAudio ? '✅' : '❌',
            answerAudio: audioData.answerAudio ? '✅' : '❌',
            generatedAt: audioData.generatedAt
          });
        }
      }
    } catch (error) {
      console.error('❌ Error debugging audio files:', error);
    }
  }

  // Helper method to check if error is quota-related
  isQuotaError(error: any): boolean {
    const errorString = JSON.stringify(error).toLowerCase();
    return errorString.includes('429') || 
           errorString.includes('quota') || 
           errorString.includes('resource_exhausted') ||
           errorString.includes('generativelanguage.googleapis.com/generate_content_free_tier_requests');
  }

  // Get user-friendly error message
  getErrorMessage(error: any): string {
    if (this.isQuotaError(error)) {
      return 'TTS quota exceeded. You have reached the daily limit of 15 TTS requests. Please try again tomorrow or upgrade your plan for higher limits.';
    }
    return error.message || 'An unexpected error occurred during TTS generation.';
  }
}

export const ttsService = new TTSService();
