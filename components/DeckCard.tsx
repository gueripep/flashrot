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
    const [isGestureActive, setIsGestureActive] = useState(false);

    const cardBackgroundColor = useThemeColor({}, 'cardBackground');

    const SWIPE_THRESHOLD = -100;
    const GESTURE_THRESHOLD = 10; // Minimum movement to consider it a gesture
    const MAX_SWIPE_DISTANCE = -180; // Maximum distance the card can be swiped

    const panGesture = Gesture.Pan()
        .onBegin(() => {
            runOnJS(setIsGestureActive)(false);
        })
        .onChange((event) => {
            // Only allow left swipe (negative values)
            if (event.translationX < 0) {
                // Clamp the translation to the maximum swipe distance
                const clampedTranslation = Math.max(event.translationX, MAX_SWIPE_DISTANCE);
                translateX.value = clampedTranslation;
                // Mark as gesture active if moved beyond threshold
                if (Math.abs(event.translationX) > GESTURE_THRESHOLD) {
                    runOnJS(setIsGestureActive)(true);
                }
            }
        })
        .onEnd((event) => {
            const wasGestureActive = Math.abs(event.translationX) > GESTURE_THRESHOLD;
            
            if (event.translationX < SWIPE_THRESHOLD) {
                // Trigger delete action
                runOnJS(setShowDeleteModal)(true);
            }
            // Reset position and scale
            translateX.value = withSpring(0);
            scale.value = withSpring(1);
            
            // Reset gesture state after a short delay if there was significant movement
            if (wasGestureActive) {
                setTimeout(() => {
                    runOnJS(setIsGestureActive)(false);
                }, 150);
            } else {
                runOnJS(setIsGestureActive)(false);
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { scale: scale.value }
        ],
    }));

    const deleteIconStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value / 2 }
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

    const handleCardPress = () => {
        // Only trigger onPress if no gesture was active
        if (!isGestureActive && onPress) {
            onPress();
        }
    };

    return (
        <>
            <View style={styles.cardContainer}>
                {/* Delete background */}
                <View style={styles.deleteBackground}>
                    <Animated.View style={deleteIconStyle}>
                        <AntDesign name="delete" size={24} color="white" />
                    </Animated.View>
                </View>

                {/* Card with gesture */}
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={animatedStyle}>
                        <Card
                            style={[{ backgroundColor: cardBackgroundColor }, styles.card]}
                            onPress={handleCardPress}
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
        width: '100%',
    },
    deleteBackground: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        left: '50%',
        justifyContent: 'center',
        alignItems: 'flex-end',
        backgroundColor: '#dc3545',
        borderRadius: 0,
    },
    deleteText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
    },
    card: {
        borderRadius: 0,
        width: '100%',
    },
});
