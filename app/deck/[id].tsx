import { AntDesign } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Button, Card, FAB, Text } from 'react-native-paper';

import { useDecks } from '@/hooks/useDecks';
import { useThemeColor } from '@/hooks/useThemeColor';

interface FlashCard {
  id: string;
  front: string;
  back: string;
  createdAt: string;
}

interface Deck {
  id: string;
  name: string;
  cardCount: number;
  createdAt: string;
  cards?: FlashCard[];
}

export default function DeckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const iconColor = useThemeColor({}, 'icon');
  const tintColor = useThemeColor({}, 'tint');
  
  const { decks, loading } = useDecks();
  const [currentDeck, setCurrentDeck] = useState<Deck | null>(null);
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (id && decks.length > 0) {
      const deck = decks.find(d => d.id === id);
      if (deck) {
        // Mock cards for now - replace with actual card data
        const mockCards: FlashCard[] = [
          {
            id: '1',
            front: 'What is React?',
            back: 'A JavaScript library for building user interfaces',
            createdAt: new Date().toISOString()
          },
          {
            id: '2',
            front: 'What is TypeScript?',
            back: 'A typed superset of JavaScript that compiles to plain JavaScript',
            createdAt: new Date().toISOString()
          }
        ];
        
        setCurrentDeck({
          ...deck,
          cards: mockCards,
          cardCount: mockCards.length
        });
      }
    }
  }, [id, decks]);

  const handleCardFlip = (cardId: string) => {
    setFlippedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const handleAddCard = () => {
    Alert.alert('Add Card', 'Add new flashcard functionality coming soon!');
  };

  const handleStartStudy = () => {
    Alert.alert('Study Mode', 'Study mode functionality coming soon!');
  };

  if (loading) {
    return (
      <ScrollView style={{ backgroundColor, padding: 16 }}>
        <Text variant="bodyLarge" style={{ color: textColor, textAlign: 'center', marginTop: 50 }}>
          Loading deck...
        </Text>
      </ScrollView>
    );
  }

  if (!currentDeck) {
    return (
      <ScrollView style={{ backgroundColor, padding: 16 }}>
        <Text variant="bodyLarge" style={{ color: textColor, textAlign: 'center', marginTop: 50 }}>
          Deck not found
        </Text>
        <Button mode="outlined" onPress={() => router.back()} style={{ marginTop: 20 }}>
          Go Back
        </Button>
      </ScrollView>
    );
  }

  return (
    <>
      <ScrollView style={{ backgroundColor, padding: 16 }}>
        {/* Header */}
        <Card style={[styles.headerCard, { backgroundColor }]}>
          <Card.Content>
            <Text variant="headlineMedium" style={{ color: textColor, marginBottom: 8 }}>
              {currentDeck.name}
            </Text>
            <Text variant="bodyMedium" style={{ color: textColor, opacity: 0.7 }}>
              {currentDeck.cardCount} {currentDeck.cardCount === 1 ? 'card' : 'cards'}
            </Text>
          </Card.Content>
          <Card.Actions>
            <Button mode="contained" onPress={handleStartStudy} style={styles.studyButton}>
              Start Studying
            </Button>
          </Card.Actions>
        </Card>

        {/* Cards List */}
        <Text variant="titleMedium" style={{ color: textColor, marginTop: 24, marginBottom: 16 }}>
          Flashcards
        </Text>

        {currentDeck.cards && currentDeck.cards.length > 0 ? (
          currentDeck.cards.map((card) => (
            <TouchableOpacity
              key={card.id}
              style={styles.cardContainer}
              onPress={() => handleCardFlip(card.id)}
              activeOpacity={0.7}
            >
              <Card style={[styles.flashCard, { backgroundColor }]}>
                <Card.Content style={styles.cardContent}>
                  <Text variant="bodySmall" style={{ color: textColor, opacity: 0.6, marginBottom: 8 }}>
                    {flippedCards.has(card.id) ? 'Back' : 'Front'}
                  </Text>
                  <Text variant="bodyLarge" style={{ color: textColor, textAlign: 'center' }}>
                    {flippedCards.has(card.id) ? card.back : card.front}
                  </Text>
                  <Text variant="bodySmall" style={{ color: textColor, opacity: 0.4, marginTop: 12 }}>
                    Tap to flip
                  </Text>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          ))
        ) : (
          <Card style={[styles.emptyCard, { backgroundColor }]}>
            <Card.Content style={styles.emptyCardContent}>
              <AntDesign name="plus" size={48} color={iconColor} style={{ opacity: 0.3 }} />
              <Text variant="bodyLarge" style={{ color: textColor, marginTop: 16, textAlign: 'center' }}>
                No cards yet
              </Text>
              <Text variant="bodyMedium" style={{ color: textColor, opacity: 0.6, textAlign: 'center' }}>
                Add your first flashcard to get started
              </Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: tintColor }]}
        onPress={handleAddCard}
        label="Add Card"
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    marginBottom: 8,
  },
  studyButton: {
    marginLeft: 'auto',
  },
  cardContainer: {
    marginBottom: 12,
  },
  flashCard: {
    minHeight: 120,
  },
  cardContent: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 100,
  },
  emptyCard: {
    marginTop: 32,
  },
  emptyCardContent: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});
