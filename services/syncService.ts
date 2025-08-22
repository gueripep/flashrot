import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/config';
import { fetchApiWithRefresh } from './authService';
import {
  addToSyncQueue,
  getSyncQueue,
  processSyncQueue as processGenericSyncQueue,
  removeFromSyncQueue,
} from './syncQueue';

export type SyncManagerOptions<T> = {
  resourcePath: string; // e.g. '/decks'
  storageKey: string; // local AsyncStorage key where items array is stored
  syncQueueKey: string; // key used by syncQueue
  getId: (item: T) => string;
  isUUID?: (id: string) => boolean;
  mapServerResponseToId?: (resp: any) => string | undefined;
  transformCreateBody?: (item: T) => any;
  transformUpdateBody?: (item: T) => any;
  updateLocalAfterSync?: (localId: string, updates: Partial<T>) => Promise<void>;
  // map a server response item into the local T shape; if omitted a best-effort merge is used
  mapServerToLocal?: (serverItem: any, localMatch?: T) => T;
  // optional callback to update in-memory state after writing merged storage
  updateState?: (arr: T[]) => void;
  // optional hook run before attempting to sync an update to the server.
  // If this hook throws an error the update will be treated as failed and
  // the operation will be enqueued for later retry.
  beforeUpdate?: (item: T) => Promise<void> | void;
};

