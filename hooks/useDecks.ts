import { fsrsService } from '@/services/fsrsService';
import {
  addToSyncQueue,
  getSyncQueue,
  processSyncQueue as processGenericSyncQueue,
  removeFromSyncQueue,
} from '@/services/syncQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { API_BASE_URL } from '../constants/config';
import { fetchApiWithRefresh, getAuthHeaders } from '../services/authService';

interface Deck {
  id: string;
  name: string;
  cardCount: number;
  createdAt: string;
  // optional fields for sync bookkeeping
  synced?: boolean;
}

const STORAGE_KEY = 'flashcardDecks';
const SYNC_QUEUE_KEY = 'flashcardDecksSyncQueue';


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
      await fetchAndMergeFromServer();
      fsrsService.debugAsyncStorage();
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
      // Try to sync to server in background; if it fails we enqueue for retry
      enqueueDeckForSync(newDeck).catch(err => {
        // already handled in enqueue; swallow here but log for debug
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

  const updateLocalDeckAfterSync = async (deckId: string, updates: Partial<Deck>) => {
    try {
      // Read latest stored decks to avoid stale closures and race conditions
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const localDecks: Deck[] = raw ? JSON.parse(raw) : [];
      const idx = localDecks.findIndex(d => d.id === deckId);
      if (idx >= 0) {
        localDecks[idx] = { ...localDecks[idx], ...updates };
      }

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(localDecks));
      setDecks(localDecks);
    } catch (e) {
      console.error('Error updating local deck after sync:', e);
    }
  };

  const syncCreate = async (deck: Deck) => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      const res = await fetchApiWithRefresh(`${API_BASE_URL}/decks/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: deck.name,
        }),
      });

      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      const data = await res.json();
      await updateLocalDeckAfterSync(deck.id, { synced: true, id: data.id });
      await removeFromSyncQueue<Deck>(SYNC_QUEUE_KEY, deck.id);
      return true;
    } catch (e) {
      console.debug('syncCreate failed:', e);
      return false;
    }
  };

  const syncUpdate = async (deck: Deck) => {
    try {
      // If the deck doesn't have a server UUID id yet, treat as create
      if (!isUUID(deck.id)) {
        return await syncCreate(deck);
      }

      const headers = { 'Content-Type': 'application/json', ...(await getAuthHeaders()) };
      const res = await fetch(`${API_BASE_URL}/decks/${deck.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          name: deck.name,
          cardCount: deck.cardCount,
          createdAt: deck.createdAt,
        }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      await updateLocalDeckAfterSync(deck.id, { synced: true });
      await removeFromSyncQueue<Deck>(SYNC_QUEUE_KEY, deck.id);
      return true;
    } catch (e) {
      console.debug('syncUpdate failed:', e);
      return false;
    }
  };

  const syncDelete = async (deckId: string) => {
    try {
      const res = await fetchApiWithRefresh(`${API_BASE_URL}/decks/${deckId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      await removeFromSyncQueue<Deck>(SYNC_QUEUE_KEY, deckId);
      return true;
    } catch (e) {
      console.debug('syncDelete failed:', e);
      return false;
    }
  };

  function isUUID(id: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  }

  const enqueueDeckForSync = async (deck: Deck) => {
    // Try an immediate sync; if fails, persist to queue
    try {
      const ok = await syncCreate(deck);
      if (!ok) await addToSyncQueue<Deck>(SYNC_QUEUE_KEY, { type: 'create', item: deck });
    } catch (e) {
      console.error('enqueueDeckForSync error:', e);
      await addToSyncQueue<Deck>(SYNC_QUEUE_KEY, { type: 'create', item: deck });
    }
  };

  const enqueueUpdateForSync = async (deck: Deck) => {
    try {
      // If deck.id is not a UUID it hasn't been created on the server yet
      // so perform a create instead. Enqueue the appropriate op on failure.
      let ok: boolean;
      if (isUUID(deck.id)) {
        ok = await syncUpdate(deck);
        if (!ok) await addToSyncQueue<Deck>(SYNC_QUEUE_KEY, { type: 'update', item: deck });
      } else {
        ok = await syncCreate(deck);
        if (!ok) await addToSyncQueue<Deck>(SYNC_QUEUE_KEY, { type: 'create', item: deck });
      }
    } catch (e) {
      console.error('enqueueUpdateForSync error:', e);
      if (isUUID(deck.id)) {
        await addToSyncQueue<Deck>(SYNC_QUEUE_KEY, { type: 'update', item: deck });
      } else {
        await addToSyncQueue<Deck>(SYNC_QUEUE_KEY, { type: 'create', item: deck });
      }
    }
  };

  const enqueueDeleteForSync = async (deckId: string) => {
    try {
      const ok = await syncDelete(deckId);
      if (!ok) await addToSyncQueue<Deck>(SYNC_QUEUE_KEY, { type: 'delete', itemId: deckId });
    } catch (e) {
      console.error('enqueueDeleteForSync error:', e);
      await addToSyncQueue<Deck>(SYNC_QUEUE_KEY, { type: 'delete', itemId: deckId });
    }
  };
  const processSyncQueue = async () => {
    await processGenericSyncQueue<Deck>(SYNC_QUEUE_KEY, {
      create: syncCreate,
      update: syncUpdate,
      delete: syncDelete,
    });
  };

  /* ---------- Fetch from server and merge ---------- */

  const fetchAndMergeFromServer = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/decks/`, { headers: await getAuthHeaders() });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const serverDecks: any[] = await res.json();

      // read latest local storage to avoid overwriting changes
      const localRaw = await AsyncStorage.getItem(STORAGE_KEY);
      const localDecks: Deck[] = localRaw ? JSON.parse(localRaw) : [];

      const merged: Deck[] = [];

      const seenLocalIds = new Set<string>();

      for (const sd of serverDecks) {
        // server's primary id is the canonical id (usually a UUID)
        const serverId = sd.id ?? sd.uuid ?? undefined;
        // try to find matching local deck by id
        const localMatch = serverId ? localDecks.find(ld => ld.id === serverId) : undefined;

        const mapped: Deck = {
          id: localMatch?.id ?? (serverId ?? `${sd.name}-${sd.createdAt}`),
          name: sd.name ?? localMatch?.name ?? 'Untitled',
          cardCount: sd.cardCount ?? localMatch?.cardCount ?? 0,
          createdAt: sd.createdAt ?? localMatch?.createdAt ?? new Date().toISOString(),
          synced: true,
        };

        merged.push(mapped);
        if (localMatch) seenLocalIds.add(localMatch.id);
      }

      // include any local-only decks that are pending sync (present in the sync queue)
      // per requirement: if a deck is local-only, not on the web, and not referenced in the sync queue, drop it
      const syncQueue = await getSyncQueue<Deck>(SYNC_QUEUE_KEY);
      const queuedIds = new Set<string>();
      for (const op of syncQueue) {
        if (op.type === 'delete' && 'itemId' in op && op.itemId) queuedIds.add(op.itemId);
        if ((op.type === 'create' || op.type === 'update') && 'item' in op && op.item) queuedIds.add((op as any).item.id);
      }

      for (const ld of localDecks) {
        if (!seenLocalIds.has(ld.id)) {
          // keep only if there's a pending sync operation for it
          if (queuedIds.has(ld.id)) {
            merged.push(ld);
          } else {
            console.debug('Dropping local-only deck not in sync queue:', ld.id);
          }
        }
      }

      // persist merged set and update state
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      setDecks(merged);
    } catch (e) {
      // network error or server down - keep local decks as-is
      console.debug('fetchAndMergeFromServer failed:', e);
    }
  };


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
