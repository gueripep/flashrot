import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

interface Deck {
  id: string;
  name: string;
  cardCount: number;
  createdAt: string;
}

const STORAGE_KEY = 'flashcardDecks';

export function useDecks() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDecks = async () => {
    try {
      setLoading(true);
      const storedDecks = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedDecks) {
        setDecks(JSON.parse(storedDecks));
      }
    } catch (error) {
      console.error('Error loading decks:', error);
      Alert.alert('Error', 'Failed to load decks');
    } finally {
      setLoading(false);
    }
  };

  const saveDeck = async (newDeck: Deck) => {
    try {
      const updatedDecks = [...decks, newDeck];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedDecks));
      setDecks(updatedDecks);
      return true;
    } catch (error) {
      console.error('Error saving deck:', error);
      Alert.alert('Error', 'Failed to save deck');
      return false;
    }
  };

  const deleteDeck = async (deckId: string) => {
    try {
      const updatedDecks = decks.filter(deck => deck.id !== deckId);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedDecks));
      setDecks(updatedDecks);
      return true;
    } catch (error) {
      console.error('Error deleting deck:', error);
      Alert.alert('Error', 'Failed to delete deck');
      return false;
    }
  };

  const updateDeck = async (deckId: string, updates: Partial<Deck>) => {
    try {
      const updatedDecks = decks.map(deck => 
        deck.id === deckId ? { ...deck, ...updates } : deck
      );
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedDecks));
      setDecks(updatedDecks);
      return true;
    } catch (error) {
      console.error('Error updating deck:', error);
      Alert.alert('Error', 'Failed to update deck');
      return false;
    }
  };

  const getDeckById = (deckId: string): Deck | undefined => {
    return decks.find(deck => deck.id === deckId);
  };

  // Load decks on hook initialization
  useEffect(() => {
    loadDecks();
  }, []);

  return {
    decks,
    loading,
    saveDeck,
    deleteDeck,
    updateDeck,
    getDeckById,
    refreshDecks: loadDecks,
  };
}
