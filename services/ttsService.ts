import { AUTH_TOKEN_KEY } from '@/constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { AudioFileRef } from './fsrsService';

interface TTSRequest {
  text: string;
  is_ssml?: boolean;
  language_code?: string;
  voice_name?: string;
  audio_encoding?: string;
  enable_time_pointing?: boolean;
}

interface TTSResponse {
  audio_file_name: string;
  created_at: string;
  id: number;
  processing_time_ms: number;
  timing_file_name: string | null;
}

class TTSService {
  // Base URL for local TTS server. Note: Android emulator uses 10.0.2.2 for host machine.
  private baseUrl: string = Platform.select({
    android: 'http://192.168.1.3:8000',
    ios: 'http://192.168.1.3:8000',
    default: 'http://192.168.1.3:8000',
  })!;

  constructor() { }

  // Generate TTS using the new API (orchestrates three steps)
  async generateTTS(text: string, options?: Partial<TTSRequest>): Promise<AudioFileRef> {
    if (!text || !text.trim()) throw new Error('Text cannot be empty');

    const requestBody: TTSRequest = {
      text: text.trim(),
      is_ssml: options?.is_ssml ?? false,
      language_code: options?.language_code || 'en-US',
      voice_name: options?.voice_name || 'en-US-Wavenet-D',
      audio_encoding: options?.audio_encoding || 'MP3',
      enable_time_pointing: options?.enable_time_pointing ?? true,
    };

    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) {
        console.error('❌ No auth token found for TTS request');
        throw new Error('Authentication token is required for TTS requests');
      }

      // Step 1: synthesize on server
      const synthesizeResult = await this.synthesizeSpeech(requestBody, token);

      // Step 2: download audio
      const audioUri = await this.downloadAudioFile(synthesizeResult.audio_file_name);

      // Step 3: download timing data if provided (best-effort)
      const timingFileUri = await this.downloadTimingIfPresent(synthesizeResult.timing_file_name);
      const audioFileRef: AudioFileRef = {
        filename: audioUri,
        timingFilename: timingFileUri,
      };
      return audioFileRef;
    } catch (error) {
      console.error('❌ Error generating TTS:', error);
      throw error;
    }
  }

  // Step 1: call synthesize endpoint and return parsed response
  private async synthesizeSpeech(requestBody: TTSRequest, token: string): Promise<TTSResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const res = await fetch(`${this.baseUrl}/tts/synthesize`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      console.error('❌ TTS synthesis failed. Status:', res.status);
      throw new Error('TTS synthesis failed');
    }

    const json: TTSResponse = await res.json();
    console.log('✅ TTS synthesis successful:', json);
    return json;
  }

  // Step 2: download audio file and return local uri
  private async downloadAudioFile(audioFileName: string): Promise<string> {
    const downloadUrl = `${this.baseUrl}/tts/audio/${audioFileName}`;
    const audioFilePath = `${FileSystem.documentDirectory}${audioFileName}`;

    const downloadResult = await FileSystem.downloadAsync(downloadUrl, audioFilePath);

    if (downloadResult.status >= 200 && downloadResult.status < 300) {
      return downloadResult.uri;
    }

    console.error('❌ Audio download failed. Status:', downloadResult.status);
    throw new Error('Audio download failed');
  }

  // Step 3: download timing file if provided (best-effort, non-fatal)
  private async downloadTimingIfPresent(timingFileName?: string | null): Promise<string> {
    if (!timingFileName) throw new Error('No timing file name provided');

    try {
      const timingUrl = `${this.baseUrl}/tts/timing/${timingFileName}`;
      const timingFilePath = `${FileSystem.documentDirectory}${timingFileName}`;
      await FileSystem.downloadAsync(timingUrl, timingFilePath);
      return timingFilePath;
    } catch (err) {
      throw new Error(`⚠️ Failed to download timing data: ${err}`);
    }
  }

  async generateCardAudio(
    cardId: string,
    questionText: string,
    answerText: string,
    options?: Partial<TTSRequest>
  ): Promise<{ questionAudio: AudioFileRef; answerAudio: AudioFileRef }> {
    console.log('🔊 Starting audio generation for card (new API):', cardId);
    const [questionAudio, answerAudio] = await Promise.all([
      this.generateTTS(questionText, options),
      this.generateTTS(answerText, options),
    ]);
    return { questionAudio, answerAudio };

  }

  // Get local timing information for an audio file
  async getLocalTimingData(localTimingUri: string): Promise<any> {
    try {
      if (!localTimingUri) return null;

      // Check if timing file exists
      const fileInfo = await FileSystem.getInfoAsync(localTimingUri);
      if (!fileInfo.exists) {
        throw new Error('No local timing data found at ' + localTimingUri);
      }

      // Read and parse timing data
      const timingContent = await FileSystem.readAsStringAsync(localTimingUri);
      const timingData = JSON.parse(timingContent);

      return timingData;
    } catch (error) {
      throw new Error('Error loading local timing data: ' + error);
    }
  }

  // Download timing information for a specific audio file (fallback method)
  async downloadTimingInfo(filename: string): Promise<any | null> {
    try {
      const timingUrl = `${this.baseUrl}/tts/timing/${filename}`;
      const localTimingFileName = `timing_${Date.now()}.json`;
      const timingFilePath = `${FileSystem.documentDirectory}${localTimingFileName}`;
      const downloadResult = await FileSystem.downloadAsync(timingUrl, timingFilePath);

      if (downloadResult.status >= 200 && downloadResult.status < 300) {
        const timingContent = await FileSystem.readAsStringAsync(downloadResult.uri);
        const timingData = JSON.parse(timingContent);
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
