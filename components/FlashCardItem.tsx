import { AntDesign } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { Card, Text } from "react-native-paper";
import Animated from "react-native-reanimated";

import AudioPlayer from "@/components/AudioPlayer";
import DeleteConfirmationModal from "@/components/modals/DeleteConfirmationModal";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { useThemeColor } from "@/hooks/useThemeColor";
import { FlashCard } from "@/services/fsrsService";

interface FlashCardItemProps {
  card: FlashCard;
  isFlipped: boolean;
  onFlip: (cardId: string) => void;
  onEdit: (card: FlashCard) => void;
  onDelete: (card: FlashCard) => void;
}

export default function FlashCardItem({
  card,
  isFlipped,
  onFlip,
  onEdit,
  onDelete,
}: FlashCardItemProps) {
  const textColor = useThemeColor({}, "text");
  const cardBackgroundColor = useThemeColor({}, "cardBackground");

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const {
    panGesture,
    isGestureActive,
    animatedStyle,
    leftActionStyle,
    rightActionStyle,
    leftBackgroundStyle,
    rightBackgroundStyle,
    resetGestureState,
  } = useSwipeGesture({
    onSwipeLeft: () => setShowDeleteModal(true),
    onSwipeRight: () => onEdit(card),
    enableVerticalGestureCheck: true,
  });

  const handleDeleteConfirm = () => {
    setShowDeleteModal(false);
    resetGestureState();
    onDelete(card);
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    resetGestureState();
  };

  const handleCardPress = () => {
    // Add a small delay to ensure gesture state is accurate
    setTimeout(() => {
      if (!isGestureActive) {
        onFlip(card.id);
      }
    }, 50);
  };

  return (
    <>
      <View style={styles.cardContainer}>
        {/* Delete background (right side) */}
        <Animated.View style={[styles.deleteBackground, leftBackgroundStyle]}>
          <Animated.View style={leftActionStyle}>
            <AntDesign name="delete" size={24} color="white" />
          </Animated.View>
        </Animated.View>

        {/* Edit background (left side) */}
        <Animated.View style={[styles.editBackground, rightBackgroundStyle]}>
          <Animated.View style={rightActionStyle}>
            <AntDesign name="edit" size={24} color="white" />
          </Animated.View>
        </Animated.View>

        {/* Card with gesture */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={animatedStyle}>
            <Card
              style={[
                styles.flashCard,
                { backgroundColor: cardBackgroundColor },
              ]}
            >
              <Card.Content style={styles.cardContent}>
                <TouchableOpacity
                  style={styles.cardTouchable}
                  onPress={handleCardPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardHeader}>
                    <Text
                      variant="bodySmall"
                      style={{
                        color: textColor,
                        opacity: 0.6,
                        marginBottom: 8,
                      }}
                    >
                      {isFlipped ? "Back" : "Front"}
                    </Text>
                    {/* Show audio player if TTS is available for current side */}
                    <View style={styles.audioPlayerContainer}>
                      <AudioPlayer
                        audioUri={
                          isFlipped
                            ? card.final_card.answer_audio.local_filename
                            : card.final_card.question_audio.local_filename
                        }
                        size={20}
                      />
                    </View>
                  </View>
                  <Text
                    variant="bodyLarge"
                    style={{
                      color: textColor,
                      textAlign: "center",
                      lineHeight: 24,
                    }}
                  >
                    {isFlipped ? card.final_card.back : card.final_card.front}
                  </Text>
                </TouchableOpacity>
              </Card.Content>
            </Card>
          </Animated.View>
        </GestureDetector>
      </View>

      <DeleteConfirmationModal
        visible={showDeleteModal}
        onDismiss={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        deckName={card.final_card.front}
      />
    </>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 12,
    position: "relative",
    width: "100%",
  },
  deleteBackground: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "50%",
    justifyContent: "center",
    alignItems: "flex-end",
    backgroundColor: "#dc3545",
    borderRadius: 12,
    paddingRight: 20,
  },
  editBackground: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "50%",
    justifyContent: "center",
    alignItems: "flex-start",
    backgroundColor: "#007bff",
    borderRadius: 12,
    paddingLeft: 20,
  },
  flashCard: {
    minHeight: 120,
    borderRadius: 12,
    width: "100%",
  },
  cardContent: {
    justifyContent: "space-between",
    alignItems: "stretch",
    minHeight: 100,
    position: "relative",
  },
  cardTouchable: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 100,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 8,
  },
  audioPlayerContainer: {
    zIndex: 2,
  },
});