const DEFAULT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createSyncManager<T>(opts: SyncManagerOptions<T>) {
  const isUUID = opts.isUUID ?? ((id: string) => DEFAULT_UUID_RE.test(id));

  const defaultUpdateLocalAfterSync = async (localId: string, updates: Partial<T>) => {
    try {
      const raw = await AsyncStorage.getItem(opts.storageKey);
      const arr: T[] = raw ? JSON.parse(raw) : [];
      const idx = arr.findIndex(i => opts.getId(i) === localId);
      if (idx >= 0) {
        arr[idx] = { ...arr[idx], ...(updates as any) };
        await AsyncStorage.setItem(opts.storageKey, JSON.stringify(arr));
      }
    } catch (e) {
      console.error('Error updating local item after sync:', e);
    }
  };

  const updateLocalAfterSync = opts.updateLocalAfterSync ?? defaultUpdateLocalAfterSync;

  const syncCreate = async (item: T): Promise<boolean> => {
    try {
      const body = opts.transformCreateBody ? opts.transformCreateBody(item) : item;
      const res = await fetchApiWithRefresh(`${API_BASE_URL}${opts.resourcePath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      const serverId = opts.mapServerResponseToId ? opts.mapServerResponseToId(data) : data?.id;
      await updateLocalAfterSync(opts.getId(item), { ...(serverId ? ({ id: serverId } as any) : {}), ...( { synced: true } as any) } as Partial<T>);
      await removeFromSyncQueue<T>(opts.syncQueueKey, opts.getId(item));
      return true;
    } catch (e) {
      console.debug('syncCreate failed:', e);
      return false;
    }
  };

  const syncUpdate = async (item: T): Promise<boolean> => {
    try {
      // Allow callers to run arbitrary code before performing the update.
      // If the hook throws we treat the update as failed so it will be
      // enqueued for later retry.
      if (opts.beforeUpdate) {
        try {
          await opts.beforeUpdate(item as T);
        } catch (hookErr) {
          console.error('beforeUpdate hook failed, aborting syncUpdate:', hookErr);
          return false;
        }
      }
      const localId = opts.getId(item);
      if (!isUUID(localId)) {
        return await syncCreate(item);
      }
      const body = opts.transformUpdateBody ? opts.transformUpdateBody(item) : item;
      const res = await fetchApiWithRefresh(`${API_BASE_URL}${opts.resourcePath}/${localId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      await updateLocalAfterSync(localId, { ...( { synced: true } as any) } as Partial<T>);
      await removeFromSyncQueue<T>(opts.syncQueueKey, localId);
      return true;
    } catch (e) {
      console.debug('syncUpdate failed:', e);
      return false;
    }
  };

  const syncDelete = async (itemId: string): Promise<boolean> => {
    try {
      const res = await fetchApiWithRefresh(`${API_BASE_URL}${opts.resourcePath}/${itemId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      await removeFromSyncQueue<T>(opts.syncQueueKey, itemId);
      return true;
    } catch (e) {
      console.debug('syncDelete failed:', e);
      return false;
    }
  };

  const enqueueCreate = async (item: T) => {
    try {
      const ok = await syncCreate(item);
      if (!ok) await addToSyncQueue<T>(opts.syncQueueKey, { type: 'create', item });
    } catch (e) {
      console.error('enqueueCreate error:', e);
      await addToSyncQueue<T>(opts.syncQueueKey, { type: 'create', item });
    }
  };

  const enqueueUpdate = async (item: T) => {
    try {
      let ok: boolean;
      const id = opts.getId(item);
      if (isUUID(id)) {
        ok = await syncUpdate(item);
        if (!ok) await addToSyncQueue<T>(opts.syncQueueKey, { type: 'update', item });
      } else {
        ok = await syncCreate(item);
        if (!ok) await addToSyncQueue<T>(opts.syncQueueKey, { type: 'create', item });
      }
    } catch (e) {
      console.error('enqueueUpdate error:', e);
      const id = opts.getId(item);
      if (isUUID(id)) {
        await addToSyncQueue<T>(opts.syncQueueKey, { type: 'update', item });
      } else {
        await addToSyncQueue<T>(opts.syncQueueKey, { type: 'create', item });
      }
    }
  };

  const enqueueDelete = async (itemId: string) => {
    try {
      const ok = await syncDelete(itemId);
      if (!ok) await addToSyncQueue<T>(opts.syncQueueKey, { type: 'delete', itemId });
    } catch (e) {
      console.error('enqueueDelete error:', e);
      await addToSyncQueue<T>(opts.syncQueueKey, { type: 'delete', itemId });
    }
  };

  const processQueue = async () => {
    await processGenericSyncQueue<T>(opts.syncQueueKey, {
      create: syncCreate,
      update: syncUpdate,
      delete: syncDelete,
    });
  };

  const fetchAndMerge = async () => {
    console.log('[fetchAndMerge] Starting fetch and merge for', opts.resourcePath);
    try {
      console.log('[fetchAndMerge] Fetching from server:', `${API_BASE_URL}${opts.resourcePath}/`);
      const res = await fetchApiWithRefresh(`${API_BASE_URL}${opts.resourcePath}/`);
      if (!res.ok) {
        console.log('[fetchAndMerge] Server returned error status:', res.status);
        throw new Error(`Server returned ${res.status}`);
      }
      const serverItems: any[] = await res.json();
      console.log('[fetchAndMerge] Server items:', serverItems);

      const raw = await AsyncStorage.getItem(opts.storageKey);
      const localItems: T[] = raw ? JSON.parse(raw) : [];
      console.log('[fetchAndMerge] Local items:', localItems);

      const merged: T[] = [];
      const seenLocalIds = new Set<string>();

      for (const si of serverItems) {
        const serverId = opts.mapServerResponseToId ? opts.mapServerResponseToId(si) : si.id ?? si.uuid;
        const localMatch = serverId ? localItems.find(li => opts.getId(li) === serverId) : undefined;

        let mapped: T;
        if (opts.mapServerToLocal) {
          mapped = opts.mapServerToLocal(si, localMatch);
          console.log('[fetchAndMerge] Used custom mapServerToLocal for server item:', serverId, mapped);
        } else {
          // best-effort generic mapping: prefer localMatch fields, overlay server fields, set id to server/local
          const base: any = localMatch ? { ...(localMatch as any) } : {};
          const serverCopy = { ...(si as any) };
          base.id = (localMatch as any)?.id ?? (serverId ?? `${serverCopy.name}-${serverCopy.createdAt}`);
          const mergedObj = { ...base, ...serverCopy, synced: true };
          mapped = mergedObj as T;
          console.log('[fetchAndMerge] Merged server/local item:', serverId, mapped);
        }

        merged.push(mapped);
        if (localMatch) seenLocalIds.add(opts.getId(localMatch));
      }

      // include local-only items only if present in sync queue
      const syncQueue = await getSyncQueue<T>(opts.syncQueueKey);
      console.log('[fetchAndMerge] Sync queue:', syncQueue);
      const queuedIds = new Set<string>();
      for (const op of syncQueue) {
        if (op.type === 'delete' && 'itemId' in op && op.itemId) {
          queuedIds.add(op.itemId as string);
          console.log('[fetchAndMerge] Queued delete for itemId:', op.itemId);
        }
        if ((op.type === 'create' || op.type === 'update') && 'item' in op && op.item) {
          queuedIds.add((op as any).item.id);
          console.log('[fetchAndMerge] Queued', op.type, 'for item id:', (op as any).item.id);
        }
      }

      for (const li of localItems) {
        const localId = opts.getId(li);
        if (!seenLocalIds.has(localId)) {
          if (queuedIds.has(localId)) {
            merged.push(li);
            console.log('[fetchAndMerge] Including local-only item in queue:', localId);
          } else {
            console.log('[fetchAndMerge] Dropping local-only item not in sync queue:', localId);
          }
        }
      }

      console.log('[fetchAndMerge] Final merged items:', merged);
      await AsyncStorage.setItem(opts.storageKey, JSON.stringify(merged));
      if (opts.updateState) {
        console.log('[fetchAndMerge] Calling updateState callback');
        opts.updateState(merged);
      }
      return merged;
    } catch (e) {
      console.log('fetchAndMerge failed:', e);
      return null;
    }
  };

  return {
    enqueueCreate,
    enqueueUpdate,
    enqueueDelete,
    processQueue,
  fetchAndMerge,
    // expose handlers in case callers want to pass them elsewhere
    handlers: { create: syncCreate, update: syncUpdate, delete: syncDelete },
  };
}
