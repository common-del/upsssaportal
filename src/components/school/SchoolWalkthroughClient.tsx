'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import {
  recordSchoolLocation,
  recordSchoolPing,
  saveWalkthroughClip,
  type SchoolTask,
  type SchoolWalkthroughView,
} from '@/lib/actions/walkthrough';
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
} from '@/lib/school/clipQueue';
import { deleteClip, loadClips, putClip, storeAvailable } from '@/lib/school/clipStore';

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const RED = '#96271E';
const RED_WASH = '#FBE9E7';
const GREEN = '#14603A';
const GREEN_WASH = '#E7F5EE';
const GOLD = '#BF9000';
const GOLD_DARK = '#7A5209';
const GOLD_WASH = '#FDF8EC';
const GOLD_TINT = '#D0AD42';

/** How often the school's device reports in during a live session. */
const PING_INTERVAL_MS = 20_000;
/** A heartbeat gap longer than this counts as a failed connectivity check. */
const HEARTBEAT_GAP_MS = 45_000;
/** How often a waiting clip is tried again while the page is open. */
const FLUSH_INTERVAL_MS = 30_000;
/** Below this, the clock turns red. */
const URGENT_HOURS = 6;

function getPosition(): Promise<{ lat: number | null; lng: number | null }> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ lat: null, lng: null });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: null, lng: null }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 },
    );
  });
}

export function RegisterLocationCard({ capturedAt }: { capturedAt: string | null }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  if (capturedAt) {
    return (
      <p className="rounded-xl border-2 border-gray-200 bg-white p-4 text-sm" style={{ color: INK_MUTED }}>
        Your school&apos;s location was registered on{' '}
        {new Date(capturedAt).toLocaleDateString('en-IN')}. It anchors the walkthrough geofence
        and can only be corrected by SSSA.
      </p>
    );
  }

  return (
    <div className="rounded-xl border-2 p-4" style={{ borderColor: GOLD, backgroundColor: GOLD_WASH }}>
      <p className="text-sm font-bold" style={{ color: GOLD_DARK }}>
        Register your school&apos;s location
      </p>
      <p className="mt-1 text-sm" style={{ color: GOLD_DARK }}>
        Stand inside the school and press the button. This is captured once and anchors the
        video walkthrough&apos;s location check; it cannot be changed from this account
        afterwards.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError('');
          startTransition(async () => {
            const geo = await getPosition();
            if (geo.lat === null || geo.lng === null) {
              setError('Location is unavailable. Allow location access and try again outdoors.');
              return;
            }
            const res = await recordSchoolLocation(geo.lat, geo.lng);
            if (res.success) router.refresh();
            else setError(res.error ?? 'Could not register the location.');
          });
        }}
        className="mt-2 min-h-12 rounded-lg px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        style={{ backgroundColor: GOLD }}
      >
        {pending ? 'Reading your position...' : 'I am at the school, register this position'}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold" style={{ color: RED }}>
          {error}
        </p>
      )}
    </div>
  );
}

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

const timeOnly = (ms: number) =>
  new Date(ms).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

