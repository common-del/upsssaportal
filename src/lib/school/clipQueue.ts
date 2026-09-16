/**
 * The school's outbox for recording clips.
 *
 * A head teacher walks to the far end of a campus, films a toilet block, and walks back into a
 * dead spot. Today that clip is lost: the upload throws, the error says "check your signal and
 * try again", and the recording is gone with it. The walk is the expensive part, so losing the
 * result of one is the cruellest failure this route has.
 *
 * So the file is written to the device before anything is attempted, and only removed once the
 * server has it. The rules here are the same ones the field verifier's sync queue settled on,
 * for the same reasons, with one difference that matters:
 *
 *   Keyed by task, not appended. Filming a task again replaces what is waiting for it, because
 *   the second take is the one the school meant to send. An append-only outbox would upload
 *   both and leave the verifier two clips to reconcile.
 *
 *   Failures are kept, never dropped. A failed attempt stays in the outbox with its count
 *   raised. Nothing here decides to give up; the honest failure is a visible "waiting to send"
 *   the school can act on, not a silent discard.
 *
 *   Ordering is oldest first, so a backlog clears in the order it was filmed.
 *
 * The state is pure and tested. Persistence and the upload itself live in the component, which
 * is where the browser is.
 */

export type PendingClip = {
  /** One per task: a second take for the same indicator replaces the first. */
  parameterId: string;
  sessionId: string;
  taskLabel: string;
  /** The recording itself, held until the server has it. */
  file: File;
  lat: number | null;
  lng: number | null;
  /** The file's own timestamp, and when the app took hold of it. Together these are what
   *  decides whether the clip counts as filmed just now, however long it waits here. */
  fileLastModifiedMs: number;
  filmedAtMs: number;
  attempts: number;
  lastError: string | null;
};

export type ClipOutbox = { pending: PendingClip[] };

export const EMPTY_OUTBOX: ClipOutbox = { pending: [] };

/** Add a clip, or replace the one already waiting for that task. */
export function enqueueClip(outbox: ClipOutbox, clip: PendingClip): ClipOutbox {
  const without = outbox.pending.filter((p) => p.parameterId !== clip.parameterId);
  // A replacement starts its attempt count again: it is a different recording, and carrying
  // the old failures over would make a fresh clip look like a stuck one.
  return { pending: [...without, { ...clip, attempts: 0, lastError: null }] };
}

/** The server has it. Drop it. */
export function acknowledgeClip(outbox: ClipOutbox, parameterId: string): ClipOutbox {
  return { pending: outbox.pending.filter((p) => p.parameterId !== parameterId) };
}

/** The attempt failed. Keep the clip, remember why. */
export function recordClipFailure(
  outbox: ClipOutbox,
  parameterId: string,
  error: string,
): ClipOutbox {
  return {
    pending: outbox.pending.map((p) =>
      p.parameterId === parameterId ? { ...p, attempts: p.attempts + 1, lastError: error } : p,
    ),
  };
}

/** Oldest first: a backlog clears in the order it was filmed. */
export function flushOrder(outbox: ClipOutbox): PendingClip[] {
  return [...outbox.pending].sort((a, b) => a.filmedAtMs - b.filmedAtMs);
}

export function pendingFor(outbox: ClipOutbox, parameterId: string): PendingClip | null {
  return outbox.pending.find((p) => p.parameterId === parameterId) ?? null;
}

/**
 * What the school should be told about a clip that has not gone yet.
 *
 * Never "failed": as far as the school is concerned nothing has failed while the file is still
 * on the phone and still being retried. The wording separates the two cases a person can
 * actually act on, no signal and a window that has closed, from the one they cannot.
 */
export function pendingStatusLine(clip: PendingClip, windowClosed: boolean, online: boolean): string {
  if (windowClosed) {
    return 'The window closed before this video could be sent. It cannot be counted.';
  }
  if (!online) return 'Saved on this phone. It will send when the signal returns.';
  if (clip.attempts === 0) return 'Sending now.';
  if (clip.attempts === 1) return 'Sending did not work the first time. Trying again.';
  return `Saved on this phone. ${clip.attempts.toLocaleString('en-IN')} attempts so far, still trying.`;
}
