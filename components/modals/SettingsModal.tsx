import { useAuth } from '@/hooks/useAuth';
import { useThemeColor } from '@/hooks/useThemeColor';
import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import {
    Button,
    Divider,
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
  const { logout, user } = useAuth();
  
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            onDismiss();
          },
        },
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
          Settings
        </Text>

        <View style={styles.content}>
          <Text style={[styles.userInfo, { color: textColor }]}>
            Logged in as: {user?.name}
          </Text>
          <Text style={[styles.userEmail, { color: textColor }]}>
            {user?.email}
          </Text>
        </View>

        <Divider style={styles.divider} />

        <View style={styles.actions}>
          <Button 
            mode="outlined" 
            onPress={handleLogout}
            style={styles.logoutButton}
            textColor="#ef4444"
          >
            Logout
          </Button>
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
  userInfo: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 16,
  },
  divider: {
    marginVertical: 16,
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
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  logoutButton: {
    borderColor: '#ef4444',
  },
});
