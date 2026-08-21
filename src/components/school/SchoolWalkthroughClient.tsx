'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import {
  acknowledgePrompt,
  recordSchoolLocation,
  recordSchoolPing,
  saveWalkthroughClip,
  type SchoolWalkthroughView,
} from '@/lib/actions/walkthrough';

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const RED = '#96271E';
const GREEN = '#14603A';
const GOLD = '#BF9000';
const GOLD_DARK = '#7A5209';
const GOLD_WASH = '#FDF8EC';

/** How often the school's device reports in during a live session. */
const PING_INTERVAL_MS = 20_000;
/** A heartbeat gap longer than this counts as a failed connectivity check. */
const HEARTBEAT_GAP_MS = 45_000;

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

export function SchoolWalkthroughClient({ view }: { view: SchoolWalkthroughView }) {
  const router = useRouter();
  const [uploadingTask, setUploadingTask] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const lastOkAtRef = useRef<number | null>(null);
  const ackedRef = useRef<Set<string>>(new Set());

  const live = view.mode === 'LIVE' && view.startedAt !== null;

  // The heartbeat: location for the fence, and whether the connection chain held. A gap in
  // the chain is reported on the next successful beat, which is the only moment a browser
  // can report it, and two reported gaps drop the session to guided capture server-side.
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

  // Refresh for new prompts while anything is active.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(t);
  }, [router]);

  // Every prompt on screen is acknowledged once, so the verifier sees it landed.
  useEffect(() => {
    for (const p of view.prompts) {
      if (!p.acknowledgedAt && !ackedRef.current.has(p.id)) {
        ackedRef.current.add(p.id);
        void acknowledgePrompt(p.id);
      }
    }
  }, [view.prompts]);

  async function captureClip(task: { parameterId: string; label: string }, file: File) {
    setUploadError('');
    if (!file.type.startsWith('video/')) {
      setUploadError('Record a video clip. Photographs go through the evidence manager.');
      return;
    }
    setUploadingTask(task.parameterId);
    try {
      const [geo, blob] = await Promise.all([
        getPosition(),
        upload(`walkthrough/${view.sessionId}/${file.name}`, file, {
          access: 'public',
          handleUploadUrl: '/api/blob',
        }),
      ]);
      const res = await saveWalkthroughClip(view.sessionId, {
        parameterId: task.parameterId,
        taskLabel: task.label,
        blobUrl: blob.url,
        lat: geo.lat,
        lng: geo.lng,
        fileLastModifiedMs: file.lastModified,
      });
      if (!res.success) setUploadError(res.error ?? 'Could not save the clip.');
      else router.refresh();
    } catch {
      setUploadError('The upload failed. Check your signal and try again.');
    } finally {
      setUploadingTask(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: view.mode === 'LIVE' ? NAVY : GOLD }}>
            {view.mode === 'LIVE' ? (live ? 'Live session' : 'Awaiting start') : 'Guided capture task'}
          </span>
          <span className="rounded-full border-2 px-3 py-1 text-xs font-bold" style={{ borderColor: INK_MUTED, color: INK_MUTED }}>
            Verifier: {view.verifierId}
          </span>
          {view.scheduledFor && !view.startedAt && (
            <span className="text-sm font-semibold" style={{ color: NAVY_DEEP }}>
              Scheduled for {new Date(view.scheduledFor).toLocaleString('en-IN')}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm" style={{ color: INK_MUTED }}>
          The verifier is anonymous: you see an ID, not a name, and you will not hear a voice.
          Instructions arrive as text below. Your camera streams; theirs stays off.
          {!view.geofenceAnchored &&
            ' Your school has no registered location, so the location check cannot run; register it from this page.'}
        </p>
      </div>

      {view.mode === 'LIVE' && (
        <div className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white">
          <div className="flex aspect-video items-center justify-center" style={{ backgroundColor: '#101826' }}>
            <div className="max-w-md p-6 text-center">
              <p className="text-sm font-bold text-white">
                {live ? 'Your camera streams from here' : 'The session has not started yet'}
              </p>
              <p className="mt-2 text-xs" style={{ color: '#8FA0BC' }}>
                The live transport is not connected in this environment. Location and
                connection checks are running; instructions appear below as they are sent.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Prompt feed */}
      <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
        <h2 className="text-base font-bold" style={{ color: NAVY_DEEP }}>
          Instructions from the verifier
        </h2>
        <ul className="mt-2 space-y-1.5">
          {view.prompts.length === 0 && (
            <li className="text-sm" style={{ color: INK_MUTED }}>
              Nothing yet. Instructions appear here during the session.
            </li>
          )}
          {view.prompts.map((p, i) => (
            <li key={p.id} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: i === view.prompts.length - 1 ? '#EEF2F9' : '#F9FAFB' }}>
              <span className="font-mono text-xs font-bold" style={{ color: INK_MUTED }}>
                {new Date(p.sentAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>{' '}
              <span className="font-semibold text-gray-900">{p.body}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Guided capture */}
      {view.mode === 'GUIDED_CAPTURE' && (
        <div className="rounded-xl border-2 p-4" style={{ borderColor: GOLD, backgroundColor: GOLD_WASH }}>
          <h2 className="text-base font-bold" style={{ color: GOLD_DARK }}>
            Recording task
          </h2>
          <p className="mt-1 text-sm" style={{ color: GOLD_DARK }}>
            The live session could not hold a connection, so record a short clip for each item
            below instead. Record inside this page with your camera; files from the gallery are
            flagged to the verifier. Each clip is stamped with the time and your location.
          </p>
          {view.guidedCaptureDeadline && (
            <p className="mt-1 text-sm font-bold" style={{ color: Date.now() > new Date(view.guidedCaptureDeadline).getTime() ? RED : GOLD_DARK }}>
              {Date.now() > new Date(view.guidedCaptureDeadline).getTime()
                ? 'The recording window has closed.'
                : `Record by ${new Date(view.guidedCaptureDeadline).toLocaleString('en-IN')}.`}
            </p>
          )}
          <ul className="mt-3 space-y-2">
            {view.tasks.map((task) => (
              <li key={task.parameterId} className="rounded-lg bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900">{task.label}</span>
                  {task.done ? (
                    <span className="rounded-full bg-[#E7F5EE] px-3 py-1 text-xs font-bold" style={{ color: GREEN }}>
                      Recorded
                    </span>
                  ) : (
                    <label
                      className="cursor-pointer rounded-lg px-4 py-2 text-sm font-bold text-white"
                      style={{ backgroundColor: uploadingTask === task.parameterId ? '#9CA3AF' : GOLD }}
                    >
                      {uploadingTask === task.parameterId ? 'Uploading...' : 'Record a clip'}
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime,video/3gpp"
                        capture="environment"
                        className="hidden"
                        disabled={uploadingTask !== null}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void captureClip(task, file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {uploadError && (
            <p role="alert" className="mt-2 text-sm font-semibold" style={{ color: RED }}>
              {uploadError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
