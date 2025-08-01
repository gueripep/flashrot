import { useThemeColor } from '@/hooks/useThemeColor';
import { useTTS } from '@/hooks/useTTS';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, List, Modal, Portal, Switch, Text, TextInput } from 'react-native-paper';

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
    }
  }, [visible, initialCard]);

  const handleClose = () => {
    setFront('');
    setBack('');
    setSaving(false);
    onDismiss();
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
    const success = await onSaveCard(front, back, settings.enabled && generateAudio);
    setSaving(false);
    
    if (success) {
      Alert.alert(
        'Success', 
        mode === 'add' ? 'Card added successfully!' : 'Card updated successfully!'
      );
      handleClose();
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
          {mode === 'add' ? 'Add New Card' : 'Edit Card'}
        </Text>

        <TextInput
          label="Front (Question)"
          value={front}
          onChangeText={setFront}
          mode="outlined"
          style={[styles.textInput, { marginBottom: 16 }]}
          multiline
          numberOfLines={3}
          autoFocus={true}
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

        {/* TTS Option */}
        {settings.enabled && mode === 'add' && (
          <List.Item
            title="Generate Audio"
            description="Create TTS audio for question and answer"
            left={props => <List.Icon {...props} icon="volume-high" />}
            right={() => (
              <Switch
                value={generateAudio}
                onValueChange={setGenerateAudio}
              />
            )}
            style={{ marginBottom: 16 }}
          />
        )}

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
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    margin: 20,
    maxWidth: 500,
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
  textInput: {
    minHeight: 80,
    maxHeight: 120,
  },
  inputContent: {
    paddingTop: 8,
    paddingBottom: 8,
  },
});
