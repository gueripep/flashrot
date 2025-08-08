import { useThemeColor } from '@/hooks/useThemeColor';
import React from 'react';
import { StyleSheet } from 'react-native';
import { Button, Card, Modal, Portal, Text } from 'react-native-paper';

interface DeleteConfirmationModalProps {
  visible: boolean;
  deckName: string;
  onDismiss: () => void;
  onConfirm: () => void;
}

export default function DeleteConfirmationModal({ 
  visible, 
  deckName, 
  onDismiss, 
  onConfirm 
}: DeleteConfirmationModalProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.modal, { backgroundColor }]}
      >
        <Card style={{ backgroundColor }}>
          <Card.Content>
            <Text variant="titleMedium" style={{ color: textColor, marginBottom: 16 }}>
              Delete Deck
            </Text>
            <Text variant="bodyMedium" style={{ color: textColor, marginBottom: 24 }}>
              Are you sure you want to delete "{deckName}"? This action cannot be undone.
            </Text>
            <Card.Actions style={styles.actions}>
              <Button mode="outlined" onPress={onDismiss}>
                Cancel
              </Button>
              <Button 
                mode="contained" 
                onPress={onConfirm} 
                buttonColor="#dc3545"
                textColor="white"
              >
                Delete
              </Button>
            </Card.Actions>
          </Card.Content>
        </Card>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 20,
    borderRadius: 8,
    maxWidth: 800,
    alignSelf: 'center',
    justifyContent: 'center'
  },
  actions: {
    justifyContent: 'flex-end',
    gap: 8,
  },
});
