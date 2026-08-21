'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  declareWalkthroughConflict,
  pushPrompt,
  resolveWalkthrough,
  saveObservation,
  scheduleWalkthrough,
  startWalkthrough,
  type WalkthroughConsole as ConsoleData,
} from '@/lib/actions/walkthrough';

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const RED = '#96271E';
const GREEN = '#14603A';
const GOLD_DARK = '#7A5209';
const GOLD_WASH = '#FDF8EC';

/**
 * The walkthrough console, navy because it belongs to the online track.
 *
 * The video pane is a labelled placeholder: the live transport is the one externally
 * dependent piece of the whole build, which is why the brief put this step last. Everything
 * around the pane is live against the server: the geofence and connectivity state the
 * school's pings update, the prompt queue, the observations, and the verdict that routes
 * the case.
 */

const QUICK_PROMPTS = [
  'Please show the main entrance and the school name board.',
  'Walk to the classroom in question and pan slowly around it.',
  'Show the toilets, inside and out.',
  'Show the kitchen and the mid day meal store.',
  'Show the library shelf and open the issue register.',
  'Hold the register page steady for ten seconds.',
];

export function WalkthroughConsole({ data }: { data: ConsoleData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  // Prompt acknowledgements and guided-capture clips arrive from the school side, so the
  // console refetches while the session runs. Ten seconds is fast enough to feel live and
  // slow enough to cost nothing.
  const live = !data.needsDeclaration && data.startedAt !== null && data.endedAt === null;
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(t);
  }, [live, router]);

  if (data.needsDeclaration) {
    return (
      <DeclarationGate
        schoolName={data.schoolName}
        districtName={data.districtName}
        pending={pending}
        error={error}
        onDeclare={(hasConflict) => {
          setError('');
          startTransition(async () => {
            const res = await declareWalkthroughConflict(data.runId, hasConflict);
            if (!res.success) setError(res.error ?? 'Could not record the declaration.');
            else if (hasConflict) router.push('/app/verifier/walkthroughs');
            else router.refresh();
          });
        }}
      />
    );
  }

  return <Console data={data} />;
}

