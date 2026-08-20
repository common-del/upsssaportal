import { describe, expect, it } from 'vitest';
import {
  acknowledge,
  canSignOff,
  EMPTY_QUEUE,
  enqueue,
  findingKey,
  flushOrder,
  queueStatus,
  recordFailure,
  spotCheckKey,
  type SyncQueue,
} from './syncQueue';

const finding = (visitId: string, parameterId: string, level: number, at: number) => ({
  key: findingKey(visitId, parameterId),
  kind: 'FINDING' as const,
  visitId,
  payload: { parameterId, observedLevel: level },
  queuedAt: at,
});

describe('writes collapse per indicator rather than accumulating', () => {
  // A verifier changing their mind three times while standing in a classroom must leave one
  // pending write. Three would make the stored value depend on which arrived last over a flaky
  // connection, which is not the same as which was typed last.
  it('keeps one pending write per indicator however many times it is edited', () => {
    let q: SyncQueue = EMPTY_QUEUE;
    q = enqueue(q, finding('v1', 'p1', 1, 1000));
    q = enqueue(q, finding('v1', 'p1', 2, 2000));
    q = enqueue(q, finding('v1', 'p1', 3, 3000));
    expect(q.writes).toHaveLength(1);
    expect(q.writes[0]!.payload.observedLevel).toBe(3);
  });

  // Otherwise the flush order shuffles every time a value is corrected, and the server sees
  // changes in an order the verifier would not recognise.
  it('keeps the original queue time when replacing, so the order does not shuffle', () => {
    let q: SyncQueue = EMPTY_QUEUE;
    q = enqueue(q, finding('v1', 'p1', 1, 1000));
    q = enqueue(q, finding('v1', 'p1', 2, 9000));
    expect(q.writes[0]!.queuedAt).toBe(1000);
  });

  it('keeps separate writes for separate indicators and separate visits', () => {
    let q: SyncQueue = EMPTY_QUEUE;
    q = enqueue(q, finding('v1', 'p1', 1, 1000));
    q = enqueue(q, finding('v1', 'p2', 1, 1100));
    q = enqueue(q, finding('v2', 'p1', 1, 1200));
    expect(q.writes).toHaveLength(3);
  });

  it('keys spot checks by class and roll position', () => {
    expect(spotCheckKey('v1', 5, 12)).not.toBe(spotCheckKey('v1', 5, 13));
    expect(spotCheckKey('v1', 5, 12)).not.toBe(spotCheckKey('v1', 6, 12));
  });
});

describe('failures are kept, not dropped', () => {
  // A queue that discards after n attempts loses a verifier's morning. The honest failure is a
  // visible unsynced count they can act on.
  it('retains a failed write and counts the attempt', () => {
    let q = enqueue(EMPTY_QUEUE, finding('v1', 'p1', 2, 1000));
    q = recordFailure(q, findingKey('v1', 'p1'), 'Network unreachable');
    expect(q.writes).toHaveLength(1);
    expect(q.writes[0]!.attempts).toBe(1);
    expect(q.writes[0]!.lastError).toBe('Network unreachable');
  });

  it('counts repeated failures without ever dropping the write', () => {
    let q = enqueue(EMPTY_QUEUE, finding('v1', 'p1', 2, 1000));
    for (let i = 0; i < 25; i++) q = recordFailure(q, findingKey('v1', 'p1'), 'offline');
    expect(q.writes).toHaveLength(1);
    expect(q.writes[0]!.attempts).toBe(25);
  });

  // A corrected payload has not failed yet, and inheriting the old failure would make it look
  // worse than it is.
  it('clears the failure when the verifier edits the value again', () => {
    let q = enqueue(EMPTY_QUEUE, finding('v1', 'p1', 2, 1000));
    q = recordFailure(q, findingKey('v1', 'p1'), 'offline');
    q = enqueue(q, finding('v1', 'p1', 3, 5000));
    expect(q.writes[0]!.attempts).toBe(0);
    expect(q.writes[0]!.lastError).toBeNull();
  });

  it('removes a write once it lands', () => {
    let q = enqueue(EMPTY_QUEUE, finding('v1', 'p1', 2, 1000));
    q = acknowledge(q, findingKey('v1', 'p1'));
    expect(q.writes).toEqual([]);
  });

  it('ignores an acknowledgement for something not queued', () => {
    const q = enqueue(EMPTY_QUEUE, finding('v1', 'p1', 2, 1000));
    expect(acknowledge(q, findingKey('v1', 'other')).writes).toHaveLength(1);
  });
});

