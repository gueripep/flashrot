import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { Button, Card, Chip, FAB, Text } from "react-native-paper";

import DebugPanel from "@/components/DebugPanel";
import EmptyCardState from "@/components/EmptyCardState";
import FlashCardItem from "@/components/FlashCardItem";
import StudyStatsCard from "@/components/StudyStatsCard";
import AddCardModal from "@/components/modals/AddCardModal";
import DeleteConfirmationModal from "@/components/modals/DeleteConfirmationModal";
import { useCards } from "@/hooks/useCards";
import { useDecks } from "@/hooks/useDecks";
import { useFSRSStudy } from "@/hooks/useFSRSStudy";
import { useThemeColor } from "@/hooks/useThemeColor";
import { FlashCard } from "@/services/fsrsService";

interface Deck {
  id: string;
  name: string;
  cardCount: number;
  createdAt: string;
  cards?: FlashCard[];
}

export default function DeckScreen() {
  // Constants
  const FSRS_REFRESH_DELAY = 500;
  const FOCUS_REFRESH_DELAY = 300;

  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const textColor = useThemeColor({}, "text");
  const backgroundColor = useThemeColor({}, "background");
  const cardBackgroundColor = useThemeColor({}, "cardBackground");
  const tintColor = useThemeColor({}, "tint");
  const successColor = useThemeColor({}, "success");
  const warningColor = "#fd7e14";

  const { decks, loading: decksLoading, updateDeck } = useDecks();
  const {
    cards,
    loading: cardsLoading,
    saveCard,
    deleteCard,
    updateCard,
    refreshCards,
  } = useCards(id || "");
  const {
    studyStats,
    hasCardsForReview,
    loading: fsrsLoading,
    refreshData: refreshFSRSData,
  } = useFSRSStudy(id || "", cards);

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
        title: currentDeck.name,
      });
    }
  }, [currentDeck, navigation]);

  useEffect(() => {
    if (id && decks.length > 0) {
      const deck = decks.find((d) => d.id === id);
      if (deck) {
        // const card = cards.filter((c) => c.deck_id === deck.id);
        setCurrentDeck({
          ...deck,
          cards: cards,
          cardCount: cards.length,
        });
      }
    }
  }, [id, decks, cards]);

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

  // Refresh stats when returning from study sessions (debounced)
  useFocusEffect(
    useCallback(() => {
      // Only refresh if we have cards and the loading is done
      if (cards.length > 0 && !fsrsLoading) {
        // Small delay to avoid rapid calls
        const timer = setTimeout(() => {
          refreshFSRSData();
        }, FOCUS_REFRESH_DELAY);

        return () => clearTimeout(timer);
      }
    }, [cards.length, fsrsLoading, refreshFSRSData])
  );

  // Helper functions for managing flipped cards
  const updateFlippedCards = (cardId: string, action: "toggle" | "remove") => {
    setFlippedCards((prev) => {
      const newSet = new Set(prev);
      if (action === "remove") {
        newSet.delete(cardId);
      } else if (action === "toggle") {
        if (newSet.has(cardId)) {
          newSet.delete(cardId);
        } else {
          newSet.add(cardId);
        }
      }
      return newSet;
    });
  };

  const handleCardFlip = (cardId: string) => {
    updateFlippedCards(cardId, "toggle");
  };

  const handleAddCard = () => {
    setEditingCard(null);
    setShowAddCardModal(true);
  };

  const handleEditCard = (card: FlashCard) => {
    setEditingCard(card);
    setShowAddCardModal(true);
  };

  // Centralized card deletion logic
  const deleteCardAndRefresh = async (cardId: string) => {
    const success = await deleteCard(cardId);
    if (success) {
      updateFlippedCards(cardId, "remove");
      // Refresh FSRS data after successful deletion with a delay
      setTimeout(() => {
        refreshFSRSData();
      }, FSRS_REFRESH_DELAY);
    }
    return success;
  };

  const handleDeleteConfirm = async (card: FlashCard) => {
    await deleteCardAndRefresh(card.id);
  };

  const handleSaveCard = async (front: string, back: string, useAI = false) => {
    let result;
    if (editingCard) {
      result = await updateCard(editingCard.id, front, back, editingCard.stage);
    } else {
      result = await saveCard(front, back);
    }

    // Refresh FSRS data after card operation (but only for new cards)
    // For existing cards, the data should update automatically via the useEffect
    if (result && !editingCard) {
      // Small delay to ensure the card is saved before refreshing
      setTimeout(() => {
        refreshFSRSData();
      }, FSRS_REFRESH_DELAY);
    }
    setShowAddCardModal(false);
    return result;
  };

  const handleConfirmDelete = async () => {
    if (selectedCard) {
      const success = await deleteCardAndRefresh(selectedCard.id);
      setSelectedCard(null);
      return success;
    }
    return false;
  };

  const handleStartStudy = (mode: "review" | "all" | "new" = "review") => {
    if (currentDeck && cards && cards.length > 0) {
      router.push({
        pathname: "/study/[id]",
        params: {
          id: id,
          mode: mode,
        },
      });
    } else {
      Alert.alert(
        "No Cards",
        "Add some flashcards before starting a study session."
      );
    }
  };

  if (loading) {
    return (
      <ScrollView style={{ backgroundColor, padding: 16 }}>
        <Text
          variant="bodyLarge"
          style={{ color: textColor, textAlign: "center", marginTop: 50 }}
        >
          Loading deck...
        </Text>
      </ScrollView>
    );
  }

  if (!currentDeck) {
    return (
      <ScrollView style={[styles.scrollView, { backgroundColor }]}>
        <Text
          variant="bodyLarge"
          style={{ color: textColor, textAlign: "center", marginTop: 50 }}
        >
          Deck not found
        </Text>
        <Button
          mode="outlined"
          onPress={() => router.back()}
          style={{ marginTop: 20 }}
        >
          Go Back
        </Button>
      </ScrollView>
    );
  }

  return (
    <>
      <ScrollView
        style={[styles.scrollView, { backgroundColor }]}
        contentContainerStyle={styles.scrollViewContent}
      >
        <View style={styles.wrapper}>
          <DebugPanel deckId={id || ""} allCards={cards} />

          {/* Header */}
          <Card
            style={[
              styles.headerCard,
              { backgroundColor: cardBackgroundColor },
            ]}
          >
            <Card.Content>
              <View style={styles.headerContent}>
                <View style={styles.titleSection}>
                  <Text
                    variant="headlineMedium"
                    style={{ color: textColor, marginBottom: 8 }}
                  >
                    {currentDeck.name}
                  </Text>
                  <Text
                    variant="bodyMedium"
                    style={{ color: textColor, opacity: 0.7 }}
                  >
                    {currentDeck.cardCount}{" "}
                    {currentDeck.cardCount === 1 ? "card" : "cards"}
                  </Text>
                </View>

                {/* Study Status */}
                {cardsForReview && (
                  <Chip
                    icon="clock-alert-outline"
                    style={{ backgroundColor: warningColor + "20" }}
                    textStyle={{ color: warningColor, fontWeight: "600" }}
                  >
                    Cards due for review
                  </Chip>
                )}
              </View>
            </Card.Content>

            <Card.Actions style={styles.studyActions}>
              <View style={styles.studyButtonContainer}>
                <Button
                  mode="contained"
                  onPress={() => handleStartStudy("review")}
                  style={[
                    styles.studyButton,
                    { backgroundColor: cardsForReview ? warningColor : "#999" },
                  ]}
                  textColor="white"
                  disabled={!cardsForReview}
                >
                  Review Due
                </Button>
                {!cardsForReview && (
                  <Text
                    variant="bodySmall"
                    style={{
                      color: textColor,
                      opacity: 0.6,
                      marginTop: 4,
                      textAlign: "center",
                    }}
                  >
                    No cards due for review
                  </Text>
                )}
              </View>
            </Card.Actions>
          </Card>

          {/* Study Statistics */}
          <StudyStatsCard
            stats={studyStats}
            loading={fsrsLoading && !!studyStats}
          />

          {/* Cards List */}
          <Text
            variant="titleMedium"
            style={{ color: textColor, marginTop: 24, marginBottom: 16 }}
          >
            Flashcards
          </Text>
          <View style={{ marginBottom: 32 }}>
            {currentDeck.cards && currentDeck.cards.length > 0 ? (
              currentDeck.cards.map((card) => (
                <FlashCardItem
                  key={card.id}
                  card={card}
                  isFlipped={flippedCards.has(card.id)}
                  onFlip={handleCardFlip}
                  onEdit={handleEditCard}
                  onDelete={handleDeleteConfirm}
                />
              ))
            ) : (
              <EmptyCardState />
            )}
          </View>
        </View>
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
        initialCard={
          editingCard
            ? {
                front: editingCard.final_card.front,
                back: editingCard.final_card.back,
              }
            : null
        }
        mode={editingCard ? "edit" : "add"}
      />

      <DeleteConfirmationModal
        visible={showDeleteModal}
        onDismiss={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        deckName={selectedCard?.final_card.front || "this card"}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    padding: 16,
  },
  scrollViewContent: {
    alignItems: "center"
  },
  wrapper: {
    maxWidth: 900,
    width: "100%",
  },
  headerCard: {
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  titleSection: {
    flex: 1,
  },
  studyActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    paddingTop: 8,
  },
  studyButtonContainer: {
    alignItems: "center",
  },
  studyButton: {
    minWidth: 120,
  },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
  },
});
