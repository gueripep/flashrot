import { useThemeColor } from "@/hooks/useThemeColor";
import { aiService } from "@/services/aiService";
import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View
} from "react-native";
import { Button, HelperText, Modal, Portal, Text, TextInput } from "react-native-paper";

interface AddCardModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSaveCard: (front: string, back: string) => Promise<boolean>;
  initialCard?: { front: string; back: string } | null;
  mode?: "add" | "edit";
}

export default function AddCardModal({
  visible,
  onDismiss,
  onSaveCard,
  initialCard = null,
  mode = "add",
}: AddCardModalProps) {
  const textColor = useThemeColor({}, "text");
  const backgroundColor = useThemeColor({}, "background");
  const primaryColor = useThemeColor({}, "tint");
  const overlayColor = useThemeColor(
    { light: "rgba(0,0,0,0.2)", dark: "rgba(255,255,255,0.05)" },
    "text"
  );
  const frontInputRef = useRef<any>(null);

  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [frontError, setFrontError] = useState(false);
  const [backError, setBackError] = useState(false);

  useEffect(() => {
    if (visible) {
      if (initialCard) {
        setFront(initialCard.front);
        setBack(initialCard.back);
      } else {
        setFront("");
        setBack("");
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
      setFront("");
      setBack("");
      setSaving(false);
    }, 200);
  };

  const handleSave = async () => {
    // Reset errors before validation
    setFrontError(false);
    setBackError(false);

    let hasError = false;
    if (!front.trim()) {
      setFrontError(true);
      hasError = true;
    }
    if (!back.trim()) {
      setBackError(true);
      hasError = true;
    }

    if (hasError) {
      // Don't proceed with saving if there are errors
      return;
    }

    setSaving(true);
    await onSaveCard(front, back);
    setSaving(false);
  }

  const handleGenerateAnswer = async () => {
    setGenerating(true); // <-- Set loading state
    try {
      const answer = await aiService.generateAnswer(front);
      setBack(answer);
      if (backError && answer.trim()) setBackError(false); //hide the error message because this doesn't trigger onChange

    } finally {
      setGenerating(false);
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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View>
            <Text
              variant="headlineSmall"
              style={{ color: textColor, marginBottom: 24 }}
            >
              {mode === "add" ? "Add New Card" : "Edit Card"}
            </Text>
            <TextInput
              ref={frontInputRef}
              label="Front (Question)"
              value={front}
              onChangeText={(text) => {
                setFront(text);
                // Clear error as soon as the user starts typing
                if (frontError) setFrontError(false);
              }}
              mode="outlined"
              multiline
              numberOfLines={3}
              theme={{
                colors: {
                  primary: primaryColor,
                  onSurfaceVariant: textColor,
                  outline: frontError ? "red" : textColor + "80", // Highlight outline in red
                },
              }}
              onKeyPress={(e) => {
                const ev: any = e;
                const key = ev.key;
                const shift = ev.shiftKey;
                if (Platform.OS === 'web' && key === 'Enter' && !shift) {
                  ev.preventDefault();
                  handleSave();
                }
              }}
              placeholder="Enter the question or prompt..."
            />
            <HelperText type="error" visible={frontError}>
              Please enter the front of the card.
            </HelperText>

            <TextInput
              label="Back (Answer)"
              value={back}
              onChangeText={(text) => {
                setBack(text);
                // Clear error as soon as the user starts typing
                if (backError) setBackError(false);
              }}
              mode="outlined"
              multiline
              numberOfLines={3}
              theme={{
                colors: {
                  primary: primaryColor,
                  onSurfaceVariant: textColor,
                  outline: backError ? "red" : textColor + "80", // Highlight outline in red
                },
              }}
              onSubmitEditing={handleSave}
              onKeyPress={(e) => {
                const ev: any = e;
                const key = ev.key;
                const shift = ev.shiftKey;
                if (Platform.OS === 'web' && key === 'Enter' && !shift) {
                  ev.preventDefault();
                  handleSave();
                }
              }}
              placeholder={"Enter the answer or explanation..."}
            />
            {/* HelperText for the error message */}
            <HelperText type="error" visible={backError}>
              Please enter the back of the card or enable AI generation.
            </HelperText>
            <View style={styles.generateAnswerButtonContainer}>
              <Button
                mode="text"
                onPress={handleGenerateAnswer}
                textColor={primaryColor}
                disabled={saving || generating} // <-- Disable while generating
                loading={generating} // <-- Show spinner
              >
                Generate Answer
              </Button>
            </View>
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
              disabled={saving || generating}
            >
              {mode === "add" ? "Add Card" : "Save Changes"}
            </Button>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 20,
  },
  modalContent: {
    padding: 20,
    borderRadius: 10,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  generateAnswerButtonContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 16,
  },
});
