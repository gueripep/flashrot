import { createSyncManager } from '@/services/syncService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

export interface Deck {
  id: string;
  name: string;
  card_count: number;
  created_at: string;
  // optional fields for sync bookkeeping
  synced?: boolean;
}

export type DeckCreateBody = {
  name: string;
};


const STORAGE_KEY = 'flashcardDecks';
const SYNC_QUEUE_KEY = 'flashcardDecksSyncQueue';

function isUUID(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}


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
      // after loading local decks, try to flush local changes to server
      await processSyncQueue();
      // then fetch authoritative decks from server and merge
      await syncManager.fetchAndMerge();
      const newStoredDecks = await AsyncStorage.getItem(STORAGE_KEY);
      console.log('After fetchAndMerge, storedDecks:', newStoredDecks);
      if (newStoredDecks) {
        setDecks(JSON.parse(newStoredDecks));
      }
    } catch (error) {
      console.error('Error loading decks:', error);
      Alert.alert('Error', 'Failed to load decks');
    } finally {
      setLoading(false);
    }
  };

  const saveDeck = async (newDeckCreateBody: DeckCreateBody) => {
    try {
      const newDeck = {
        id: new Date().toISOString(),
        name: newDeckCreateBody.name,
        card_count: 0,
        created_at: new Date().toISOString(),
      };
      const updatedDecks = [...decks, newDeck];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedDecks));
      setDecks(updatedDecks);
      enqueueDeckForSync(newDeck).catch(err => {
        console.debug('enqueueDeckForSync error:', err);
      });
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
      //if it is not an uuid it means the deck was not saved on servers
      if (isUUID(deckId)) {
        // try to delete remotely, enqueue on failure
        enqueueDeleteForSync(deckId).catch(err => console.debug('enqueueDeleteForSync err', err));
      }
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
      // try to sync update remotely; enqueue on failure
      const updatedLocal = updatedDecks.find(d => d.id === deckId);
      if (updatedLocal) enqueueUpdateForSync(updatedLocal).catch(err => console.debug('enqueueUpdateForSync err', err));
      return true;
    } catch (error) {
      console.error('Error updating deck:', error);
      Alert.alert('Error', 'Failed to update deck');
      return false;
    }
  };

  /* ---------- Background Sync helpers (generic) ---------- */
  // Generic sync queue operations are provided by services/syncQueue.ts

  // create a generic sync manager for Deck
  const syncManager = createSyncManager<Deck>({
    resourcePath: '/decks',
    storageKey: STORAGE_KEY,
    syncQueueKey: SYNC_QUEUE_KEY,
    getId: (d) => d.id,
    mapServerResponseToId: (resp) => resp?.id ?? resp?.uuid,
    transformCreateBody: (d): DeckCreateBody => ({ name: d.name }),
    transformUpdateBody: (d) => ({ name: d.name, card_count: d.card_count, created_at: d.created_at }),
    updateLocalAfterSync: async (localId, updates) => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const localDecks: Deck[] = raw ? JSON.parse(raw) : [];
        const idx = localDecks.findIndex(d => d.id === localId);
        if (idx >= 0) {
          localDecks[idx] = { ...localDecks[idx], ...updates };
        }
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(localDecks));
        setDecks(localDecks);
      } catch (e) {
        console.error('Error updating local deck after sync:', e);
      }
    },
  });

  const enqueueDeckForSync = syncManager.enqueueCreate;
  const enqueueUpdateForSync = syncManager.enqueueUpdate;
  const enqueueDeleteForSync = syncManager.enqueueDelete;
  const processSyncQueue = syncManager.processQueue;

  /* ---------- Fetch from server and merge ---------- */

  // use syncManager.fetchAndMerge() instead of local implementation


  const getDeckById = (deckId: string): Deck | undefined => {
    return decks.find(deck => deck.id === deckId);
  };

  // Load decks on hook initialization
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    loadDecks();
    // attempt any pending syncs when the hook initializes
    processSyncQueue();
    // set up periodic retry every 30 seconds while mounted
    interval = setInterval(() => {
      processSyncQueue();
    }, 30_000);

    return () => {
      if (interval) clearInterval(interval);
    };
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
