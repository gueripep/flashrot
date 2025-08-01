import { ttsService } from '@/services/ttsService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

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
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [loading, setLoading] = useState(true);

  const STORAGE_KEY = `flashcards_${deckId}`;

  const loadCards = async () => {
    try {
      setLoading(true);
      const storedCards = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedCards) {
        setCards(JSON.parse(storedCards));
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

  const saveCard = async (front: string, back: string, generateAudio: boolean = true) => {
    try {
      const newCard: FlashCard = {
        id: Date.now().toString(),
        front: front.trim(),
        back: back.trim(),
        createdAt: new Date().toISOString(),
        deckId
      };
      
      const updatedCards = [...cards, newCard];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCards));
      setCards(updatedCards);

      // Generate TTS audio in the background
      if (generateAudio) {
        try {
          const audioData = await ttsService.generateCardAudio(
            newCard.id,
            newCard.front,
            newCard.back
          );
          
          // Update the card with audio paths
          if (audioData.questionAudio || audioData.answerAudio) {
            const cardWithAudio = {
              ...newCard,
              questionAudio: audioData.questionAudio || undefined,
              answerAudio: audioData.answerAudio || undefined
            };
            
            const cardsWithAudio = updatedCards.map(card => 
              card.id === newCard.id ? cardWithAudio : card
            );
            
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cardsWithAudio));
            setCards(cardsWithAudio);
          }
        } catch (audioError) {
          console.warn('Failed to generate audio for card:', audioError);
          // Don't fail the card creation if audio generation fails
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error saving card:', error);
      Alert.alert('Error', 'Failed to save card');
      return false;
    }
  };

  const deleteCard = async (cardId: string) => {
    try {
      // Delete associated audio files
      await ttsService.deleteCardAudio(cardId);
      
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

  const getCardById = (cardId: string): FlashCard | undefined => {
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
