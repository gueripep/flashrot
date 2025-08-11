import { ttsService } from '@/services/ttsService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

interface TTSSettings {
  enabled: boolean;
  apiKeySet: boolean;
}

export function useTTS() {
  const [settings, setSettings] = useState<TTSSettings>({
    enabled: false,
    apiKeySet: true, // No API key required for local server
  });
  const [loading, setLoading] = useState(true);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settingsString = await AsyncStorage.getItem('tts_settings');
      const savedSettings = settingsString ? JSON.parse(settingsString) : {};

      const newSettings = {
        enabled: savedSettings.enabled ?? false,
        apiKeySet: true, // Always true with local server
      };

      setSettings(newSettings);
    } catch (error) {
      console.error('Error loading TTS settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<TTSSettings>) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      const { apiKeySet, ...settingsToSave } = updatedSettings; // don't persist apiKeySet
      await AsyncStorage.setItem('tts_settings', JSON.stringify(settingsToSave));
      setSettings(updatedSettings);
    } catch (error) {
      console.error('Error saving TTS settings:', error);
    }
  };

  // No-op for local server, but keep API the same
  const setApiKey = async (_apiKey: string) => {
    try {
      await ttsService.setApiKey(_apiKey);
      setSettings(prev => ({ ...prev, apiKeySet: true, enabled: true }));
      return true;
    } catch (error) {
      console.error('Error setting API key:', error);
      return false;
    }
  };

  // No-op for local server; do not disable TTS
  const clearApiKey = async () => {
    try {
      await AsyncStorage.removeItem('gemini_api_key');
      setSettings(prev => ({ ...prev, apiKeySet: true }));
    } catch (error) {
      console.error('Error clearing API key:', error);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return {
    settings,
    loading,
    updateSettings,
    setApiKey,
    clearApiKey,
    refreshSettings: loadSettings,
  };
}
