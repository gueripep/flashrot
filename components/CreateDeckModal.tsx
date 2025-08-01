import { useThemeColor } from '@/hooks/useThemeColor';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, Modal, Portal, Text, TextInput } from 'react-native-paper';

interface Deck {
  id: string;
  name: string;
  cardCount: number;
  createdAt: string;
}

interface CreateDeckModalProps {
  visible: boolean;
  onDismiss: () => void;
  onCreateDeck: (deck: Deck) => void;
}

export default function CreateDeckModal({ visible, onDismiss, onCreateDeck }: CreateDeckModalProps) {
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const primaryColor = useThemeColor({}, 'tint');
  const [deckName, setDeckName] = useState('');

  const handleClose = () => {
    setDeckName(''); // Clear the input when closing
    onDismiss();
  };

  const handleCreate = () => {
    if (deckName.trim()) {
      const newDeck: Deck = {
        id: Date.now().toString(),
        name: deckName.trim(),
        cardCount: 0,
        createdAt: new Date().toISOString(),
      };
      onCreateDeck(newDeck);
      Alert.alert('Success', `Created deck: "${deckName}"`);
      handleClose();
    } else {
      Alert.alert('Error', 'Please enter a deck name');
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleClose}
        contentContainerStyle={[styles.modalContent, { backgroundColor }]}
      >
        <Text variant="headlineSmall" style={{ color: textColor, marginBottom: 24 }}>
          Add New Deck
        </Text>

        <TextInput
          label="Deck name"
          value={deckName}
          onChangeText={setDeckName}
          mode="outlined"
          style={{ marginBottom: 24 }}
          autoFocus={true}
          theme={{
            colors: {
              primary: primaryColor,
              onSurfaceVariant: textColor,
              outline: textColor + '80',
            }
          }}
        />

        <View style={styles.modalButtons}>
          <Button
            mode="text"
            onPress={handleClose}
            textColor={primaryColor}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleCreate}
            buttonColor={primaryColor}
            style={{ marginLeft: 12 }}
          >
            Create
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    margin: 20,
    minWidth: 400,
    borderRadius: 12,
    padding: 24,
    alignSelf: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
  },
});
