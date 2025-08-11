import { useThemeColor } from '@/hooks/useThemeColor';
import { useTTS } from '@/hooks/useTTS';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Divider,
  List,
  Modal,
  Portal,
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

        <View style={[styles.content, { backgroundColor: 'transparent' }]}>
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {/* API Key Section */}
            <List.Section>
              <List.Subheader style={{ color: textColor, paddingHorizontal: 16 }}>
                API Configuration
              </List.Subheader>
              
              <List.Item
                title="Gemini API Key"
                description={settings.apiKeySet ? 'API key is configured' : 'API key not set'}
                titleStyle={{ color: textColor }}
                descriptionStyle={{ color: textColor, opacity: 0.7 }}
                left={props => <List.Icon {...props} icon="key" color={textColor} />}
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
                style={{ paddingVertical: 8 }}
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
          </ScrollView>
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
    maxHeight: '85%',
    minHeight: 400,
  },
  title: {
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 16,
    fontSize: 20,
  },
  content: {
    flex: 1,
    maxHeight: '70%',
  },
  apiKeyActions: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apiKeyInputContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'transparent',
  },
  apiKeyInput: {
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  apiKeyInputActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  note: {
    marginTop: 16,
    marginHorizontal: 16,
    opacity: 0.7,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  actions: {
    marginTop: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
});
