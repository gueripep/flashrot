import { DeckCreateBody } from '@/hooks/useDecks';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, Modal, Portal, Text, TextInput } from 'react-native-paper';

interface CreateDeckModalProps {
  visible: boolean;
  onDismiss: () => void;
  onCreateDeck: (deck: DeckCreateBody) => Promise<void>;
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
      const newDeck: DeckCreateBody = {
        name: deckName.trim(),
      };
      onCreateDeck(newDeck);
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
        style={styles.modal}
        contentContainerStyle={[styles.modalContent, { backgroundColor }]}
      >
        {/* <View style={styles.modalOverlay}> */}
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={[styles.modalOverlay, { backgroundColor }]}
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
              onSubmitEditing={handleCreate}
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
          </KeyboardAvoidingView>

        {/* </View> */}

      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    alignItems: "stretch",
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
  },
  modal: {
    margin: 20,
  },
  modalContent: {
    padding: 20,
    borderRadius: 10,
    width: "100%",
    maxWidth: 600,
    //center itself
    alignSelf: "center",
  },
});
