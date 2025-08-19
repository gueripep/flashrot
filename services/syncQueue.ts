import AsyncStorage from '@react-native-async-storage/async-storage';

export type GenericSyncOp<T> =
  | { type: 'create'; item: T; attempts?: number }
  | { type: 'update'; item: T; attempts?: number }
  | { type: 'delete'; itemId: string; attempts?: number };

export const getSyncQueue = async <T>(storageKey: string): Promise<GenericSyncOp<T>[]> => {
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading sync queue:', e);
    return [];
  }
};

export const setSyncQueue = async <T>(storageKey: string, queue: GenericSyncOp<T>[]) => {
  try {
    await AsyncStorage.setItem(storageKey, JSON.stringify(queue));
  } catch (e) {
    console.error('Error writing sync queue:', e);
  }
};

export const addToSyncQueue = async <T>(storageKey: string, op: GenericSyncOp<T>) => {
  const queue = await getSyncQueue<T>(storageKey);
  const normalized = { ...op, attempts: op.attempts ?? 0 };
  queue.push(normalized as GenericSyncOp<T>);
  await setSyncQueue(storageKey, queue);
};

export const removeFromSyncQueue = async <T>(storageKey: string, itemId: string) => {
  const queue = await getSyncQueue<T>(storageKey);
  const filtered = queue.filter(op => {
    if (op.type === 'delete') return op.itemId !== itemId;
    return (op as any).item?.id !== itemId;
  });
  await setSyncQueue(storageKey, filtered as GenericSyncOp<T>[]);
};

export const processSyncQueue = async <T>(
  storageKey: string,
  handlers: {
    create?: (item: T) => Promise<boolean>;
    update?: (item: T) => Promise<boolean>;
    delete?: (itemId: string) => Promise<boolean>;
  }
) => {
  const queue = await getSyncQueue<T>(storageKey);
  if (!queue.length) return;

  const newQueue: GenericSyncOp<T>[] = [];

  for (const op of queue) {
    try {
      let ok = false;
      if (op.type === 'create' && op.item && handlers.create) ok = await handlers.create(op.item);
      if (op.type === 'update' && op.item && handlers.update) ok = await handlers.update(op.item);
      if (op.type === 'delete' && op.itemId && handlers.delete) ok = await handlers.delete(op.itemId);

      if (!ok) {
        const nextAttempts = (op.attempts ?? 0) + 1;
        newQueue.push({ ...op, attempts: nextAttempts } as GenericSyncOp<T>);
      }
    } catch (e) {
      console.debug('processSyncQueue item failed:', e);
      const nextAttempts = (op.attempts ?? 0) + 1;
      newQueue.push({ ...op, attempts: nextAttempts } as GenericSyncOp<T>);
    }
  }

  await setSyncQueue(storageKey, newQueue);
};
