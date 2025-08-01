import { useThemeColor } from '@/hooks/useThemeColor';
import { AntDesign } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Card, Text } from 'react-native-paper';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';
import DeleteConfirmationModal from './DeleteConfirmationModal';

interface Deck {
  id: string;
  name: string;
  cardCount: number;
  createdAt: string;
}

interface DeckCardProps {
  deck: Deck;
  onPress?: () => void;
  onDelete?: (deckId: string) => void;
}

export default function DeckCard({ deck, onPress, onDelete }: DeckCardProps) {
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);

  const SWIPE_THRESHOLD = -80;

  const panGesture = Gesture.Pan()
    .onChange((event) => {
      // Only allow left swipe (negative values)
      if (event.translationX < 0) {
        translateX.value = event.translationX;
        // Add slight scale effect for feedback
        const scaleValue = 1 - Math.abs(event.translationX) * 0.001;
        scale.value = Math.max(scaleValue, 0.95);
      }
    })
    .onEnd((event) => {
      if (event.translationX < SWIPE_THRESHOLD) {
        // Trigger delete action
        runOnJS(setShowDeleteModal)(true);
      }
      // Reset position and scale
      translateX.value = withSpring(0);
      scale.value = withSpring(1);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: scale.value }
    ],
  }));

  const handleDeleteConfirm = () => {
    setShowDeleteModal(false);
    if (onDelete) {
      onDelete(deck.id);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
  };

  return (
    <>
      <View style={styles.cardContainer}>
        {/* Delete background */}
        <View style={[styles.deleteBackground, { backgroundColor: '#dc3545' }]}>
          <AntDesign name="delete" size={24} color="white" />
          <Text style={styles.deleteText}>Delete</Text>
        </View>

        {/* Card with gesture */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={animatedStyle}>
            <Card 
              style={{ backgroundColor }} 
              mode="outlined"
              onPress={onPress}
            >
              <Card.Content>
                <Text variant="titleMedium" style={{ color: textColor, marginBottom: 4 }}>
                  {deck.name}
                </Text>
                <Text variant="bodySmall" style={{ color: textColor + 'CC' }}>
                  {deck.cardCount} cards • Created {new Date(deck.createdAt).toLocaleDateString()}
                </Text>
              </Card.Content>
            </Card>
          </Animated.View>
        </GestureDetector>
      </View>

      <DeleteConfirmationModal
        visible={showDeleteModal}
        deckName={deck.name}
        onDismiss={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 12,
    position: 'relative',
  },
  deleteBackground: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  deleteText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});
