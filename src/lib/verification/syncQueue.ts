/**
 * The offline write queue for the field interface.
 *
 * A field verifier walks a school with a tablet in a district where the signal comes and goes.
 * The brief says offline-first with a sync queue, and the requirement behind that phrase is
 * simple to state and easy to get wrong: nothing the verifier types may be lost, and nothing may
 * be recorded twice.
 *
 * The design decisions, and why.
 *
 * Writes are keyed, not appended. A finding is identified by the visit and the indicator, so
 * changing an observed level three times while standing in a classroom leaves one pending write,
 * not three. An append-only log would flush all three and make the stored value depend on which
 * arrived last, which over a flaky connection is not the same as which was typed last.
 *
 * The queue is therefore a map, and its flush order is insertion order of the *first* write for
 * each key. That keeps the sequence a verifier would expect while still collapsing edits.
 *
 * Failures are retained, not dropped. A write that fails stays pending with its attempt count
 * raised, so a lost connection mid-flush leaves the queue intact. Nothing here decides to give
 * up: a queue that discards after n attempts loses a verifier's morning, and the honest failure
 * is a visible unsynced count they can act on.
 *
 * Replay is safe because the server writes are upserts on the same key. That is what lets this
 * retry blindly rather than having to reason about what already landed.
 */

export type QueuedWriteKind = 'FINDING' | 'SPOT_CHECK';

export type QueuedWrite = {
  /** Stable within a visit: kind plus the thing being written about. */
  key: string;
  kind: QueuedWriteKind;
  visitId: string;
  /** The payload the action will be called with. Opaque here on purpose. */
  payload: Record<string, unknown>;
  /** When the verifier first made this change, not when it was last edited. */
  queuedAt: number;
  /**
   * Bumped every time the payload is replaced. This is what closes the mid-flight race: a flush
   * that started sending revision 2 must not acknowledge away revision 3, typed while the request
   * was on the wire. Without it, the newest value a verifier entered would be the one that never
   * reached the server.
   */
  revision: number;
  attempts: number;
  lastError: string | null;
};

export type SyncQueue = {
  writes: QueuedWrite[];
};

export const EMPTY_QUEUE: SyncQueue = { writes: [] };

export function findingKey(visitId: string, parameterId: string): string {
  return `FINDING:${visitId}:${parameterId}`;
}

export function spotCheckKey(visitId: string, classLevel: number, rollPosition: number): string {
  return `SPOT_CHECK:${visitId}:${classLevel}:${rollPosition}`;
}

/**
 * Add or replace a pending write.
 *
 * Keeps the original `queuedAt` when replacing, so the flush order does not shuffle every time a
 * verifier corrects a value. Resets the attempt count and error, because a corrected payload has
 * not failed yet and inheriting the old failure would make it look worse than it is.
 */
export function enqueue(
  queue: SyncQueue,
  write: Omit<QueuedWrite, 'attempts' | 'lastError' | 'revision'>,
): SyncQueue {
  const existing = queue.writes.find((w) => w.key === write.key);
  const next: QueuedWrite = {
    ...write,
    queuedAt: existing?.queuedAt ?? write.queuedAt,
    revision: (existing?.revision ?? 0) + 1,
    attempts: 0,
    lastError: null,
  };
  return {
    writes: existing
      ? queue.writes.map((w) => (w.key === write.key ? next : w))
      : [...queue.writes, next],
  };
}

/**
 * Remove a write that landed.
 *
 * When the caller says which revision it sent, only that revision is removed. A write replaced
 * while its predecessor was in flight stays queued, because what landed is not what the verifier
 * now wants stored.
 */
export function acknowledge(queue: SyncQueue, key: string, revision?: number): SyncQueue {
  return {
    writes: queue.writes.filter(
      (w) => w.key !== key || (revision !== undefined && w.revision !== revision),
    ),
  };
}

/**
 * Keep a write that failed, and record why. The same revision guard as acknowledge: a failure of
 * the old payload says nothing about the new one.
 */
export function recordFailure(
  queue: SyncQueue,
  key: string,
  error: string,
  revision?: number,
): SyncQueue {
  return {
    writes: queue.writes.map((w) =>
      w.key === key && (revision === undefined || w.revision === revision)
        ? { ...w, attempts: w.attempts + 1, lastError: error }
        : w,
    ),
  };
}

/**
 * The order to flush in: oldest first.
 *
 * Oldest rather than fewest-attempts, so a write that keeps failing does not starve the ones
 * behind it, and so the server sees changes roughly in the order they were made.
 */
export function flushOrder(queue: SyncQueue): QueuedWrite[] {
  return [...queue.writes].sort((a, b) => a.queuedAt - b.queuedAt || a.key.localeCompare(b.key));
}

export type QueueStatus = {
  pending: number;
  failing: number;
  /** True when everything the verifier typed has reached the server. */
  clean: boolean;
  oldestPendingAt: number | null;
};

export function queueStatus(queue: SyncQueue): QueueStatus {
  const pending = queue.writes.length;
  return {
    pending,
    failing: queue.writes.filter((w) => w.attempts > 0).length,
    clean: pending === 0,
    oldestPendingAt:
      pending === 0 ? null : Math.min(...queue.writes.map((w) => w.queuedAt)),
  };
}

/**
 * Whether the visit may be signed off.
 *
 * Sign-off is the verifier asserting the record is complete and correct, so it must not happen
 * while writes are still sitting on the device. Signing off with a queue would produce a signed
 * report that changes afterwards, which is the one thing a signature is supposed to rule out.
 */
export function canSignOff(queue: SyncQueue): { ok: boolean; reason: string | null } {
  const status = queueStatus(queue);
  if (!status.clean) {
    return {
      ok: false,
      reason: `${status.pending} ${status.pending === 1 ? 'change has' : 'changes have'} not reached the server yet. Find a signal and sync before signing off.`,
    };
  }
  return { ok: true, reason: null };
}
