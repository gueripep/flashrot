import { fsrsService } from '@/services/fsrsService';
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
  remoteId?: string;
}

const STORAGE_KEY = 'flashcardDecks';
const SYNC_QUEUE_KEY = 'flashcardDecksSyncQueue';

type SyncOp =
  | { type: 'create'; deck: Deck; attempts?: number }
  | { type: 'update'; deck: Deck; attempts?: number }
  | { type: 'delete'; deckId: string; attempts?: number };

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

  /* ---------- Background Sync helpers ---------- */

  const getSyncQueue = async (): Promise<SyncOp[]> => {
    try {
      const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Error reading sync queue:', e);
      return [];
    }
  };

  const setSyncQueue = async (queue: SyncOp[]) => {
    try {
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error('Error writing sync queue:', e);
    }
  };

  const addToSyncQueue = async (op: SyncOp) => {
    const queue = await getSyncQueue();
    // ensure attempts is set (default 0)
    // we don't increment here; attempts is incremented by the processor
    // so newly enqueued items start with 0
    // keep the original object shape
    const normalized = { ...op, attempts: op.attempts ?? 0 };
    queue.push(normalized as SyncOp);
    await setSyncQueue(queue);
  };

  const removeFromSyncQueue = async (deckId: string) => {
    const queue = await getSyncQueue();
    const filtered = queue.filter(op => {
      if (op.type === 'delete') return op.deckId !== deckId;
      return op.deck?.id !== deckId;
    });
    await setSyncQueue(filtered as SyncOp[]);
  };

  const updateLocalDeckAfterSync = async (deckId: string, updates: Partial<Deck>) => {
    try {
      // Read latest stored decks to avoid stale closures and race conditions
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const localDecks: Deck[] = raw ? JSON.parse(raw) : [];

      // Try to find by local id first, then by remoteId as a fallback
      const idx = localDecks.findIndex(d => d.id === deckId);
      if (idx >= 0) {
        localDecks[idx] = { ...localDecks[idx], ...updates };
      } else {
        const altIdx = localDecks.findIndex(d => d.remoteId && d.remoteId === deckId);
        if (altIdx >= 0) {
          localDecks[altIdx] = { ...localDecks[altIdx], ...updates };
        }
      }

      // Persist and update state with the freshest array reference
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
      const remoteId = data.id ?? data.remoteId ?? undefined;
      await updateLocalDeckAfterSync(deck.id, { synced: true, id: remoteId });
      await removeFromSyncQueue(deck.id);
      return true;
    } catch (e) {
      console.debug('syncCreate failed:', e);
      return false;
    }
  };

  const syncUpdate = async (deck: Deck) => {
    try {
      const targetId = deck.remoteId ?? deck.id;
      const headers = { 'Content-Type': 'application/json', ...(await getAuthHeaders()) };
      const res = await fetch(`${API_BASE_URL}/decks/${targetId}`, {
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
      const remoteId = data.id ?? data.remoteId ?? deck.remoteId;
      await updateLocalDeckAfterSync(deck.id, { synced: true, id: remoteId });
      await removeFromSyncQueue(deck.id);
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
      await removeFromSyncQueue(deckId);
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
      if (!ok) await addToSyncQueue({ type: 'create', deck });
    } catch (e) {
      console.error('enqueueDeckForSync error:', e);
      await addToSyncQueue({ type: 'create', deck });
    }
  };

  const enqueueUpdateForSync = async (deck: Deck) => {
    try {
      const ok = await syncUpdate(deck);
      if (!ok) await addToSyncQueue({ type: 'update', deck });
    } catch (e) {
      console.error('enqueueUpdateForSync error:', e);
      await addToSyncQueue({ type: 'update', deck });
    }
  };

  const enqueueDeleteForSync = async (deckId: string) => {
    try {
      const ok = await syncDelete(deckId);
      if (!ok) await addToSyncQueue({ type: 'delete', deckId });
    } catch (e) {
      console.error('enqueueDeleteForSync error:', e);
      await addToSyncQueue({ type: 'delete', deckId });
    }
  };

  const processSyncQueue = async () => {
    const MAX_RETRIES = 2;
    const queue = await getSyncQueue();
    if (!queue.length) return;

    const newQueue: SyncOp[] = [];

    for (const op of queue) {
      // drop items that have already exhausted retries
      if ((op.attempts ?? 0) >= MAX_RETRIES) {
        console.debug('Dropping sync op after max attempts:', op);
        continue;
      }

      try {
        // eslint-disable-next-line no-await-in-loop
        let ok = false;
        if (op.type === 'create' && op.deck) ok = await syncCreate(op.deck);
        if (op.type === 'update' && op.deck) ok = await syncUpdate(op.deck);
        if (op.type === 'delete' && op.deckId) ok = await syncDelete(op.deckId);

        if (!ok) {
          // increment attempts and requeue
          const nextAttempts = (op.attempts ?? 0) + 1;
          const attempted = { ...op, attempts: nextAttempts } as SyncOp;
          if (nextAttempts >= MAX_RETRIES) {
            console.debug('Reached max attempts, will drop op:', attempted);
          } else {
            newQueue.push(attempted);
          }
        }
      } catch (e) {
        console.debug('processSyncQueue item failed:', e);
        const nextAttempts = (op.attempts ?? 0) + 1;
        const attempted = { ...op, attempts: nextAttempts } as SyncOp;
        if (nextAttempts < MAX_RETRIES) newQueue.push(attempted);
        else console.debug('Reached max attempts due to exception, dropping op:', attempted);
      }
    }

    // persist the updated queue
    await setSyncQueue(newQueue);
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
        // server's primary id is treated as remoteId
        const remoteId = sd.id ?? sd.remoteId ?? undefined;
        // try to find matching local deck by remoteId or by id
        const localMatch = localDecks.find(ld => (ld.remoteId && ld.remoteId === remoteId) || ld.id === remoteId || ld.id === sd.id);

        const mapped: Deck = {
          id: localMatch?.id ?? (remoteId ?? sd.uuid ?? `${sd.name}-${sd.createdAt}`),
          name: sd.name ?? localMatch?.name ?? 'Untitled',
          cardCount: sd.cardCount ?? localMatch?.cardCount ?? 0,
          createdAt: sd.createdAt ?? localMatch?.createdAt ?? new Date().toISOString(),
          synced: true,
          remoteId: remoteId,
        };

        merged.push(mapped);
        if (localMatch) seenLocalIds.add(localMatch.id);
      }

      // include any local-only decks that are pending sync (present in the sync queue)
      // per requirement: if a deck is local-only, not on the web, and not referenced in the sync queue, drop it
      const syncQueue = await getSyncQueue();
      const queuedIds = new Set<string>();
      for (const op of syncQueue) {
        if (op.type === 'delete' && 'deckId' in op && op.deckId) queuedIds.add(op.deckId);
        if ((op.type === 'create' || op.type === 'update') && 'deck' in op && op.deck) queuedIds.add(op.deck.id);
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
