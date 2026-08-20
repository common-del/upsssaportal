'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  acknowledge,
  canSignOff,
  EMPTY_QUEUE,
  enqueue,
  flushOrder,
  queueStatus,
  recordFailure,
  type QueuedWrite,
  type SyncQueue,
} from '@/lib/verification/syncQueue';

/**
 * The offline queue, persisted on the device.
 *
 * localStorage rather than IndexedDB, deliberately. The queue holds tens of small records for one
 * visit, not thousands, and localStorage is synchronous, which matters here: a tablet losing power
 * or a browser being killed mid-write must not leave a half-committed queue. IndexedDB would be
 * the right answer for photo blobs, which is why photos are uploaded immediately when there is a
 * connection rather than queued.
 *
 * Keyed per visit so two visits in one day cannot bleed into each other, and so clearing one does
 * not lose the other.
 *
 * The flush is serial, not parallel. Sending twenty writes at once over a weak connection tends to
 * fail all twenty; one at a time means a drop costs one write and the rest stay queued.
 */

export type FlushFn = (write: QueuedWrite) => Promise<{ success: boolean; error?: string }>;

function storageKey(visitId: string) {
  return `sqaaf.fieldqueue.${visitId}`;
}

function load(visitId: string): SyncQueue {
  if (typeof window === 'undefined') return EMPTY_QUEUE;
  try {
    const raw = window.localStorage.getItem(storageKey(visitId));
    if (!raw) return EMPTY_QUEUE;
    const parsed = JSON.parse(raw) as SyncQueue;
    return Array.isArray(parsed.writes) ? parsed : EMPTY_QUEUE;
  } catch {
    // A corrupt queue is worse than an empty one only if it is silently trusted. Starting clean
    // loses at most the unsynced tail; parsing garbage would break the whole screen.
    return EMPTY_QUEUE;
  }
}

function save(visitId: string, queue: SyncQueue) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(visitId), JSON.stringify(queue));
  } catch {
    // Storage full or blocked. Nothing useful to do here: the in-memory queue still works for
    // this session, and the status line already tells the verifier what has not synced.
  }
}

export function useSyncQueue(visitId: string, flush: FlushFn) {
  const [queue, setQueue] = useState<SyncQueue>(EMPTY_QUEUE);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const flushRef = useRef(flush);
  flushRef.current = flush;

  // Hydrated in an effect rather than in the initial state, because localStorage is not available
  // during server rendering and reading it in a useState initialiser would break hydration.
  useEffect(() => {
    setQueue(load(visitId));
    setOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
  }, [visitId]);

  useEffect(() => {
    save(visitId, queue);
  }, [visitId, queue]);

  const add = useCallback(
    (write: Omit<QueuedWrite, 'attempts' | 'lastError' | 'revision'>) => {
      setQueue((q) => enqueue(q, write));
    },
    [],
  );

  const runFlush = useCallback(async () => {
    setSyncing(true);
    try {
      // Read the queue through the setter rather than closing over it, so a write added during the
      // flush is not lost when this finishes.
      let working: SyncQueue = EMPTY_QUEUE;
      setQueue((q) => {
        working = q;
        return q;
      });
      for (const write of flushOrder(working)) {
        const res = await flushRef.current(write);
        // The revision pins the acknowledgement to what was actually sent: an edit made while
        // this request was on the wire re-queued the key at a higher revision and must survive.
        setQueue((q) =>
          res.success
            ? acknowledge(q, write.key, write.revision)
            : recordFailure(q, write.key, res.error ?? 'Failed', write.revision),
        );
        // Stop at the first failure. Continuing through a dead connection just raises every
        // attempt count and tells the verifier nothing new.
        if (!res.success) break;
      }
    } finally {
      setSyncing(false);
    }
  }, []);

  // Flush when the connection comes back, which is the whole point: a verifier who walks out of a
  // dead spot should not have to remember to press anything.
  useEffect(() => {
    function goOnline() {
      setOnline(true);
      void runFlush();
    }
    function goOffline() {
      setOnline(false);
    }
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [runFlush]);

  // And opportunistically, so a queue left by a previous session does not sit there.
  useEffect(() => {
    if (online && queue.writes.length > 0 && !syncing) {
      const t = setTimeout(() => void runFlush(), 1500);
      return () => clearTimeout(t);
    }
  }, [online, queue.writes.length, syncing, runFlush]);

  return {
    queue,
    status: queueStatus(queue),
    signOffCheck: canSignOff(queue),
    online,
    syncing,
    add,
    flushNow: runFlush,
  };
}