function DeclarationGate({
  schoolName,
  districtName,
  onDeclare,
  pending,
  error,
}: {
  schoolName: string;
  districtName: string;
  onDeclare: (hasConflict: boolean) => void;
  pending: boolean;
  error: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border-2 bg-white" style={{ borderColor: NAVY }}>
      <div className="px-5 py-3" style={{ backgroundColor: NAVY }}>
        <p className="text-sm font-bold text-white">Identity disclosed for this session</p>
      </div>
      <div className="space-y-3 p-5">
        <p className="text-sm text-gray-800">
          You screened this case under a masked code. A live walkthrough shows the school on
          camera, so for this session it is named, and the disclosure has been recorded:
        </p>
        <p className="text-lg font-bold" style={{ color: NAVY_DEEP }}>
          {schoolName}
          <span className="ml-2 text-sm font-semibold" style={{ color: INK_MUTED }}>
            {districtName}
          </span>
        </p>
        <p className="text-sm font-bold" style={{ color: NAVY_DEEP }}>
          Do you have any personal, family or professional connection to this school, or any
          reason someone could question your impartiality here?
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => onDeclare(false)}
            className="rounded-lg px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            style={{ backgroundColor: NAVY }}
          >
            No conflict, open the console
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onDeclare(true)}
            className="rounded-lg border-2 px-5 py-2.5 text-sm font-bold disabled:opacity-60"
            style={{ borderColor: RED, color: RED }}
          >
            I have a connection, reassign this
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm font-semibold" style={{ color: RED }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function Console({ data }: { data: ConsoleData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [promptText, setPromptText] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.indicators.map((i) => [i.parameterId, i.observationNote ?? ''])),
  );
  const [outcomeNote, setOutcomeNote] = useState(data.outcomeNote ?? '');

  const ended = data.endedAt !== null;
  const started = data.startedAt !== null;
  const observed = data.indicators.filter((i) => (notes[i.parameterId] ?? '').trim().length > 0).length;

  function run(fn: () => Promise<{ success: boolean; error?: string }>) {
    setError('');
    startTransition(async () => {
      const res = await fn();
      if (!res.success) setError(res.error ?? 'That did not work.');
      else router.refresh();
    });
  }

  function sendPrompt(body: string) {
    if (!body.trim()) return;
    run(() => pushPrompt(data.runId, body));
    setPromptText('');
  }

  return (
    <div className="space-y-5">
      {/* Session state */}
      <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              label={
                ended
                  ? `Ended, ${data.outcome === 'RESOLVED' ? 'resolved' : 'unresolved'}`
                  : data.mode === 'GUIDED_CAPTURE'
                    ? 'Guided capture'
                    : started
                      ? 'Live session'
                      : data.scheduledFor
                        ? `Scheduled ${new Date(data.scheduledFor).toLocaleString('en-IN')}`
                        : 'Not started'
              }
              colour={ended ? (data.outcome === 'RESOLVED' ? GREEN : RED) : started ? NAVY : INK_MUTED}
            />
            <Badge
              label={`You appear to the school as ${data.pseudonym}`}
              colour={INK_MUTED}
              outline
            />
            <Badge
              label={`Due by ${new Date(data.dueBy).toLocaleDateString('en-IN')}`}
              colour={new Date(data.dueBy).getTime() < Date.now() ? RED : INK_MUTED}
              outline
            />
          </div>
          {!ended && !started && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="rounded-lg border-2 border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={pending || !scheduleAt}
                onClick={() => run(() => scheduleWalkthrough(data.runId, new Date(scheduleAt).toISOString()))}
                className="rounded-lg border-2 px-4 py-2 text-sm font-bold disabled:opacity-50"
                style={{ borderColor: NAVY, color: NAVY }}
              >
                Schedule
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => startWalkthrough(data.runId))}
                className="rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                style={{ backgroundColor: NAVY }}
              >
                Start the session
              </button>
            </div>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm font-semibold" style={{ color: RED }}>
            {error}
          </p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        {/* Left: video pane + status + prompts */}
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white">
            <div
              className="flex aspect-video items-center justify-center"
              style={{ backgroundColor: '#101826' }}
            >
              <div className="max-w-md p-6 text-center">
                <p className="text-sm font-bold text-white">
                  {data.mode === 'GUIDED_CAPTURE'
                    ? 'This case moved to guided capture. Review the clips on the right.'
                    : started && !ended
                      ? 'Live video pane'
                      : 'Video appears here when the session starts'}
                </p>
                <p className="mt-2 text-xs" style={{ color: '#8FA0BC' }}>
                  The live transport is not connected in this environment. The console around
                  this pane is fully wired: geofence, connectivity, prompts, observations and
                  the verdict all run against the server.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 px-4 py-3">
              <Badge
                label={
                  !data.geofenceAnchored
                    ? 'Fence unanchored: school has no registered pin'
                    : data.lastGeofenceMetres === null
                      ? 'Fence: no reading yet'
                      : `Fence: ${data.lastGeofenceMetres.toLocaleString('en-IN')} m from the pin`
                }
                colour={
                  !data.geofenceAnchored
                    ? GOLD_DARK
                    : data.geofenceHeld === false
                      ? RED
                      : data.geofenceHeld
                        ? GREEN
                        : INK_MUTED
                }
                outline
              />
              {data.geofenceHeld === false && <Badge label="Left the fence during this session" colour={RED} />}
              <Badge
                label={`Connectivity failures: ${data.connectivityFailures} of 2`}
                colour={data.connectivityFailures > 0 ? GOLD_DARK : INK_MUTED}
                outline
              />
              <span className="text-xs" style={{ color: INK_MUTED }}>
                Your camera and microphone are off and cannot be enabled. Instructions go as
                text prompts only.
              </span>
            </div>
          </div>

          {/* Prompt queue */}
          <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
            <h2 className="text-base font-bold" style={{ color: NAVY_DEEP }}>
              Text prompts to the school
            </h2>
            {started && !ended && (
              <>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={pending}
                      onClick={() => sendPrompt(q)}
                      className="rounded-full border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-gray-400 disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendPrompt(promptText)}
                    placeholder="Type an instruction and press Enter"
                    className="flex-1 rounded-lg border-2 border-gray-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={pending || !promptText.trim()}
                    onClick={() => sendPrompt(promptText)}
                    className="rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                    style={{ backgroundColor: NAVY }}
                  >
                    Send
                  </button>
                </div>
              </>
            )}
            <ul className="mt-3 space-y-1.5">
              {data.prompts.length === 0 && (
                <li className="text-sm" style={{ color: INK_MUTED }}>
                  Nothing sent yet.
                </li>
              )}
              {data.prompts.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <span className="text-gray-800">{p.body}</span>
                  <span className="shrink-0 text-xs font-bold" style={{ color: p.acknowledgedAt ? GREEN : INK_MUTED }}>
                    {p.acknowledgedAt ? 'Seen' : 'Sent'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: checklist, clips, verdict */}
        <div className="space-y-4">
          <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
            <h2 className="text-base font-bold" style={{ color: NAVY_DEEP }}>
              Disputed indicators ({observed} of {data.indicators.length} observed)
            </h2>
            <div className="mt-2 space-y-3">
              {data.indicators.map((i) => (
                <div key={i.parameterId} className="rounded-lg border border-gray-200 p-3">
                  <p className="font-mono text-xs font-bold" style={{ color: NAVY }}>
                    {i.code}
                  </p>
                  <p className="text-sm font-bold text-gray-900">{i.titleEn}</p>
                  <p className="text-xs" style={{ color: INK_MUTED }}>
                    {i.claimedLevel !== null ? `Claimed Level ${i.claimedLevel}. ` : ''}
                    {i.disputeSources.join('; ')}
                  </p>
                  <textarea
                    value={notes[i.parameterId] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [i.parameterId]: e.target.value }))}
                    onBlur={() => {
                      const note = (notes[i.parameterId] ?? '').trim();
                      if (note && note !== (i.observationNote ?? '')) {
                        run(() => saveObservation(data.runId, i.parameterId, note));
                      }
                    }}
                    disabled={ended}
                    rows={2}
                    placeholder="What the walkthrough showed for this indicator."
                    className="mt-2 w-full rounded-lg border-2 border-gray-300 p-2 text-sm disabled:bg-gray-50"
                  />
                </div>
              ))}
            </div>
          </div>

          {data.mode === 'GUIDED_CAPTURE' && (
            <div className="rounded-xl border-2 p-4" style={{ borderColor: '#D0AD42', backgroundColor: GOLD_WASH }}>
              <h2 className="text-base font-bold" style={{ color: GOLD_DARK }}>
                Guided capture clips ({data.clips.length})
              </h2>
              <p className="mt-1 text-xs" style={{ color: GOLD_DARK }}>
                {data.guidedCaptureDeadline
                  ? `The school may record until ${new Date(data.guidedCaptureDeadline).toLocaleString('en-IN')}.`
                  : ''}{' '}
                Each clip is stamped with its capture time and location. A clip flagged as not
                freshly captured carried an old file timestamp at upload.
              </p>
              <ul className="mt-2 space-y-2">
                {data.clips.map((c) => (
                  <li key={c.id} className="rounded-lg bg-white p-2.5 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-gray-900">{c.taskLabel}</span>
                      {!c.freshCapture && <Badge label="Not freshly captured" colour={RED} />}
                    </div>
                    <p className="mt-0.5 text-xs" style={{ color: INK_MUTED }}>
                      {new Date(c.capturedAt).toLocaleString('en-IN')}
                      {c.lat !== null && c.lng !== null ? ` · ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}` : ' · no location'}
                    </p>
                    <video src={c.blobUrl} controls preload="metadata" className="mt-2 w-full rounded-lg" />
                  </li>
                ))}
                {data.clips.length === 0 && (
                  <li className="text-sm" style={{ color: GOLD_DARK }}>
                    Nothing recorded yet.
                  </li>
                )}
              </ul>
            </div>
          )}

          {!ended && (
            <div className="rounded-xl border-2 bg-white p-4" style={{ borderColor: NAVY }}>
              <h2 className="text-base font-bold" style={{ color: NAVY_DEEP }}>
                Verdict
              </h2>
              <p className="mt-1 text-xs" style={{ color: INK_MUTED }}>
                Resolved sends the school to the census queue for its normal turn. Unresolved
                fast-tracks it into this year&apos;s field cohort.
              </p>
              <textarea
                value={outcomeNote}
                onChange={(e) => setOutcomeNote(e.target.value)}
                rows={2}
                placeholder="Grounds. Required for unresolved."
                className="mt-2 w-full rounded-lg border-2 border-gray-300 p-2 text-sm"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending || !started}
                  onClick={() =>
                    run(async () => {
                      const res = await resolveWalkthrough(data.runId, 'RESOLVED', outcomeNote);
                      if (res.success) router.push('/app/verifier/walkthroughs');
                      return res;
                    })
                  }
                  className="rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  style={{ backgroundColor: GREEN }}
                >
                  Resolved
                </button>
                <button
                  type="button"
                  disabled={pending || !started}
                  onClick={() =>
                    run(async () => {
                      const res = await resolveWalkthrough(data.runId, 'UNRESOLVED', outcomeNote);
                      if (res.success) router.push('/app/verifier/walkthroughs');
                      return res;
                    })
                  }
                  className="rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  style={{ backgroundColor: RED }}
                >
                  Unresolved, send a field team
                </button>
              </div>
              {!started && (
                <p className="mt-2 text-xs" style={{ color: INK_MUTED }}>
                  Start the session before recording a verdict.
                </p>
              )}
            </div>
          )}

          {ended && data.outcomeNote && (
            <blockquote className="rounded-xl border-2 border-gray-200 bg-white p-4 text-sm text-gray-800">
              {data.outcomeNote}
            </blockquote>
          )}
        </div>
      </div>
    </div>
  );
}

function Badge({ label, colour, outline }: { label: string; colour: string; outline?: boolean }) {
  return (
    <span
      className="rounded-full px-3 py-1 text-xs font-bold"
      style={
        outline
          ? { border: `2px solid ${colour}`, color: colour }
          : { backgroundColor: colour, color: 'white' }
      }
    >
      {label}
    </span>
  );
}
