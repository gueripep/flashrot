import { useThemeColor } from '@/hooks/useThemeColor';
import { useTTS } from '@/hooks/useTTS';
import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import {
    Button,
    Divider,
    List,
    Modal,
    Portal,
    Switch,
    Text,
    TextInput
} from 'react-native-paper';

interface TTSSettingsModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function TTSSettingsModal({ visible, onDismiss }: TTSSettingsModalProps) {
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const { settings, updateSettings, setApiKey, clearApiKey } = useTTS();
  
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleApiKeySubmit = async () => {
    if (!apiKeyInput.trim()) {
      Alert.alert('Error', 'Please enter your Gemini API key');
      return;
    }

    setSaving(true);
    try {
      const success = await setApiKey(apiKeyInput.trim());
      if (success) {
        setApiKeyInput('');
        setShowApiKeyInput(false);
        Alert.alert('Success', 'API key saved successfully!');
      } else {
        Alert.alert('Error', 'Failed to save API key');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  const handleClearApiKey = () => {
    Alert.alert(
      'Clear API Key',
      'Are you sure you want to remove your API key? This will disable TTS functionality.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: clearApiKey
        }
      ]
    );
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modalContainer,
          { backgroundColor }
        ]}
      >
        <Text variant="headlineSmall" style={[styles.title, { color: textColor }]}>
          Text-to-Speech Settings
        </Text>

        <View style={styles.content}>
          {/* API Key Section */}
          <List.Section>
            <List.Subheader style={{ color: textColor }}>
              API Configuration
            </List.Subheader>
            
            <List.Item
              title="Gemini API Key"
              description={settings.apiKeySet ? 'API key is configured' : 'API key not set'}
              left={props => <List.Icon {...props} icon="key" />}
              right={() => (
                <View style={styles.apiKeyActions}>
                  {settings.apiKeySet ? (
                    <Button mode="outlined" onPress={handleClearApiKey}>
                      Clear
                    </Button>
                  ) : (
                    <Button 
                      mode="contained" 
                      onPress={() => setShowApiKeyInput(true)}
                    >
                      Set Key
                    </Button>
                  )}
                </View>
              )}
            />

            {showApiKeyInput && (
              <View style={styles.apiKeyInputContainer}>
                <TextInput
                  label="Gemini API Key"
                  value={apiKeyInput}
                  onChangeText={setApiKeyInput}
                  secureTextEntry
                  style={styles.apiKeyInput}
                />
                <View style={styles.apiKeyInputActions}>
                  <Button 
                    mode="outlined" 
                    onPress={() => {
                      setShowApiKeyInput(false);
                      setApiKeyInput('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    mode="contained" 
                    onPress={handleApiKeySubmit}
                    loading={saving}
                    disabled={saving}
                  >
                    Save
                  </Button>
                </View>
              </View>
            )}
          </List.Section>

          <Divider />

          {/* TTS Settings */}
          <List.Section>
            <List.Subheader style={{ color: textColor }}>
              Playback Settings
            </List.Subheader>
            
            <List.Item
              title="Enable TTS"
              description="Generate and play audio for flashcards"
              left={props => <List.Icon {...props} icon="volume-high" />}
              right={() => (
                <Switch
                  value={settings.enabled}
                  onValueChange={(value) => updateSettings({ enabled: value })}
                  disabled={!settings.apiKeySet}
                />
              )}
            />

            <List.Item
              title="Auto-play Audio"
              description="Automatically play audio when cards are displayed"
              left={props => <List.Icon {...props} icon="play-circle" />}
              right={() => (
                <Switch
                  value={settings.autoPlay}
                  onValueChange={(value) => updateSettings({ autoPlay: value })}
                  disabled={!settings.enabled}
                />
              )}
            />
          </List.Section>

          <Text variant="bodySmall" style={[styles.note, { color: textColor }]}>
            Note: You need a Gemini API key to use TTS features. Get one from the Google AI Studio.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button mode="contained" onPress={onDismiss}>
            Done
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    margin: 20,
    padding: 20,
    borderRadius: 12,
    maxHeight: '80%',
  },
  title: {
    textAlign: 'center',
    marginBottom: 20,
  },
  content: {
    flex: 1,
  },
  apiKeyActions: {
    marginRight: 8,
  },
  apiKeyInputContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  apiKeyInput: {
    marginBottom: 12,
  },
  apiKeyInputActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  note: {
    marginTop: 16,
    opacity: 0.7,
    fontStyle: 'italic',
  },
  actions: {
    marginTop: 20,
  },
});
