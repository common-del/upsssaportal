import { describe, expect, it } from 'vitest';
import {
  acknowledgeClip,
  EMPTY_OUTBOX,
  enqueueClip,
  flushOrder,
  pendingFor,
  pendingStatusLine,
  recordClipFailure,
  type ClipOutbox,
  type PendingClip,
} from './clipQueue';

const clip = (parameterId: string, filmedAtMs: number, over: Partial<PendingClip> = {}): PendingClip => ({
  parameterId,
  sessionId: 's1',
  taskLabel: `${parameterId} Something to film`,
  file: new File(['x'], 'clip.mp4', { type: 'video/mp4' }),
  lat: 26.84,
  lng: 80.94,
  fileLastModifiedMs: filmedAtMs - 2000,
  filmedAtMs,
  attempts: 0,
  lastError: null,
  ...over,
});

describe('one clip per task', () => {
  // A school that films the toilet block, sees it was too dark, and films it again must leave
  // one clip waiting. Two would upload both and leave the verifier to work out which was meant.
  it('replaces the clip waiting for a task rather than adding a second', () => {
    let q: ClipOutbox = EMPTY_OUTBOX;
    q = enqueueClip(q, clip('p1', 1_000));
    q = enqueueClip(q, clip('p1', 2_000));
    expect(q.pending).toHaveLength(1);
    expect(pendingFor(q, 'p1')?.filmedAtMs).toBe(2_000);
  });

  it('keeps clips for different tasks side by side', () => {
    let q: ClipOutbox = EMPTY_OUTBOX;
    q = enqueueClip(q, clip('p1', 1_000));
    q = enqueueClip(q, clip('p2', 1_500));
    expect(q.pending).toHaveLength(2);
  });

  // Otherwise a re-film inherits the failures of the recording it replaced and immediately
  // reads as a clip that is stuck, which it is not.
  it('starts a replacement on a clean attempt count', () => {
    let q: ClipOutbox = EMPTY_OUTBOX;
    q = enqueueClip(q, clip('p1', 1_000));
    q = recordClipFailure(q, 'p1', 'offline');
    q = recordClipFailure(q, 'p1', 'offline');
    q = enqueueClip(q, clip('p1', 5_000));
    expect(pendingFor(q, 'p1')?.attempts).toBe(0);
    expect(pendingFor(q, 'p1')?.lastError).toBeNull();
  });
});

describe('nothing is dropped on failure', () => {
  // The whole point of the outbox: a dead spot must not cost a school the walk it already made.
  it('keeps a failed clip and counts the attempt', () => {
    let q: ClipOutbox = EMPTY_OUTBOX;
    q = enqueueClip(q, clip('p1', 1_000));
    q = recordClipFailure(q, 'p1', 'Network request failed');
    expect(q.pending).toHaveLength(1);
    expect(pendingFor(q, 'p1')).toMatchObject({ attempts: 1, lastError: 'Network request failed' });
  });

  it('never gives up on its own, however many attempts have failed', () => {
    let q: ClipOutbox = EMPTY_OUTBOX;
    q = enqueueClip(q, clip('p1', 1_000));
    for (let i = 0; i < 40; i++) q = recordClipFailure(q, 'p1', 'offline');
    expect(q.pending).toHaveLength(1);
    expect(pendingFor(q, 'p1')?.attempts).toBe(40);
  });

  it('drops a clip only once the server has it', () => {
    let q: ClipOutbox = EMPTY_OUTBOX;
    q = enqueueClip(q, clip('p1', 1_000));
    q = enqueueClip(q, clip('p2', 2_000));
    q = acknowledgeClip(q, 'p1');
    expect(q.pending.map((p) => p.parameterId)).toEqual(['p2']);
  });
});

describe('a backlog clears in the order it was filmed', () => {
  it('flushes oldest first whatever order the clips were added in', () => {
    let q: ClipOutbox = EMPTY_OUTBOX;
    q = enqueueClip(q, clip('p3', 9_000));
    q = enqueueClip(q, clip('p1', 1_000));
    q = enqueueClip(q, clip('p2', 5_000));
    expect(flushOrder(q).map((p) => p.parameterId)).toEqual(['p1', 'p2', 'p3']);
  });
});

describe('what the school is told', () => {
  // "Failed" is the wrong word while the file is still on the phone and still being retried.
  // It reads as lost, and a person who believes the clip is lost films it again for nothing.
  it('never calls a retrying clip failed', () => {
    const line = pendingStatusLine(clip('p1', 1_000, { attempts: 6 }), false, true);
    expect(line.toLowerCase()).not.toContain('fail');
    expect(line).toContain('still trying');
  });

  it('says the clip is safe on the phone when there is no signal', () => {
    expect(pendingStatusLine(clip('p1', 1_000), false, false)).toContain('signal returns');
  });

  // The one case where a person must not be told to keep waiting.
  it('says plainly that a clip missed the window once it closes', () => {
    const line = pendingStatusLine(clip('p1', 1_000, { attempts: 3 }), true, true);
    expect(line).toContain('cannot be counted');
  });
});
