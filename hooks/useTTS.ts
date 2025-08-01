import { ttsService } from '@/services/ttsService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

interface TTSSettings {
  enabled: boolean;
  autoPlay: boolean;
  apiKeySet: boolean;
}

export function useTTS() {
  const [settings, setSettings] = useState<TTSSettings>({
    enabled: false,
    autoPlay: true,
    apiKeySet: false
  });
  const [loading, setLoading] = useState(true);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [settingsString, apiKey] = await Promise.all([
        AsyncStorage.getItem('tts_settings'),
        ttsService.getApiKey()
      ]);

      const savedSettings = settingsString ? JSON.parse(settingsString) : {};
      
      setSettings({
        enabled: savedSettings.enabled ?? false,
        autoPlay: savedSettings.autoPlay ?? true,
        apiKeySet: !!apiKey
      });
    } catch (error) {
      console.error('Error loading TTS settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<TTSSettings>) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      
      // Don't save apiKeySet to storage, it's derived from actual key presence
      const { apiKeySet, ...settingsToSave } = updatedSettings;
      
      await AsyncStorage.setItem('tts_settings', JSON.stringify(settingsToSave));
      setSettings(updatedSettings);
    } catch (error) {
      console.error('Error saving TTS settings:', error);
    }
  };

  const setApiKey = async (apiKey: string) => {
    try {
      await ttsService.setApiKey(apiKey);
      setSettings(prev => ({ ...prev, apiKeySet: true, enabled: true }));
      return true;
    } catch (error) {
      console.error('Error setting API key:', error);
      return false;
    }
  };

  const clearApiKey = async () => {
    try {
      await AsyncStorage.removeItem('gemini_api_key');
      setSettings(prev => ({ ...prev, apiKeySet: false, enabled: false }));
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
    refreshSettings: loadSettings
  };
}
