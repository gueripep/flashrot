import { useThemeColor } from '@/hooks/useThemeColor';
import { AntDesign } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
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
    const GESTURE_THRESHOLD = 10;
    const MAX_SWIPE_DISTANCE = -180;

    // Reset gesture state when modal closes
    useEffect(() => {
        if (!showDeleteModal) {
            const timer = setTimeout(() => {
                setIsGestureActive(false);
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [showDeleteModal]);

    // Safe wrapper for runOnJS calls
    const setGestureActive = (active: boolean) => {
        'worklet';
        runOnJS(setIsGestureActive)(active);
    };

    const showModal = () => {
        'worklet';
        runOnJS(setShowDeleteModal)(true);
    };

    const panGesture = Gesture.Pan()
        .onBegin(() => {
            setGestureActive(false);
        })
        .onChange((event) => {
            if (event.translationX < 0) {
                const clampedTranslation = Math.max(event.translationX, MAX_SWIPE_DISTANCE);
                translateX.value = clampedTranslation;
                
                if (Math.abs(event.translationX) > GESTURE_THRESHOLD) {
                    setGestureActive(true);
                }
            }
        })
        .onEnd((event) => {
            const wasGestureActive = Math.abs(event.translationX) > GESTURE_THRESHOLD;
            
            if (event.translationX < SWIPE_THRESHOLD) {
                showModal();
            }
            
            translateX.value = withSpring(0);
            scale.value = withSpring(1);
            
            // Use a simpler approach to reset gesture state
            if (!wasGestureActive) {
                setGestureActive(false);
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
        setIsGestureActive(false);
        if (onDelete) {
            onDelete(deck.id);
        }
    };

    const handleDeleteCancel = () => {
        setShowDeleteModal(false);
        setIsGestureActive(false);
    };

    const handleCardPress = () => {
        // Add a small delay to ensure gesture state is accurate
        setTimeout(() => {
            if (!isGestureActive && onPress) {
                onPress();
            }
        }, 50);
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
