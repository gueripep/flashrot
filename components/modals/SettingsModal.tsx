import { useThemeColor } from '@/hooks/useThemeColor';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Modal,
  Portal,
  Text
} from 'react-native-paper';

interface SettingsModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function SettingsModal({ visible, onDismiss }: SettingsModalProps) {
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [saving, setSaving] = useState(false);

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
          Settings
        </Text>

        

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
