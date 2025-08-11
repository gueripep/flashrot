import { useThemeColor } from '@/hooks/useThemeColor';
import { useTTS } from '@/hooks/useTTS';
import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import { Button, Portal, Text, TextInput } from 'react-native-paper';

interface AddCardModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSaveCard: (front: string, back: string, generateAudio?: boolean) => Promise<boolean>;
  initialCard?: { front: string; back: string } | null;
  mode?: 'add' | 'edit';
}

export default function AddCardModal({
  visible,
  onDismiss,
  onSaveCard,
  initialCard = null,
  mode = 'add'
}: AddCardModalProps) {
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const primaryColor = useThemeColor({}, 'tint');
  const { settings } = useTTS();
  const frontInputRef = useRef<any>(null);

  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [generateAudio, setGenerateAudio] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      if (initialCard) {
        setFront(initialCard.front);
        setBack(initialCard.back);
      } else {
        setFront('');
        setBack('');
      }
      // Focus the input after a small delay to ensure modal is fully rendered
      setTimeout(() => {
        frontInputRef.current?.focus();
      }, 100);
    }
  }, [visible, initialCard]);

  const handleClose = () => {
    Keyboard.dismiss();
    // Don't clear state immediately to prevent layout flash during close animation
    onDismiss();
    // Clear state after a small delay to allow modal to close smoothly
    setTimeout(() => {
      setFront('');
      setBack('');
      setSaving(false);
    }, 200);
  };

  const handleSave = async () => {
    if (!front.trim()) {
      Alert.alert('Error', 'Please enter the front of the card');
      return;
    }
    if (!back.trim()) {
      Alert.alert('Error', 'Please enter the back of the card');
      return;
    }

    setSaving(true);
    await onSaveCard(front, back, settings.enabled && generateAudio);
    setSaving(false);
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleClose}
        animationType="fade"
        transparent={true}
        backdropColor={backgroundColor}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={[styles.inner, { backgroundColor }]}
            >
              <View>
                <Text variant="headlineSmall" style={{ color: textColor, marginBottom: 24 }}>
                  {mode === 'add' ? 'Add New Card' : 'Edit Card'}
                </Text>
                <TextInput
                  ref={frontInputRef}
                  label="Front (Question)"
                  value={front}
                  onChangeText={setFront}
                  mode="outlined"
                  style={[styles.textInput, { marginBottom: 16 }]}
                  multiline
                  numberOfLines={3}
                  theme={{
                    colors: {
                      primary: primaryColor,
                      onSurfaceVariant: textColor,
                      outline: textColor + '80',
                    }
                  }}
                  placeholder="Enter the question or prompt..."
                  contentStyle={styles.inputContent}
                />
                <TextInput
                  label="Back (Answer)"
                  value={back}
                  onChangeText={setBack}
                  mode="outlined"
                  style={[styles.textInput, { marginBottom: 24 }]}
                  multiline
                  numberOfLines={3}
                  theme={{
                    colors: {
                      primary: primaryColor,
                      onSurfaceVariant: textColor,
                      outline: textColor + '80',
                    }
                  }}
                  placeholder="Enter the answer or explanation..."
                  contentStyle={styles.inputContent}
                />
              </View>
              <View style={styles.modalButtons}>
                <Button
                  mode="text"
                  onPress={handleClose}
                  textColor={primaryColor}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSave}
                  buttonColor={primaryColor}
                  style={{ marginLeft: 12 }}
                  loading={saving}
                  disabled={saving}
                >
                  {mode === 'add' ? 'Add Card' : 'Save Changes'}
                </Button>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>

      </Modal>
    </Portal >
  );
}




const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  inner: {
    padding: 20,
    margin: 20,
    borderRadius: 10,
  },
  container: {
    flex: 1,
    padding: 20,
    margin: 20
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 16,
  },
  textInput: {
    minHeight: 80,
    maxHeight: 120,
  },
  inputContent: {
    paddingTop: 8,
    paddingBottom: 8,
  },
});
