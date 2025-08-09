import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { useThemeColor } from '@/hooks/useThemeColor';
import { AntDesign } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { Card, Text } from 'react-native-paper';
import Animated from 'react-native-reanimated';
import DeleteConfirmationModal from './modals/DeleteConfirmationModal';

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
    const cardBackgroundColor = useThemeColor({}, 'cardBackground');
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const {
        panGesture,
        isGestureActive,
        animatedStyle,
        leftActionStyle,
        leftBackgroundStyle,
        resetGestureState,
    } = useSwipeGesture({
        onSwipeLeft: () => setShowDeleteModal(true),
        enableVerticalGestureCheck: false, // DeckCard doesn't need vertical gesture check
    });

    // Reset gesture state when modal closes
    useEffect(() => {
        if (!showDeleteModal) {
            const timer = setTimeout(() => {
                resetGestureState();
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [showDeleteModal, resetGestureState]);

    const handleDeleteConfirm = () => {
        setShowDeleteModal(false);
        resetGestureState();
        if (onDelete) {
            onDelete(deck.id);
        }
    };

    const handleDeleteCancel = () => {
        setShowDeleteModal(false);
        resetGestureState();
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
                <Animated.View style={[styles.deleteBackground, leftBackgroundStyle]}>
                    <Animated.View style={leftActionStyle}>
                        <AntDesign name="delete" size={24} color="white" />
                    </Animated.View>
                </Animated.View>

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