describe('the mid-flight edit race', () => {
  // The sequence: the flush picks up revision 1 and sends it; while the request is on the wire
  // the verifier changes the value, which re-queues the key as revision 2; the request then
  // succeeds. Acknowledging by key alone would delete revision 2, and the newest value a
  // verifier typed would be exactly the one that never reached the server.
  it('keeps a write replaced while its predecessor was in flight', () => {
    let q = enqueue(EMPTY_QUEUE, finding('v1', 'p1', 1, 1000));
    const sent = q.writes[0]!;
    q = enqueue(q, finding('v1', 'p1', 2, 2000));
    q = acknowledge(q, sent.key, sent.revision);
    expect(q.writes).toHaveLength(1);
    expect(q.writes[0]!.payload.observedLevel).toBe(2);
  });

  it('removes the write when nothing replaced it in flight', () => {
    const q = enqueue(EMPTY_QUEUE, finding('v1', 'p1', 1, 1000));
    const sent = q.writes[0]!;
    expect(acknowledge(q, sent.key, sent.revision).writes).toEqual([]);
  });

  // The mirror image for failures: a failure of the old payload says nothing about the new one,
  // which has not been tried yet.
  it('does not mark a replaced write as failing when the old revision fails', () => {
    let q = enqueue(EMPTY_QUEUE, finding('v1', 'p1', 1, 1000));
    const sent = q.writes[0]!;
    q = enqueue(q, finding('v1', 'p1', 2, 2000));
    q = recordFailure(q, sent.key, 'offline', sent.revision);
    expect(q.writes[0]!.attempts).toBe(0);
    expect(q.writes[0]!.lastError).toBeNull();
  });
});

describe('flush order', () => {
  it('sends oldest first', () => {
    let q: SyncQueue = EMPTY_QUEUE;
    q = enqueue(q, finding('v1', 'p3', 1, 3000));
    q = enqueue(q, finding('v1', 'p1', 1, 1000));
    q = enqueue(q, finding('v1', 'p2', 1, 2000));
    expect(flushOrder(q).map((w) => w.payload.parameterId)).toEqual(['p1', 'p2', 'p3']);
  });

  // A repeatedly failing write must not starve the ones behind it.
  it('does not push a failing write to the back', () => {
    let q: SyncQueue = EMPTY_QUEUE;
    q = enqueue(q, finding('v1', 'p1', 1, 1000));
    q = enqueue(q, finding('v1', 'p2', 1, 2000));
    q = recordFailure(q, findingKey('v1', 'p1'), 'offline');
    expect(flushOrder(q)[0]!.payload.parameterId).toBe('p1');
  });

  it('is stable for writes queued in the same millisecond', () => {
    let q: SyncQueue = EMPTY_QUEUE;
    q = enqueue(q, finding('v1', 'pb', 1, 1000));
    q = enqueue(q, finding('v1', 'pa', 1, 1000));
    expect(flushOrder(q).map((w) => w.payload.parameterId)).toEqual(['pa', 'pb']);
  });
});

describe('status and sign-off', () => {
  it('reports a clean queue', () => {
    expect(queueStatus(EMPTY_QUEUE)).toEqual({
      pending: 0,
      failing: 0,
      clean: true,
      oldestPendingAt: null,
    });
  });

  it('reports pending and failing counts separately', () => {
    let q: SyncQueue = EMPTY_QUEUE;
    q = enqueue(q, finding('v1', 'p1', 1, 1000));
    q = enqueue(q, finding('v1', 'p2', 1, 2000));
    q = recordFailure(q, findingKey('v1', 'p1'), 'offline');
    const s = queueStatus(q);
    expect(s.pending).toBe(2);
    expect(s.failing).toBe(1);
    expect(s.oldestPendingAt).toBe(1000);
  });

  // The rule that makes a signature mean something: a signed report that changes afterwards is
  // the one thing signing is supposed to rule out.
  it('refuses sign-off while anything is unsynced', () => {
    const q = enqueue(EMPTY_QUEUE, finding('v1', 'p1', 2, 1000));
    const r = canSignOff(q);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/has not reached the server/);
  });

  it('pluralises the refusal correctly', () => {
    let q = enqueue(EMPTY_QUEUE, finding('v1', 'p1', 2, 1000));
    q = enqueue(q, finding('v1', 'p2', 2, 1100));
    expect(canSignOff(q).reason).toMatch(/2 changes have not reached/);
  });

  it('allows sign-off once the queue is empty', () => {
    expect(canSignOff(EMPTY_QUEUE)).toEqual({ ok: true, reason: null });
  });
});
