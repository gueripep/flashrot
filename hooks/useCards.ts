import { aiService } from '@/services/aiService';
import { EnhancedFlashCard, fsrsService } from '@/services/fsrsService';
import { ttsService } from '@/services/ttsService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

// Keep FlashCard interface for backward compatibility, but use EnhancedFlashCard internally
export interface FlashCard {
  id: string;
  front: string;
  back: string;
  createdAt: string;
  deckId: string;
  questionAudio?: string;
  answerAudio?: string;
}

export function useCards(deckId: string) {
  const [cards, setCards] = useState<EnhancedFlashCard[]>([]);
  const [loading, setLoading] = useState(true);

  const STORAGE_KEY = `flashcards_${deckId}`;

  const validateAudioFiles = async (cards: EnhancedFlashCard[]): Promise<EnhancedFlashCard[]> => {
    const validatedCards = await Promise.all(
      cards.map(async (card) => {
        const validatedCard = { ...card };

        // Check if question audio file exists
        if (card.questionAudio) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(card.questionAudio);
            if (!fileInfo.exists) {
              validatedCard.questionAudio = undefined;
              console.warn(`Question audio file not found for card ${card.id}: ${card.questionAudio}`);
            }
          } catch (error) {
            validatedCard.questionAudio = undefined;
            console.warn(`Error checking question audio for card ${card.id}:`, error);
          }
        }

        // Check if answer audio file exists
        if (card.answerAudio) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(card.answerAudio);
            if (!fileInfo.exists) {
              validatedCard.answerAudio = undefined;
              console.warn(`Answer audio file not found for card ${card.id}: ${card.answerAudio}`);
            }
          } catch (error) {
            validatedCard.answerAudio = undefined;
            console.warn(`Error checking answer audio for card ${card.id}:`, error);
          }
        }

        return validatedCard;
      })
    );

    return validatedCards;
  };

  const loadCards = async () => {
    try {
      setLoading(true);
      const storedCards = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedCards) {
        const parsedCards: EnhancedFlashCard[] = JSON.parse(storedCards);

        // Ensure FSRS dates are properly converted to Date objects and add FSRS data if missing
        const processedCards = await Promise.all(
          parsedCards.map(async (card) => {
            // If card doesn't have FSRS data, create it
            if (!card.fsrs) {
              const fsrsData = fsrsService.createNewFSRSCard(card.id, card.deckId);
              card.fsrs = fsrsData;
            } else {
              // Ensure dates are Date objects
              if (card.fsrs.due && typeof card.fsrs.due === 'string') {
                card.fsrs.due = new Date(card.fsrs.due);
              }
              if (card.fsrs.last_review && typeof card.fsrs.last_review === 'string') {
                card.fsrs.last_review = new Date(card.fsrs.last_review);
              }
            }
            return card;
          })
        );

        // Validate that audio files still exist and clean up broken references
        const validatedCards = await validateAudioFiles(processedCards);

        // Save back to storage if any audio references were cleaned up or FSRS data was added
        const hasChanges = validatedCards.some((card, index) =>
          card.questionAudio !== parsedCards[index]?.questionAudio ||
          card.answerAudio !== parsedCards[index]?.answerAudio ||
          !parsedCards[index]?.fsrs
        );

        if (hasChanges) {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(validatedCards));
          console.log('Updated cards with FSRS data and cleaned up broken audio references for deck:', deckId);
        }

        setCards(validatedCards);
      } else {
        // No cards found, initialize with empty array
        setCards([]);
      }
    } catch (error) {
      console.error('Error loading cards:', error);
      Alert.alert('Error', 'Failed to load cards');
    } finally {
      setLoading(false);
    }
  };

  const saveCard = async (front: string, back: string) => {
    try {
      // Create the basic card first
      const baseCard: FlashCard = {
        id: Date.now().toString(),
        front: front.trim(),
        back: back.trim(),
        createdAt: new Date().toISOString(),
        deckId
      };

      // Create FSRS data for the new card
      const fsrsData = fsrsService.createNewFSRSCard(baseCard.id, deckId);

      // Create the enhanced card with FSRS data
      let finalCard: EnhancedFlashCard = {
        ...baseCard,
        fsrs: fsrsData
      };

      // Wait for AI reformulation of the answer (back) before generating TTS
      try {
        const reformulated = await aiService.reformulateAnswer(finalCard.front, finalCard.back);
        if (reformulated && reformulated !== finalCard.back) {
          finalCard = { ...finalCard, back: reformulated };
        }
      } catch (err) {
        console.warn('AI reformulation error:', err);
        // Continue with original text if AI reformulation fails
      }

      // Generate TTS audio using the final (potentially reformulated) text
      try {
        const audioData = await ttsService.generateCardAudio(
          finalCard.id,
          finalCard.front,
          finalCard.back
        );

        // Add audio file paths to the final card
        if (audioData.questionAudio || audioData.answerAudio) {
          finalCard = {
            ...finalCard,
            questionAudio: audioData.questionAudio || undefined,
            answerAudio: audioData.answerAudio || undefined
          };
        }
      } catch (audioError) {
        console.warn('Failed to generate audio for card:', audioError);
        // Continue without audio - don't fail the card creation
      }

      // Only save the card after all processing is complete
      const updatedCards = [...cards, finalCard];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCards));
      setCards(updatedCards);

      return true;
    } catch (error) {
      console.error('Error saving card:', error);
      Alert.alert('Error', 'Failed to save card');
      return false;
    }
  };

  const deleteCard = async (cardId: string) => {
    try {
      console.log('Deleting card:', cardId);
      // Find the card to get audio file paths
      const cardToDelete = cards.find(card => card.id === cardId);

      // Delete associated audio files
      await ttsService.deleteCardAudio(
        cardId,
        cardToDelete?.questionAudio,
        cardToDelete?.answerAudio
      );

      const updatedCards = cards.filter(card => card.id !== cardId);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCards));
      setCards(updatedCards);
      return true;
    } catch (error) {
      console.error('Error deleting card:', error);
      Alert.alert('Error', 'Failed to delete card');
      return false;
    }
  };

  const updateCard = async (cardId: string, front: string, back: string) => {
    try {
      const updatedCards = cards.map(card =>
        card.id === cardId
          ? { ...card, front: front.trim(), back: back.trim() }
          : card
      );
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCards));
      setCards(updatedCards);
      return true;
    } catch (error) {
      console.error('Error updating card:', error);
      Alert.alert('Error', 'Failed to update card');
      return false;
    }
  };

  const getCardById = (cardId: string): EnhancedFlashCard | undefined => {
    return cards.find(card => card.id === cardId);
  };

  // Load cards on hook initialization
  useEffect(() => {
    if (deckId) {
      loadCards();
    }
  }, [deckId]);

  return {
    cards,
    loading,
    saveCard,
    deleteCard,
    updateCard,
    getCardById,
    refreshCards: loadCards,
  };
}
