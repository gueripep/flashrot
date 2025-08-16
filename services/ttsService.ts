import { AUTH_TOKEN_KEY } from '@/constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

interface TTSRequest {
  text: string;
  is_ssml?: boolean;
  language_code?: string;
  voice_name?: string;
  audio_encoding?: string;
  enable_time_pointing?: boolean;
}

interface TTSResponse {
  status: string;
  message: string;
  filename: string;
  text_length: number;
  language: string;
  voice: string;
  word_timings: any[];
  timing_filename: string | null;
}

class TTSService {
  // Base URL for local TTS server. Note: Android emulator uses 10.0.2.2 for host machine.
  private baseUrl: string = Platform.select({
    android: 'http://192.168.1.3:8000',
    ios: 'http://192.168.1.3:8000',
    default: 'http://192.168.1.3:8000',
  })!;

  constructor() { }

  // Generate TTS using the new API
  async generateTTS(text: string, options?: Partial<TTSRequest>): Promise<string> {
    if (!text || !text.trim()) throw new Error('Text cannot be empty');

    try {
      const requestBody: TTSRequest = {
        text: text.trim(),
        is_ssml: options?.is_ssml ?? false,
        language_code: options?.language_code || 'en-US',
        voice_name: options?.voice_name || 'en-US-Wavenet-D',
        audio_encoding: options?.audio_encoding || 'MP3',
        enable_time_pointing: options?.enable_time_pointing ?? true,
        
      };

      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      // Step 1: Synthesize the speech
      const synthesizeResponse = await fetch(`${this.baseUrl}/tts/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!synthesizeResponse.ok) {
        console.error('❌ TTS synthesis failed. Status:', synthesizeResponse.status);
        throw new Error('TTS synthesis failed');
      }

      const synthesizeResult: TTSResponse = await synthesizeResponse.json();
      console.log('✅ TTS synthesis successful:', synthesizeResult);

      // Step 2: Download the audio file
      const downloadUrl = `${this.baseUrl}/tts/download/${synthesizeResult.filename}`;
      const localFileName = `tts_${Date.now()}.mp3`;
      const filePath = `${FileSystem.documentDirectory}${localFileName}`;

      const downloadResult = await FileSystem.downloadAsync(downloadUrl, filePath);

      if (downloadResult.status >= 200 && downloadResult.status < 300) {

        // Step 3: Download and save timing data if available
        if (synthesizeResult.timing_filename) {
          try {
            const timingUrl = `${this.baseUrl}/tts/timing/${synthesizeResult.timing_filename}`;
            const localTimingFileName = localFileName.replace('.mp3', '_timing.json');
            const timingFilePath = `${FileSystem.documentDirectory}${localTimingFileName}`;
            await FileSystem.downloadAsync(timingUrl, timingFilePath);

          } catch (timingError) {
            console.log('⚠️ Failed to download timing data:', timingError);
          }
        }

        return downloadResult.uri;
      }

      console.error('❌ Audio download failed. Status:', downloadResult.status);
      throw new Error('Audio download failed');
    } catch (error) {
      console.error('❌ Error generating TTS:', error);
      throw error;
    }
  }

  async generateCardAudio(
    cardId: string,
    questionText: string,
    answerText: string,
    options?: Partial<TTSRequest>
  ): Promise<{ questionAudio: string; answerAudio: string }> {
    console.log('🔊 Starting audio generation for card (new API):', cardId);
    const [questionAudio, answerAudio] = await Promise.all([
      this.generateTTS(questionText, options),
      this.generateTTS(answerText, options),
    ]);
    return { questionAudio, answerAudio };

  }

  // Get local timing information for an audio file
  async getLocalTimingData(audioUri: string): Promise<any | null> {
    try {
      if (!audioUri) return null;

      // Extract filename from the audio path and create timing filename
      const audioFileName = audioUri.split('/').pop();
      if (!audioFileName) return null;

      const timingFileName = audioFileName.replace('.mp3', '_timing.json');
      const timingFilePath = `${FileSystem.documentDirectory}${timingFileName}`;

      // Check if timing file exists
      const fileInfo = await FileSystem.getInfoAsync(timingFilePath);
      if (!fileInfo.exists) {
        console.log('📊 No local timing data found for:', audioFileName);
        return null;
      }

      // Read and parse timing data
      const timingContent = await FileSystem.readAsStringAsync(timingFilePath);
      const timingData = JSON.parse(timingContent);

      return timingData;
    } catch (error) {
      console.error('❌ Error loading local timing data:', error);
      return null;
    }
  }

  // Download timing information for a specific audio file (fallback method)
  async downloadTimingInfo(filename: string): Promise<any | null> {
    try {
      const timingUrl = `${this.baseUrl}/tts/timing/${filename}`;
      const localTimingFileName = `timing_${Date.now()}.json`;
      const timingFilePath = `${FileSystem.documentDirectory}${localTimingFileName}`;

      console.log('📥 Downloading timing info from:', timingUrl);
      const downloadResult = await FileSystem.downloadAsync(timingUrl, timingFilePath);

      if (downloadResult.status >= 200 && downloadResult.status < 300) {
        const timingContent = await FileSystem.readAsStringAsync(downloadResult.uri);
        const timingData = JSON.parse(timingContent);
        console.log('✅ Timing info downloaded:', timingData);

        // Clean up the temporary file
        await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });

        return timingData;
      }

      console.error('❌ Timing download failed. Status:', downloadResult.status);
      return null;
    } catch (error) {
      console.error('❌ Error downloading timing info:', error);
      return null;
    }
  }

  // List available files on the server
  async listServerFiles(): Promise<{ audio_files: string[]; timing_files: string[]; total_audio: number; total_timing: number } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/tts/list`);

      if (!response.ok) {
        console.error('❌ Failed to list server files. Status:', response.status);
        return null;
      }

      const result = await response.json();
      console.log('📋 Server files:', result);
      return result;
    } catch (error) {
      console.error('❌ Error listing server files:', error);
      return null;
    }
  }