export function SchoolWalkthroughClient({ view }: { view: SchoolWalkthroughView }) {
  const router = useRouter();
  const live = view.mode === 'LIVE' && view.startedAt !== null;
  const lastOkAtRef = useRef<number | null>(null);

  // The heartbeat: location for the fence, and whether the connection chain held. A gap in
  // the chain is reported on the next successful beat, which is the only moment a browser
  // can report it, and two reported gaps drop the session to recording tasks server-side.
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    async function beat() {
      const geo = await getPosition();
      const now = Date.now();
      const gapBroken = lastOkAtRef.current !== null && now - lastOkAtRef.current > HEARTBEAT_GAP_MS;
      try {
        const res = await recordSchoolPing(view.sessionId, {
          lat: geo.lat,
          lng: geo.lng,
          connectionOk: !gapBroken,
        });
        lastOkAtRef.current = Date.now();
        if (!cancelled && res.mode === 'GUIDED_CAPTURE') router.refresh();
      } catch {
        // Offline: nothing reaches the server, and the widening gap is what the next
        // successful beat reports.
      }
    }
    void beat();
    const t = setInterval(() => void beat(), PING_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [live, view.sessionId, router]);

  // Refresh so a session started, dropped to recording tasks, or ended by the verifier
  // shows up without the school having to reload.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(t);
  }, [router]);

  if (view.mode === 'GUIDED_CAPTURE') return <RecordingTasks view={view} />;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: NAVY }}>
            {live ? 'Live session' : 'Awaiting start'}
          </span>
          <span className="rounded-full border-2 px-3 py-1 text-xs font-bold" style={{ borderColor: INK_MUTED, color: INK_MUTED }}>
            Verifier: {view.verifierId}
          </span>
          {view.scheduledFor && !view.startedAt && (
            <span className="text-sm font-semibold" style={{ color: NAVY_DEEP }}>
              Scheduled for {dateTime(view.scheduledFor)}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm" style={{ color: INK_MUTED }}>
          You and the verifier speak to each other on the call. They stay anonymous on
          screen: you see an ID, not a name or a face. Your camera streams; theirs stays
          off.
          {!view.geofenceAnchored &&
            ' Your school has no registered location, so the location check cannot run; register it from this page.'}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white">
        <div className="flex aspect-video items-center justify-center" style={{ backgroundColor: '#101826' }}>
          <div className="max-w-md p-6 text-center">
            <p className="text-sm font-bold text-white">
              {live ? 'Your camera and the voice call run from here' : 'The session has not started yet'}
            </p>
            <p className="mt-2 text-xs" style={{ color: '#8FA0BC' }}>
              The live transport is not connected in this environment. Location and
              connection checks are running; the verifier directs the walkthrough by
              voice once the call is up.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The recording screen, built for a phone held by a head teacher walking a school.
 *
 * Every other screen in this portal is a desk screen. This one is not, and the shape follows
 * from that: one task open at a time so nobody has to decide what to do first, the hours left
 * in the largest type on the page, and a single full-width button under the thumb.
 *
 * Two things the school was never shown before, both of which already existed in the database.
 * Its own claimed level, because the clip is how that claim gets judged and a person cannot
 * demonstrate a claim they cannot see. And SCERT's evidence checklist for the indicator, which
 * is the authored answer to "what has to be visible" that the framework title never was.
 */
function RecordingTasks({ view }: { view: SchoolWalkthroughView }) {
  const router = useRouter();
  const [outbox, setOutbox] = useState<ClipOutbox>(EMPTY_OUTBOX);
  const [openId, setOpenId] = useState<string | null>(null);
  const [watching, setWatching] = useState<string | null>(null);
  const [durable, setDurable] = useState(true);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState('');
  const flushingRef = useRef(false);

  const deadlineMs = view.guidedCaptureDeadline ? new Date(view.guidedCaptureDeadline).getTime() : null;
  const hoursLeft = deadlineMs === null ? null : Math.max(0, Math.ceil((deadlineMs - Date.now()) / 3_600_000));
  const closed = view.windowClosed;

  const sent = view.tasks.filter((t) => t.clip !== null).length;
  const total = view.tasks.length;
  const waiting = outbox.pending.length;

  // Pick up anything left on the phone from a previous visit, and find out whether this
  // browser will actually keep a clip at all. The copy promises persistence only when it will.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [available, stored] = await Promise.all([storeAvailable(), loadClips(view.sessionId)]);
      if (cancelled) return;
      setDurable(available);
      if (stored.length > 0) setOutbox({ pending: stored });
    })();
    return () => {
      cancelled = true;
    };
  }, [view.sessionId]);

  useEffect(() => {
    const set = () => setOnline(navigator.onLine);
    set();
    window.addEventListener('online', set);
    window.addEventListener('offline', set);
    return () => {
      window.removeEventListener('online', set);
      window.removeEventListener('offline', set);
    };
  }, []);

  const flush = useCallback(async () => {
    if (flushingRef.current || closed) return;
    flushingRef.current = true;
    try {
      for (const clip of flushOrder(outbox)) {
        try {
          const blob = await upload(`walkthrough/${clip.sessionId}/${clip.file.name}`, clip.file, {
            access: 'public',
            handleUploadUrl: '/api/blob',
          });
          const res = await saveWalkthroughClip(clip.sessionId, {
            parameterId: clip.parameterId,
            taskLabel: clip.taskLabel,
            blobUrl: blob.url,
            lat: clip.lat,
            lng: clip.lng,
            fileLastModifiedMs: clip.fileLastModifiedMs,
            filmedAtMs: clip.filmedAtMs,
          });
          if (res.success) {
            await deleteClip(clip.sessionId, clip.parameterId);
            setOutbox((q) => acknowledgeClip(q, clip.parameterId));
            router.refresh();
          } else {
            setOutbox((q) => recordClipFailure(q, clip.parameterId, res.error ?? 'Could not save the clip.'));
          }
        } catch {
          setOutbox((q) => recordClipFailure(q, clip.parameterId, 'No connection.'));
        }
      }
    } finally {
      flushingRef.current = false;
    }
  }, [outbox, closed, router]);

  // Try again when the signal returns, and every half minute regardless: a phone can be online
  // by the browser's reckoning and still not reach anything.
  useEffect(() => {
    if (waiting === 0) return;
    void flush();
    const t = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
    window.addEventListener('online', flush);
    return () => {
      clearInterval(t);
      window.removeEventListener('online', flush);
    };
  }, [waiting, flush]);

  async function film(task: SchoolTask, file: File) {
    setError('');
    if (!file.type.startsWith('video/')) {
      setError('Record a video. Photographs go through the evidence manager instead.');
      return;
    }
    const filmedAtMs = Date.now();
    const geo = await getPosition();
    const clip: PendingClip = {
      parameterId: task.parameterId,
      sessionId: view.sessionId,
      taskLabel: task.label,
      file,
      lat: geo.lat,
      lng: geo.lng,
      fileLastModifiedMs: file.lastModified,
      filmedAtMs,
      attempts: 0,
      lastError: null,
    };
    // Written to the phone before anything is attempted. A dead spot then costs the school
    // nothing, which is the whole reason the outbox exists.
    await putClip(clip);
    setOutbox((q) => enqueueClip(q, clip));
    setOpenId(null);
  }

  const nextUp = view.tasks.find((t) => t.clip === null && pendingFor(outbox, t.parameterId) === null);
  const current = openId ?? nextUp?.parameterId ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: GOLD }}>
            Recording tasks
          </span>
          <span className="rounded-full border-2 px-3 py-1 text-xs font-bold" style={{ borderColor: INK_MUTED, color: INK_MUTED }}>
            Verifier: {view.verifierId}
          </span>
        </div>
        <p className="mt-2 text-sm" style={{ color: INK_MUTED }}>
          Your live check lost its connection twice, so there is no call to join. Film a short
          video for each item below instead. Nobody is waiting on the line: do them in any order,
          and come back to this page as often as you need.
        </p>
      </div>

      {/* The clock. Hours, not a date: a person acts on "21 hours left". */}
      <div
        className="rounded-xl border-2 p-4"
        style={{
          borderColor: closed ? RED : hoursLeft !== null && hoursLeft <= URGENT_HOURS ? RED : GOLD_TINT,
          backgroundColor: closed || (hoursLeft !== null && hoursLeft <= URGENT_HOURS) ? RED_WASH : GOLD_WASH,
        }}
      >
        <p className="flex flex-wrap items-baseline gap-2">
          <span
            className="text-4xl font-extrabold leading-none tabular-nums"
            style={{ color: closed || (hoursLeft !== null && hoursLeft <= URGENT_HOURS) ? RED : GOLD_DARK }}
          >
            {(hoursLeft ?? 0).toLocaleString('en-IN')}
          </span>
          <span
            className="text-sm font-bold"
            style={{ color: closed || (hoursLeft !== null && hoursLeft <= URGENT_HOURS) ? RED : GOLD_DARK }}
          >
            {closed ? 'hours left' : hoursLeft === 1 ? 'hour left' : 'hours left'}
          </span>
        </p>
        <p
          className="mt-1 text-xs font-semibold"
          style={{ color: closed || (hoursLeft !== null && hoursLeft <= URGENT_HOURS) ? RED : GOLD_DARK }}
        >
          {view.guidedCaptureDeadline
            ? closed
              ? `The window closed on ${dateTime(view.guidedCaptureDeadline)}`
              : `Send everything by ${dateTime(view.guidedCaptureDeadline)}`
            : 'No closing time has been set for this window.'}
        </p>
      </div>

      {closed && (
        <div className="rounded-xl p-4" style={{ backgroundColor: RED_WASH }}>
          <p className="text-sm font-bold" style={{ color: RED }}>
            {sent.toLocaleString('en-IN')} of {total.toLocaleString('en-IN')} videos reached us
          </p>
          <p className="mt-1 text-sm" style={{ color: RED }}>
            The verifier will judge what you did send. Anything missing cannot be settled from a
            screen, so a verifier will visit the school in person instead. You will be told the
            travel window separately.
          </p>
          <p className="mt-2 text-xs" style={{ color: RED }}>
            If something stopped you from filming, say so under Complaints. It is read by a
            person.
          </p>
        </div>
      )}

      {/* Progress. Five identical rows say nothing about how far a school has got. */}
      {!closed && total > 0 && (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-bold" style={{ color: NAVY_DEEP }}>
              {sent.toLocaleString('en-IN')} of {total.toLocaleString('en-IN')} filmed
            </p>
            <p className="text-xs" style={{ color: INK_MUTED }}>
              {total - sent === 0
                ? 'Everything is in. Nothing more is needed from you.'
                : `${(total - sent).toLocaleString('en-IN')} still to film`}
              {waiting > 0 && ` · ${waiting.toLocaleString('en-IN')} waiting to send`}
            </p>
          </div>
          <div className="mt-1.5 flex gap-1">
            {view.tasks.map((t) => (
              <span
                key={t.parameterId}
                className="h-2 flex-1 rounded-full"
                style={{
                  backgroundColor:
                    t.clip !== null
                      ? GREEN
                      : pendingFor(outbox, t.parameterId)
                        ? GOLD_TINT
                        : t.parameterId === current
                          ? GOLD
                          : '#E6E9F0',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg p-3 text-sm font-semibold" style={{ backgroundColor: RED_WASH, color: RED }}>
          {error}
        </p>
      )}

      <div className="space-y-3">
        {view.tasks.map((task) => (
          <TaskCard
            key={task.parameterId}
            task={task}
            open={task.parameterId === current}
            closed={closed}
            online={online}
            durable={durable}
            pending={pendingFor(outbox, task.parameterId)}
            watching={watching === task.parameterId}
            onOpen={() => setOpenId(task.parameterId)}
            onSkip={() => {
              const rest = view.tasks.filter(
                (t) => t.parameterId !== task.parameterId && t.clip === null && !pendingFor(outbox, t.parameterId),
              );
              setOpenId(rest[0]?.parameterId ?? null);
            }}
            onWatch={() => setWatching(watching === task.parameterId ? null : task.parameterId)}
            onFilm={(file) => void film(task, file)}
          />
        ))}
      </div>

      {!closed && (
        <p className="text-xs leading-relaxed" style={{ color: INK_MUTED }}>
          Film inside this page. A video chosen from your gallery is sent with a mark saying{' '}
          <b style={{ color: GOLD_DARK }}>it was not filmed just now</b>, and the verifier sees
          that mark. Every video carries the time and the place it was taken.
          {!durable &&
            ' This browser will not keep a video if you close the page, so stay here until each one has sent.'}
        </p>
      )}
    </div>
  );
}

function TaskCard({
  task,
  open,
  closed,
  online,
  durable,
  pending,
  watching,
  onOpen,
  onSkip,
  onWatch,
  onFilm,
}: {
  task: SchoolTask;
  open: boolean;
  closed: boolean;
  online: boolean;
  durable: boolean;
  pending: PendingClip | null;
  watching: boolean;
  onOpen: () => void;
  onSkip: () => void;
  onWatch: () => void;
  onFilm: (file: File) => void;
}) {
  const sent = task.clip !== null;
  const flagged = task.clip !== null && !task.clip.freshCapture;

  const border = flagged ? RED : sent ? '#BFE0CF' : pending ? GOLD_TINT : open ? NAVY : '#E5E7EB';
  const background = flagged ? '#FEF6F5' : sent ? '#F5FBF7' : 'white';

  return (
    <div className="rounded-xl border-2 p-3" style={{ borderColor: border, backgroundColor: background }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="font-mono text-xs font-bold" style={{ color: NAVY }}>
          {task.code}
        </span>
        {flagged ? (
          <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold text-white" style={{ backgroundColor: RED }}>
            Marked
          </span>
        ) : sent ? (
          <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold" style={{ backgroundColor: GREEN_WASH, color: GREEN }}>
            {closed ? 'Sent in time' : 'Sent'}
          </span>
        ) : pending ? (
          <span
            className="rounded-full border px-2.5 py-0.5 text-[10.5px] font-extrabold"
            style={{ borderColor: GOLD_TINT, backgroundColor: GOLD_WASH, color: GOLD_DARK }}
          >
            Waiting to send
          </span>
        ) : closed ? (
          <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold" style={{ backgroundColor: RED_WASH, color: RED }}>
            Never sent
          </span>
        ) : open ? (
          <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold text-white" style={{ backgroundColor: NAVY }}>
            Film this next
          </span>
        ) : (
          <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold" style={{ backgroundColor: '#EEF1F6', color: INK_MUTED }}>
            Not filmed
          </span>
        )}
      </div>

      <p className="mt-0.5 text-sm font-bold text-gray-900">{task.titleEn}</p>
      {(open || sent || pending) && <p className="text-xs leading-relaxed text-gray-700">{task.titleHi}</p>}

      {/* The claim the clip has to demonstrate. A school cannot show what it cannot see. */}
      {open && !sent && !pending && task.claimedLabelEn && (
        <p className="mt-2 border-l-4 pl-2.5 text-xs leading-relaxed" style={{ borderColor: '#C7D2E8', color: INK_MUTED }}>
          You answered <b style={{ color: NAVY_DEEP }}>Level {task.claimedLevel}</b>:{' '}
          {task.claimedLabelEn}
          {task.claimedLabelHi && (
            <span className="mt-0.5 block text-gray-700">{task.claimedLabelHi}</span>
          )}
        </p>
      )}

      {/* SCERT's own checklist for this indicator, which is the authored answer to what has to
          be visible. Written for evidence uploads rather than for filming, so it is headed as
          what the verifier needs to see and not as a shot list. */}
      {open && !sent && !pending && task.checklistEn.length > 0 && (
        <div className="mt-2 rounded-lg border p-2.5" style={{ borderColor: '#ECDFBE', backgroundColor: GOLD_WASH }}>
          <p className="text-[10.5px] font-extrabold uppercase tracking-wide" style={{ color: GOLD_DARK }}>
            What the verifier needs to see
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {task.checklistEn.map((item, i) => (
              <li key={item} className="text-xs leading-snug" style={{ color: '#4A3A12' }}>
                {item}
                {task.checklistHi[i] && (
                  <span className="mt-0.5 block" style={{ color: GOLD_DARK }}>
                    {task.checklistHi[i]}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] font-semibold" style={{ color: GOLD_DARK }}>
            Keep recording as you walk, and show each thing in one take. Half a minute is
            usually enough. Anything on this list that lives in an online record, the verifier
            already has.
          </p>
        </div>
      )}
      {open && !sent && !pending && task.checklistEn.length === 0 && (
        <p className="mt-2 rounded-lg border border-dashed p-2.5 text-xs leading-snug" style={{ borderColor: GOLD_TINT, color: GOLD_DARK }}>
          No checklist is published for this indicator. Film whatever shows the level you
          claimed, in one take, and say aloud what you are showing.
        </p>
      )}

      {/* A clip on its way. It is on the phone; nothing is lost. */}
      {pending && (
        <div className="mt-2 rounded-lg border p-2.5" style={{ borderColor: GOLD_TINT, backgroundColor: GOLD_WASH }}>
          <p className="text-xs font-bold" style={{ color: GOLD_DARK }}>
            Filmed at {timeOnly(pending.filmedAtMs)}
            {pending.lat === null && ' · no location'}
          </p>
          <p className="mt-0.5 text-[11px]" style={{ color: GOLD_DARK }}>
            {pendingStatusLine(pending, closed, online)}
            {durable
              ? ' Your video is saved on this phone, so you can close this page.'
              : ' Keep this page open until it has sent.'}
          </p>
        </div>
      )}

      {/* What was sent, and what the verifier will see on it. */}
      {sent && task.clip && (
        <div className="mt-2">
          {flagged && (
            <p className="mb-2 rounded-lg p-2.5 text-xs leading-relaxed" style={{ backgroundColor: RED_WASH, color: RED }}>
              <b className="block">This video is marked as not filmed just now</b>
              It was sent from your gallery, or this phone&apos;s clock is wrong. The verifier
              sees the mark and may not accept the video.{' '}
              {!closed && 'Filming it again in the app clears the mark on the new one.'}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: INK_MUTED }}>
              Sent {dateTime(task.clip.capturedAt)}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={
                task.clip.freshCapture
                  ? { backgroundColor: GREEN_WASH, color: GREEN }
                  : { backgroundColor: RED_WASH, color: RED }
              }
            >
              {task.clip.freshCapture ? 'Filmed in the app' : 'Not filmed just now'}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={
                task.clip.hasLocation
                  ? { backgroundColor: GREEN_WASH, color: GREEN }
                  : { backgroundColor: '#EEF1F6', color: INK_MUTED }
              }
            >
              {task.clip.hasLocation ? 'Location saved' : 'No location'}
            </span>
          </div>
          {task.earlierAttempts > 0 && (
            <p className="mt-1 text-[11px]" style={{ color: INK_MUTED }}>
              {task.earlierAttempts.toLocaleString('en-IN')} earlier{' '}
              {task.earlierAttempts === 1 ? 'attempt stays' : 'attempts stay'} on the record. The
              verifier sees them all.
            </p>
          )}
          {watching &&
            (task.clip.blobUrl.startsWith('http') || task.clip.blobUrl.startsWith('/') ? (
              <video src={task.clip.blobUrl} controls preload="metadata" className="mt-2 w-full rounded-lg bg-black" />
            ) : (
              // A demonstration clip. The upload path is wired end to end, but nothing is
              // stored in this environment, so the pane says so rather than showing a player
              // that will not play.
              <p
                className="mt-2 flex aspect-video items-center justify-center rounded-lg p-4 text-center text-xs text-white"
                style={{ backgroundColor: '#101826' }}
              >
                A demonstration video. No file is stored in this environment.
              </p>
            ))}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onWatch}
              className="min-h-10 flex-1 rounded-lg border-2 px-3 py-2 text-xs font-bold"
              style={{ borderColor: '#D1D5DB', color: '#3C4A61' }}
            >
              {watching ? 'Hide the video' : 'Watch it back'}
            </button>
            {!closed && (
              <FilmButton
                label="Film again"
                variant={flagged ? 'primary' : 'quiet'}
                onFile={onFilm}
              />
            )}
          </div>
        </div>
      )}

      {/* Nothing sent and nothing waiting: the one action on the card. */}
      {!sent && !pending && !closed && (
        <div className="mt-2 space-y-2">
          {open ? (
            <>
              <FilmButton label="Open camera and film" variant="primary" onFile={onFilm} />
              <button
                type="button"
                onClick={onSkip}
                className="min-h-10 w-full rounded-lg border-2 px-3 py-2 text-xs font-bold"
                style={{ borderColor: '#D1D5DB', color: '#3C4A61' }}
              >
                Skip for now, film another
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onOpen}
              className="min-h-10 w-full rounded-lg border-2 px-3 py-2 text-xs font-bold"
              style={{ borderColor: NAVY, color: NAVY }}
            >
              Film this one
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** The camera. A label rather than a button, because the file input is what opens the camera
 *  on a phone and a button cannot stand in for it. */
function FilmButton({
  label,
  variant,
  onFile,
}: {
  label: string;
  variant: 'primary' | 'quiet';
  onFile: (file: File) => void;
}) {
  return (
    <label
      className={`block min-h-12 cursor-pointer rounded-lg px-4 text-center font-bold ${
        variant === 'primary' ? 'py-3.5 text-sm text-white' : 'flex-1 border-2 py-2.5 text-xs'
      }`}
      style={
        variant === 'primary'
          ? { backgroundColor: GOLD }
          : { borderColor: '#D1D5DB', color: '#3C4A61', minHeight: '2.5rem' }
      }
    >
      {label}
      <input
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/3gpp"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
    </label>
  );
}
