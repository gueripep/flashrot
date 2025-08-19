import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/config';
import { fetchApiWithRefresh } from './authService';
import {
    addToSyncQueue,
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
        // merge
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
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

  return {
    enqueueCreate,
    enqueueUpdate,
    enqueueDelete,
    processQueue,
    // expose handlers in case callers want to pass them elsewhere
    handlers: { create: syncCreate, update: syncUpdate, delete: syncDelete },
  };
}