  async deleteCardAudio(cardId: string, questionAudio?: string, answerAudio?: string): Promise<void> {
    try {
      // Delete audio files if paths are provided
      if (questionAudio) {
        await FileSystem.deleteAsync(questionAudio, { idempotent: true });
        console.log('🗑️ Deleted question audio:', questionAudio);

        // Also delete corresponding timing file
        const timingFileName = questionAudio.split('/').pop()?.replace('.mp3', '_timing.json');
        if (timingFileName) {
          const timingPath = `${FileSystem.documentDirectory}${timingFileName}`;
          await FileSystem.deleteAsync(timingPath, { idempotent: true });
          console.log('🗑️ Deleted question timing data:', timingPath);
        }
      }
      if (answerAudio) {
        await FileSystem.deleteAsync(answerAudio, { idempotent: true });
        console.log('🗑️ Deleted answer audio:', answerAudio);

        // Also delete corresponding timing file
        const timingFileName = answerAudio.split('/').pop()?.replace('.mp3', '_timing.json');
        if (timingFileName) {
          const timingPath = `${FileSystem.documentDirectory}${timingFileName}`;
          await FileSystem.deleteAsync(timingPath, { idempotent: true });
          console.log('🗑️ Deleted answer timing data:', timingPath);
        }
      }

      // Clean up any legacy AsyncStorage entries (backward compatibility)
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
      const audioFiles = files.filter((file) => file.startsWith('tts_') && file.endsWith('.mp3'));
      const timingFiles = files.filter((file) => file.startsWith('tts_') && file.endsWith('_timing.json'));

      console.log('🎵 Found', audioFiles.length, 'TTS audio files:');
      audioFiles.forEach((file) => {
        console.log('  📄', file);
      });

      console.log('📊 Found', timingFiles.length, 'TTS timing files:');
      timingFiles.forEach((file) => {
        console.log('  📄', file);
      });

      // Check AsyncStorage for audio metadata
      const keys = await AsyncStorage.getAllKeys();
      const audioKeys = keys.filter((key) => key.startsWith('card_audio_'));

      console.log('💾 Found', audioKeys.length, 'audio metadata entries:');
      for (const key of audioKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const audioData = JSON.parse(data);
          console.log('  🔑', key, ':', {
            questionAudio: audioData.questionAudio ? '✅' : '❌',
            answerAudio: audioData.answerAudio ? '✅' : '❌',
            generatedAt: audioData.generatedAt,
          });
        }
      }
    } catch (error) {
      console.error('❌ Error debugging audio files:', error);
    }
  }

  // Helper methods remain for consistency; not used for local server
  isQuotaError(error: any): boolean {
    const errorString = JSON.stringify(error).toLowerCase();
    return (
      errorString.includes('429') ||
      errorString.includes('quota') ||
      errorString.includes('resource_exhausted')
    );
  }

  getErrorMessage(error: any): string {
    return error?.message || 'An unexpected error occurred during TTS generation.';
  }
}

export const ttsService = new TTSService();
