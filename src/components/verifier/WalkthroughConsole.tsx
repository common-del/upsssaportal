'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  declareWalkthroughConflict,
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
 * The call is spoken, both ways, per SSSA's decision of 24 August 2026 (BRIEF_REVIEW
 * section 9): the verifier directs the walkthrough by voice and stays anonymous by
 * pseudonym and a dark camera, not by silence. The video and audio pane is a labelled
 * placeholder: the live transport is the one externally dependent piece of the whole
 * build, which is why the brief put this step last. Everything around the pane is live
 * against the server: the geofence and connectivity state the school's pings update, the
 * observations, and the verdict that routes the case.
 */

export function WalkthroughConsole({ data }: { data: ConsoleData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  // Geofence readings, connectivity state and guided-capture clips arrive from the school
  // side, so the console refetches while the session runs. Ten seconds is fast enough to
  // feel live and slow enough to cost nothing.
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
  const [outcomeNote, setOutcomeNote] = useState(data.outcomeNote ?? '');
  // The indicator the verifier is asking about right now. Starts on the first one still
  // unobserved, because that is where a resumed call picks up.
  const [currentId, setCurrentId] = useState<string | null>(
    () => data.indicators.find((i) => i.observedLevel === null && !i.couldNotCheck)?.parameterId ?? null,
  );

  const ended = data.endedAt !== null;
  const started = data.startedAt !== null;
  // Settled, not merely answered: an indicator the call could not check is on the record but
  // does not count towards a resolution, which is what the resolve rule then refuses.
  const observed = data.indicators.filter((i) => i.observedLevel !== null).length;
  const unchecked = data.indicators.filter((i) => i.couldNotCheck).length;
  const elapsedMinutes = data.startedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(data.startedAt).getTime()) / 60_000))
    : 0;

  function run(fn: () => Promise<{ success: boolean; error?: string }>) {
    setError('');
    startTransition(async () => {
      const res = await fn();
      if (!res.success) setError(res.error ?? 'That did not work.');
      else router.refresh();
    });
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
                    ? 'Recording tasks'
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
        {/* Left: the call pane and its status. Sticky on wide screens so the video stays put
            while the checklist scrolls: a verifier reading indicator 8 of 10 is still on the
            call. self-start is what makes sticky work inside a grid; a stretched item is as
            tall as the row and has nowhere to stick to. top-20 clears the 64px portal header. */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white">
            <div
              className="flex aspect-video items-center justify-center"
              style={{ backgroundColor: '#101826' }}
            >
              <div className="max-w-md p-6 text-center">
                <p className="text-sm font-bold text-white">
                  {data.mode === 'GUIDED_CAPTURE'
                    ? 'The call could not hold, so the school is recording clips instead. Review them on the right.'
                    : started && !ended
                      ? 'Live call: the school\'s video, and voice both ways'
                      : 'The school\'s video and the voice call appear here when the session starts'}
                </p>
                <p className="mt-2 text-xs" style={{ color: '#8FA0BC' }}>
                  The live transport is not connected in this environment. The console around
                  this pane is fully wired: geofence, connectivity, observations and the
                  verdict all run against the server.
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
                label={
                  data.connectivityFailures === 0
                    ? 'Connection steady'
                    : `Connection dropped once, ${2 - data.connectivityFailures} more ends the call`
                }
                colour={data.connectivityFailures > 0 ? GOLD_DARK : GREEN}
                outline
              />
              {started && !ended && data.startedAt && (
                <Badge label={`${elapsedMinutes} min elapsed`} colour={INK_MUTED} outline />
              )}
              <span className="text-xs" style={{ color: INK_MUTED }}>
                You and the school speak on the call. Your camera stays off and cannot be
                enabled: the school hears your voice and sees only your pseudonym. Put what
                you saw in the observations, because they are the written record.
              </span>
            </div>
          </div>
        </div>

        {/* Right: checklist, clips, verdict */}
        <div className="space-y-4">
          <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-bold" style={{ color: NAVY_DEEP }}>
                Disputed indicators
              </h2>
              <span className="text-xs font-bold tabular-nums" style={{ color: INK_MUTED }}>
                {observed} of {data.indicators.length} settled
                {unchecked > 0 && (
                  <span style={{ color: GOLD_DARK }}> · {unchecked} not checkable</span>
                )}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#EDEFF3]">
              <div
                className="h-full rounded-full"
                style={{
                  backgroundColor: NAVY,
                  width: `${data.indicators.length === 0 ? 0 : Math.round((observed / data.indicators.length) * 100)}%`,
                }}
              />
            </div>
            {/* One indicator is the current question; the rest step back so ten boxes stop
                competing for the eye. Clicking any of them makes it the current one, because a
                school on a call jumps about and the verifier has to follow. */}
            <div className="mt-3 space-y-3">
              {data.indicators.map((i) => {
                const answered = i.observedLevel !== null || i.couldNotCheck;
                const current = i.parameterId === currentId;
                const settled = i.observedLevel !== null;
                return (
                  <div
                    key={i.parameterId}
                    onClick={() => setCurrentId(i.parameterId)}
                    className="rounded-lg border-2 p-3"
                    style={{
                      borderColor: current
                        ? NAVY
                        : i.couldNotCheck
                          ? '#D0AD42'
                          : settled
                            ? '#BFE0CF'
                            : '#E5E7EB',
                      backgroundColor: !current && settled ? '#F4FAF6' : !current && i.couldNotCheck ? GOLD_WASH : 'white',
                      opacity: current || answered ? 1 : 0.62,
                    }}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-mono text-xs font-bold" style={{ color: NAVY }}>
                        {i.code}
                      </p>
                      {settled && (
                        <span className="text-[10.5px] font-extrabold" style={{ color: GREEN }}>
                          Level {i.observedLevel}
                          {i.claimedLevel === i.observedLevel ? ', as claimed' : ''}
                        </span>
                      )}
                      {i.couldNotCheck && (
                        <span className="text-[10.5px] font-extrabold" style={{ color: GOLD_DARK }}>
                          Could not check
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-gray-900">{i.titleEn}</p>
                    <p className="text-xs" style={{ color: INK_MUTED }}>
                      {i.claimedLevel !== null ? `School claimed Level ${i.claimedLevel} · ` : ''}
                      {i.disputeSources.join(' · ')}
                    </p>

                    {/* The framework's own words for each level, the same instrument the
                        on-ground verifier uses on site: the verifier reads the rubric rather
                        than recalling it. Only the current card opens them, so a long list of
                        indicators does not become a wall of rubric text. */}
                    {current && !ended && (
                      <div className="mt-2 space-y-1.5">
                        {i.levels.map((level) => {
                          const on = i.observedLevel === level.order;
                          return (
                            <button
                              key={level.order}
                              type="button"
                              disabled={pending}
                              onClick={() =>
                                run(() =>
                                  saveObservation(data.runId, i.parameterId, {
                                    kind: 'LEVEL',
                                    level: level.order,
                                  }),
                                )
                              }
                              className="block w-full rounded-lg border-2 p-2.5 text-left disabled:opacity-60"
                              style={{
                                borderColor: on ? NAVY : '#D1D5DB',
                                backgroundColor: on ? NAVY : 'white',
                              }}
                            >
                              <span className="block text-xs font-extrabold" style={{ color: on ? 'white' : NAVY_DEEP }}>
                                Level {level.order}
                              </span>
                              <span className="mt-0.5 block text-[11.5px] leading-snug" style={{ color: on ? 'white' : '#374151' }}>
                                {level.labelEn}
                              </span>
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            run(() => saveObservation(data.runId, i.parameterId, { kind: 'COULD_NOT_CHECK' }))
                          }
                          className="block w-full rounded-lg border-2 border-dashed p-2.5 text-left disabled:opacity-60"
                          style={{
                            borderColor: '#D0AD42',
                            backgroundColor: i.couldNotCheck ? '#F5E6BF' : GOLD_WASH,
                          }}
                        >
                          <span className="block text-xs font-extrabold" style={{ color: GOLD_DARK }}>
                            Could not check on the call
                          </span>
                          <span className="mt-0.5 block text-[11.5px] leading-snug" style={{ color: GOLD_DARK }}>
                            The camera never showed this, or the connection would not carry it. This
                            indicator stays unsettled and the case goes for a physical inspection.
                          </span>
                        </button>
                      </div>
                    )}

                    {/* Older sessions recorded a paragraph instead of a level. Shown, never
                        edited: the picker replaced it and the record stays readable. */}
                    {i.observationNote && (
                      <p className="mt-2 rounded-lg bg-gray-50 p-2 text-[11.5px]" style={{ color: INK_MUTED }}>
                        Recorded before the level picker: {i.observationNote}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {data.mode === 'GUIDED_CAPTURE' && (
            <div className="rounded-xl border-2 p-4" style={{ borderColor: '#D0AD42', backgroundColor: GOLD_WASH }}>
              <h2 className="text-base font-bold" style={{ color: GOLD_DARK }}>
                Recording tasks · {data.clips.length} returned
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
