/**
 * Where a waiting clip lives between being filmed and reaching the server: IndexedDB on the
 * school's own phone.
 *
 * It has to be IndexedDB rather than memory or localStorage. Memory loses the recording the
 * moment the browser reclaims the tab, which on a cheap phone is often; localStorage holds
 * strings, and a video is a blob. IndexedDB stores a File as a File.
 *
 * Every operation fails soft and returns nothing rather than throwing. A private window, full
 * storage or a browser that has simply decided not to cooperate must not take the screen down
 * with it: the outbox then behaves as an in-session one, which is worse but still works, and
 * the screen says only what it can honestly promise.
 */

import type { PendingClip } from './clipQueue';

const DB_NAME = 'sssa-clip-outbox';
const STORE = 'pending';
const VERSION = 1;

/** The File is stored as-is; everything else is plain. Keyed by session and task together, so
 *  two sessions for one school can never overwrite each other's outbox. */
type StoredClip = PendingClip & { key: string };

const keyFor = (sessionId: string, parameterId: string) => `${sessionId}::${parameterId}`;

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return open().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        try {
          const tx = db.transaction(STORE, mode);
          const req = work(tx.objectStore(STORE));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
          tx.onabort = () => resolve(null);
          tx.oncomplete = () => db.close();
        } catch {
          resolve(null);
        }
      }),
  );
}

/** Write the clip before anything is attempted, so a failed upload costs nothing. */
export async function putClip(clip: PendingClip): Promise<void> {
  const stored: StoredClip = { ...clip, key: keyFor(clip.sessionId, clip.parameterId) };
  await run('readwrite', (store) => store.put(stored));
}

export async function deleteClip(sessionId: string, parameterId: string): Promise<void> {
  await run('readwrite', (store) => store.delete(keyFor(sessionId, parameterId)));
}

/** Everything still waiting for this session, for the screen to pick up where it left off. */
export async function loadClips(sessionId: string): Promise<PendingClip[]> {
  const rows = await run<StoredClip[]>('readonly', (store) => store.getAll() as IDBRequest<StoredClip[]>);
  if (!rows) return [];
  return rows
    .filter((r) => r.sessionId === sessionId && r.file instanceof File)
    .map(({ key: _key, ...clip }) => clip);
}

/** Whether a clip written now would still be here after the phone is locked and reopened.
 *  The screen promises persistence only when this is true. */
export async function storeAvailable(): Promise<boolean> {
  const db = await open();
  if (!db) return false;
  db.close();
  return true;
}
