import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useLayoutEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Button, Card, Chip, FAB, Text } from 'react-native-paper';

import DebugPanel from '@/components/DebugPanel';
import EmptyCardState from '@/components/EmptyCardState';
import FlashCardItem from '@/components/FlashCardItem';
import StudyStatsCard from '@/components/StudyStatsCard';
import AddCardModal from '@/components/modals/AddCardModal';
import DeleteConfirmationModal from '@/components/modals/DeleteConfirmationModal';
import { FlashCard, useCards } from '@/hooks/useCards';
import { useDecks } from '@/hooks/useDecks';
import { useFSRSStudy } from '@/hooks/useFSRSStudy';
import { useThemeColor } from '@/hooks/useThemeColor';

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
  const navigation = useNavigation();
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const cardBackgroundColor = useThemeColor({}, 'cardBackground');
  const tintColor = useThemeColor({}, 'tint');
  const successColor = useThemeColor({}, 'success');
  const warningColor = '#fd7e14';
  
  const { decks, loading: decksLoading, updateDeck } = useDecks();
  const { cards, loading: cardsLoading, saveCard, deleteCard, updateCard, refreshCards } = useCards(id || '');
  const { 
    studyStats, 
    hasCardsForReview,
    loading: fsrsLoading 
  } = useFSRSStudy(id || '', cards);
  
  const [currentDeck, setCurrentDeck] = useState<Deck | null>(null);
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<FlashCard | null>(null);
  const [editingCard, setEditingCard] = useState<FlashCard | null>(null);
  const [cardsForReview, setCardsForReview] = useState<boolean>(false);

  const loading = decksLoading || cardsLoading;

  // Set the header title dynamically
  useLayoutEffect(() => {
    if (currentDeck) {
      navigation.setOptions({
        title: currentDeck.name
      });
    }
  }, [currentDeck, navigation]);

  useEffect(() => {
    if (id && decks.length > 0) {
      const deck = decks.find(d => d.id === id);
      if (deck) {
        setCurrentDeck({
          ...deck,
          cards: cards,
          cardCount: cards.length
        });
      }
    }
  }, [id, decks, cards]);

  // Update deck card count when cards change
  useEffect(() => {
    if (currentDeck && cards.length !== currentDeck.cardCount) {
      updateDeck(currentDeck.id, { cardCount: cards.length });
    }
  }, [cards.length, currentDeck, updateDeck]);

  // Check for cards due for review
  useEffect(() => {
    const checkForReviewCards = async () => {
      if (id && cards.length > 0) {
        const hasDueCards = await hasCardsForReview();
        setCardsForReview(hasDueCards);
      }
    };
    
    checkForReviewCards();
  }, [id, cards, hasCardsForReview]);

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
    setEditingCard(null);
    setShowAddCardModal(true);
  };

  const handleEditCard = (card: FlashCard) => {
    setEditingCard(card);
    setShowAddCardModal(true);
  };

  const handleDeleteCard = (card: FlashCard) => {
    setSelectedCard(card);
    setShowDeleteModal(true);
  };

  const handleSaveCard = async (front: string, back: string, generateAudio: boolean = true) => {
    if (editingCard) {
      return await updateCard(editingCard.id, front, back);
    } else {
      return await saveCard(front, back, generateAudio);
    }
  };

  const handleConfirmDelete = async () => {
    if (selectedCard) {
      const success = await deleteCard(selectedCard.id);
      if (success) {
        setFlippedCards(prev => {
          const newSet = new Set(prev);
          newSet.delete(selectedCard.id);
          return newSet;
        });
      }
      setSelectedCard(null);
      return success;
    }
    return false;
  };

  const handleStartStudy = (mode: 'review' | 'all' | 'new' = 'review') => {
    if (currentDeck && cards && cards.length > 0) {
      router.push({
        pathname: '/study/[id]',
        params: { 
          id: id,
          mode: mode
        }
      });
    } else {
      Alert.alert('No Cards', 'Add some flashcards before starting a study session.');
    }
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
        <DebugPanel deckId={id || ''} allCards={cards} />

        {/* Header */}
        <Card style={[styles.headerCard, { backgroundColor: cardBackgroundColor }]}>
          <Card.Content>
            <View style={styles.headerContent}>
              <View style={styles.titleSection}>
                <Text variant="headlineMedium" style={{ color: textColor, marginBottom: 8 }}>
                  {currentDeck.name}
                </Text>
                <Text variant="bodyMedium" style={{ color: textColor, opacity: 0.7 }}>
                  {currentDeck.cardCount} {currentDeck.cardCount === 1 ? 'card' : 'cards'}
                </Text>
              </View>
              
              {/* Study Status */}
              {cardsForReview && (
                <Chip 
                  icon="clock-alert-outline" 
                  style={{ backgroundColor: warningColor + '20' }}
                  textStyle={{ color: warningColor, fontWeight: '600' }}
                >
                  Cards due for review
                </Chip>
              )}
            </View>
          </Card.Content>
          
          <Card.Actions style={styles.studyActions}>
            <Button 
              mode="outlined" 
              onPress={() => handleStartStudy('all')}
              style={[styles.studyButton, { borderColor: tintColor }]}
              textColor={tintColor}
            >
              Study All
            </Button>
            
            {cardsForReview && (
              <Button 
                mode="contained" 
                onPress={() => handleStartStudy('review')}
                style={[styles.studyButton, { backgroundColor: warningColor }]}
                textColor="white"
              >
                Review Due
              </Button>
            )}
            
            {!cardsForReview && (
              <Button 
                mode="contained" 
                onPress={() => handleStartStudy('new')}
                style={[styles.studyButton, { backgroundColor: tintColor }]}
                textColor="white"
              >
                Start Studying
              </Button>
            )}
          </Card.Actions>
        </Card>

        {/* Study Statistics */}
        <StudyStatsCard stats={studyStats} loading={fsrsLoading} />

        {/* Cards List */}
        <Text variant="titleMedium" style={{ color: textColor, marginTop: 24, marginBottom: 16 }}>
          Flashcards
        </Text>

        {currentDeck.cards && currentDeck.cards.length > 0 ? (
          currentDeck.cards.map((card) => (
            <FlashCardItem
              key={card.id}
              card={card}
              isFlipped={flippedCards.has(card.id)}
              onFlip={handleCardFlip}
              onEdit={handleEditCard}
              onDelete={handleDeleteCard}
            />
          ))
        ) : (
          <EmptyCardState />
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: tintColor }]}
        onPress={handleAddCard}
        label="Add Card"
      />

      {/* Modals */}
      <AddCardModal
        visible={showAddCardModal}
        onDismiss={() => setShowAddCardModal(false)}
        onSaveCard={handleSaveCard}
        initialCard={editingCard ? { front: editingCard.front, back: editingCard.back } : null}
        mode={editingCard ? 'edit' : 'add'}
      />

      <DeleteConfirmationModal
        visible={showDeleteModal}
        onDismiss={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        deckName={selectedCard?.front || 'this card'}
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleSection: {
    flex: 1,
  },
  studyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 8,
  },
  studyButton: {
    minWidth: 120,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});
