'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import {
  saveFieldFinding,
  saveSpotCheck,
  signOffVisit,
  startVisit,
  type FieldIndicator,
  type FieldVisitCase,
} from '@/lib/actions/fieldVisit';
import { findingKey, spotCheckKey, type QueuedWrite } from '@/lib/verification/syncQueue';
import { useSyncQueue, type FlushFn } from '@/components/verifier/useSyncQueue';

/**
 * The field verification workspace: one screen for the whole visit.
 *
 * Built for a low-end Android tablet in bright sunlight, which sets the visual rules before any
 * aesthetic ones: 2px borders instead of shadows, nothing below 12px, tap targets at 48px or
 * larger, and the gold field-track colour on everything interactive so the verifier always knows
 * which half of the system they are in.
 *
 * The screen is the device's copy of the visit, not the server's. Every level tapped and score
 * entered lands in local state first and is queued for sync; the queue survives the browser being
 * killed. Photographs are the one exception, uploaded straight away because a photo is too large
 * to sit in localStorage, so the photo button needs signal and everything else does not.
 */

const GOLD = '#BF9000';
const GOLD_TINT = '#D0AD42';
const GOLD_DARK = '#7A5209';
const GOLD_WASH = '#FDF8EC';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const RED = '#96271E';
const GREEN = '#14603A';
const GREEN_WASH = '#E7F5EE';

type FindingPayload = {
  parameterId: string;
  observedLevel: number;
  note: string;
  photo?: { blobUrl: string; lat: number | null; lng: number | null };
};

type SpotPayload = {
  classLevel: number;
  rollPosition: number;
  scores: { reading: number | null; writing: number | null; numeracy: number | null };
  note: string;
};

/**
 * The queue's way back to the server. Kept outside the component so the hook's ref never sees a
 * new function identity on every render, and wrapped in a catch because a server action called
 * with no connection throws rather than returning, and a thrown flush must count as a failed
 * write, not a crashed screen.
 */
const dispatchWrite: FlushFn = async (write: QueuedWrite) => {
  try {
    if (write.kind === 'FINDING') {
      const p = write.payload as FindingPayload;
      return await saveFieldFinding(write.visitId, p.parameterId, p.observedLevel, p.note, p.photo);
    }
    const p = write.payload as SpotPayload;
    return await saveSpotCheck(write.visitId, p.classLevel, p.rollPosition, p.scores, p.note);
  } catch {
    return { success: false, error: 'No connection.' };
  }
};

/** Best effort only: a denied location permission must not block the record of a real visit. */
function getPosition(): Promise<{ lat: number | null; lng: number | null }> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ lat: null, lng: null });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: null, lng: null }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  });
}

type LocalFinding = { observedLevel: number | null; note: string; photoBlobUrl: string | null };
type LocalSpot = {
  reading: number | null;
  writing: number | null;
  numeracy: number | null;
  note: string;
  unavailable: boolean;
};

const spotKeyOf = (classLevel: number, rollPosition: number) => `${classLevel}:${rollPosition}`;
const isTested = (s: LocalSpot | undefined) =>
  !!s && s.reading !== null && s.writing !== null && s.numeracy !== null;

export function FieldVisitWorkspace({ visit }: { visit: FieldVisitCase }) {
  const router = useRouter();

  const [findings, setFindings] = useState<Record<string, LocalFinding>>(() =>
    Object.fromEntries(
      visit.indicators.map((i) => [
        i.parameterId,
        { observedLevel: i.observedLevel, note: i.note ?? '', photoBlobUrl: i.photoBlobUrl },
      ]),
    ),
  );

  const [spots, setSpots] = useState<Record<string, LocalSpot>>(() => {
    const seeded: Record<string, LocalSpot> = {};
    for (const r of visit.spotCheck.recorded) {
      seeded[spotKeyOf(r.classLevel, r.rollPosition)] = {
        reading: r.readingScore,
        writing: r.writingScore,
        numeracy: r.numeracyScore,
        note: r.note ?? '',
        // A record with no scores and a note is a child who was not there; a record with no
        // scores and no note would just be untouched.
        unavailable:
          r.readingScore === null &&
          r.writingScore === null &&
          r.numeracyScore === null &&
          r.note !== null,
      };
    }
    return seeded;
  });

  const [arrivedAt, setArrivedAt] = useState<string | null>(visit.arrivedAt);
  const [signedOffAt, setSignedOffAt] = useState<string | null>(visit.signedOffAt);
  const [arriving, setArriving] = useState(false);
  const [arriveError, setArriveError] = useState('');
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState('');
  const [signedResult, setSignedResult] = useState<{ raised: number; routedTo: string } | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [photoErrors, setPhotoErrors] = useState<Record<string, string>>({});

  const { status, signOffCheck, online, syncing, add, flushNow } = useSyncQueue(
    visit.visitId,
    dispatchWrite,
  );

  const readOnly = signedOffAt !== null;

  function commitFinding(parameterId: string, next: LocalFinding, photo?: FindingPayload['photo']) {
    setFindings((f) => ({ ...f, [parameterId]: next }));
    // The server refuses a finding without a level, so a note typed first waits on the device and
    // rides along when the level is tapped.
    if (next.observedLevel === null) return;
    add({
      key: findingKey(visit.visitId, parameterId),
      kind: 'FINDING',
      visitId: visit.visitId,
      payload: {
        parameterId,
        observedLevel: next.observedLevel,
        note: next.note,
        ...(photo ? { photo } : {}),
      },
      queuedAt: Date.now(),
    });
  }

  function commitSpot(classLevel: number, rollPosition: number, next: LocalSpot) {
    setSpots((s) => ({ ...s, [spotKeyOf(classLevel, rollPosition)]: next }));
    add({
      key: spotCheckKey(visit.visitId, classLevel, rollPosition),
      kind: 'SPOT_CHECK',
      visitId: visit.visitId,
      payload: {
        classLevel,
        rollPosition,
        scores: { reading: next.reading, writing: next.writing, numeracy: next.numeracy },
        note: next.unavailable ? next.note || 'Child unavailable on the day.' : next.note,
      },
      queuedAt: Date.now(),
    });
  }

  async function capturePhoto(indicator: FieldIndicator, file: File) {
    setPhotoErrors((e) => ({ ...e, [indicator.parameterId]: '' }));
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setPhotoErrors((e) => ({ ...e, [indicator.parameterId]: 'Use a JPEG or PNG photograph.' }));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setPhotoErrors((e) => ({ ...e, [indicator.parameterId]: 'The photograph is over 10 MB.' }));
      return;
    }
    setUploadingId(indicator.parameterId);
    try {
      const [geo, blob] = await Promise.all([
        getPosition(),
        upload(`field/${visit.visitId}/${indicator.code}-${file.name}`, file, {
          access: 'public',
          handleUploadUrl: '/api/blob',
        }),
      ]);
      const current = findings[indicator.parameterId];
      if (!current || current.observedLevel === null) return;
      commitFinding(
        indicator.parameterId,
        { ...current, photoBlobUrl: blob.url },
        { blobUrl: blob.url, lat: geo.lat, lng: geo.lng },
      );
    } catch {
      setPhotoErrors((e) => ({
        ...e,
        [indicator.parameterId]: 'The upload failed. Check your signal and try again.',
      }));
    } finally {
      setUploadingId(null);
    }
  }

  async function recordArrival() {
    setArriveError('');
    setArriving(true);
    try {
      const res = await startVisit(visit.visitId);
      if (res.success) setArrivedAt(new Date().toISOString());
      else setArriveError(res.error ?? 'Could not record your arrival.');
    } catch {
      setArriveError('No connection. Try again when you have a moment of signal.');
    } finally {
      setArriving(false);
    }
  }

  async function signOff() {
    setSignError('');
    setSigning(true);
    try {
      const geo = await getPosition();
      const res = await signOffVisit(visit.visitId, geo);
      if (res.success) {
        setSignedOffAt(new Date().toISOString());
        setSignedResult({ raised: res.discrepanciesRaised ?? 0, routedTo: res.routedTo ?? '' });
        router.refresh();
      } else {
        setSignError(res.error ?? 'Could not sign off the visit.');
      }
    } catch {
      setSignError('No connection. Sign-off needs signal, because it closes the record on the server.');
    } finally {
      setSigning(false);
    }
  }

  // ----- derived -----

  const byDomain = useMemo(() => {
    const groups = new Map<string, FieldIndicator[]>();
    for (const i of visit.indicators) {
      const list = groups.get(i.domainTitleEn) ?? [];
      list.push(i);
      groups.set(i.domainTitleEn, list);
    }
    return groups;
  }, [visit.indicators]);

  const total = visit.indicators.length;
  const graded = visit.indicators.filter((i) => findings[i.parameterId]?.observedLevel != null).length;
  const discrepancies = visit.indicators.filter((i) => {
    const local = findings[i.parameterId];
    return (
      i.claimedLevel !== null && local?.observedLevel != null && local.observedLevel !== i.claimedLevel
    );
  }).length;

  // The primary slots, plus one substitute for each child marked unavailable, drawn in the order
  // the server fixed. The verifier never chooses a replacement child.
  const visibleSlots = useMemo(() => {
    const shown = [...visit.spotCheck.slots];
    for (const sub of visit.spotCheck.substitutes) {
      const unavailable = shown.filter(
        (s) => spots[spotKeyOf(s.classLevel, s.rollPosition)]?.unavailable,
      ).length;
      if (shown.length - unavailable >= visit.spotCheck.slots.length) break;
      shown.push(sub);
    }
    return shown;
  }, [visit.spotCheck.slots, visit.spotCheck.substitutes, spots]);

  const tested = visibleSlots.filter((s) => isTested(spots[spotKeyOf(s.classLevel, s.rollPosition)])).length;

  const canSign =
    !readOnly &&
    arrivedAt !== null &&
    graded === total &&
    total > 0 &&
    signOffCheck.ok &&
    online &&
    !signing;

  return (
    <div className="space-y-5 pb-24">
      {/* Sync state, always visible. The one line a verifier in a dead spot needs. */}
      <div
        className="sticky top-0 z-20 rounded-xl border-2 px-4 py-3"
        style={{
          borderColor: online ? (status.clean ? GREEN : GOLD_TINT) : RED,
          backgroundColor: online ? (status.clean ? GREEN_WASH : GOLD_WASH) : '#FBE9E7',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold" style={{ color: online ? (status.clean ? GREEN : GOLD_DARK) : RED }}>
            {online
              ? status.clean
                ? 'All changes are saved to the server.'
                : `${status.pending} ${status.pending === 1 ? 'change is' : 'changes are'} waiting to sync.`
              : 'Offline. Your work is saving on this device and will sync when signal returns.'}
          </p>
          {online && !status.clean && (
            <button
              type="button"
              onClick={() => void flushNow()}
              disabled={syncing}
              className="rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              style={{ backgroundColor: GOLD }}
            >
              {syncing ? 'Syncing...' : 'Sync now'}
            </button>
          )}
        </div>
        {status.failing > 0 && (
          <p className="mt-1 text-xs font-semibold" style={{ color: RED }}>
            {status.failing} {status.failing === 1 ? 'change has' : 'changes have'} failed to send.
            They stay on this device and are retried each time you sync.
          </p>
        )}
      </div>

      {/* School header */}
      <div className="overflow-hidden rounded-xl border-2 bg-white" style={{ borderColor: GOLD }}>
        <div className="px-5 py-3" style={{ backgroundColor: GOLD }}>
          <p className="text-sm font-bold text-white">Physical verification visit</p>
        </div>
        <div className="p-5">
          <p className="text-xl font-bold" style={{ color: NAVY_DEEP }}>
            {visit.schoolName}
          </p>
          <p className="mt-1 font-mono text-xs" style={{ color: INK_MUTED }}>
            {visit.schoolUdise}
          </p>
          <p className="mt-1 text-sm text-gray-700">
            {visit.blockName}, {visit.districtName}
          </p>
        </div>
      </div>

      {signedOffAt && (
        <div className="rounded-xl border-2 p-4" style={{ borderColor: GREEN, backgroundColor: GREEN_WASH }}>
          <p className="text-base font-bold" style={{ color: GREEN }}>
            Signed off
            {signedResult
              ? signedResult.raised > 0
                ? `. ${signedResult.raised} ${signedResult.raised === 1 ? 'discrepancy was' : 'discrepancies were'} raised and the case has gone to review.`
                : '. No discrepancies. The verification is published.'
              : '. This visit is complete and can no longer be edited.'}
          </p>
        </div>
      )}

      {/* Arrival */}
      {!readOnly && arrivedAt === null && (
        <div className="rounded-xl border-2 p-5" style={{ borderColor: GOLD_TINT, backgroundColor: GOLD_WASH }}>
          <p className="text-base font-bold" style={{ color: GOLD_DARK }}>
            Record your arrival
          </p>
          <p className="mt-1 text-sm" style={{ color: GOLD_DARK }}>
            This starts the visit clock. Sign-off must happen today, so record arrival as soon as
            you reach the school. You can grade indicators before this if you are offline.
          </p>
          <button
            type="button"
            onClick={() => void recordArrival()}
            disabled={arriving || !online}
            className="mt-3 min-h-12 rounded-lg px-6 py-3 text-base font-bold text-white disabled:opacity-60"
            style={{ backgroundColor: GOLD }}
          >
            {arriving ? 'Recording...' : 'I have arrived at the school'}
          </button>
          {!online && (
            <p className="mt-2 text-xs font-semibold" style={{ color: GOLD_DARK }}>
              Arrival needs a moment of signal. Your grading still saves on this device meanwhile.
            </p>
          )}
          {arriveError && (
            <p role="alert" className="mt-2 text-sm font-semibold" style={{ color: RED }}>
              {arriveError}
            </p>
          )}
        </div>
      )}

      {/* Progress */}
      <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold" style={{ color: NAVY_DEEP }}>
            {graded} of {total} indicators graded
          </p>
          <p className="text-sm font-semibold" style={{ color: discrepancies > 0 ? RED : INK_MUTED }}>
            {discrepancies} {discrepancies === 1 ? 'indicator differs' : 'indicators differ'} from
            the school&apos;s claims
          </p>
        </div>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full"
            style={{ width: `${total === 0 ? 0 : Math.round((graded / total) * 100)}%`, backgroundColor: GOLD }}
          />
        </div>
      </div>

      {/* Indicators, by domain */}
      {[...byDomain.entries()].map(([domain, indicators]) => (
        <section key={domain} className="space-y-3">
          <h2 className="text-base font-bold" style={{ color: NAVY_DEEP }}>
            {domain}
          </h2>
          {indicators.map((indicator) => (
            <IndicatorCard
              key={indicator.parameterId}
              indicator={indicator}
              local={findings[indicator.parameterId] ?? { observedLevel: null, note: '', photoBlobUrl: null }}
              readOnly={readOnly}
              online={online}
              uploading={uploadingId === indicator.parameterId}
              photoError={photoErrors[indicator.parameterId] ?? ''}
              onLevel={(level) => {
                const current = findings[indicator.parameterId];
                commitFinding(indicator.parameterId, {
                  observedLevel: level,
                  note: current?.note ?? '',
                  photoBlobUrl: current?.photoBlobUrl ?? null,
                });
              }}
              onNoteChange={(note) => {
                setFindings((f) => ({
                  ...f,
                  [indicator.parameterId]: {
                    ...(f[indicator.parameterId] ?? { observedLevel: null, photoBlobUrl: null }),
                    note,
                  } as LocalFinding,
                }));
              }}
              onNoteCommit={() => {
                const current = findings[indicator.parameterId];
                if (current) commitFinding(indicator.parameterId, current);
              }}
              onPhoto={(file) => void capturePhoto(indicator, file)}
            />
          ))}
        </section>
      ))}

      {/* Student spot check */}
      <section className="space-y-3">
        <h2 className="text-base font-bold" style={{ color: NAVY_DEEP }}>
          Student spot check
        </h2>
        <div className="rounded-xl border-2 p-4" style={{ borderColor: GOLD_TINT, backgroundColor: GOLD_WASH }}>
          <p className="text-sm font-semibold" style={{ color: GOLD_DARK }}>
            {visit.spotCheck.size === 0
              ? 'No spot check is required for this school.'
              : `The server drew ${visit.spotCheck.size} ${visit.spotCheck.size === 1 ? 'child' : 'children'} for this visit. Call each child by class and roll number from the class register. If a child is absent or the roll number does not exist, mark them unavailable and a substitute appears.`}
          </p>
          {visit.spotCheck.size > 0 && (
            <p className="mt-2 text-xs" style={{ color: GOLD_DARK }}>
              Scores run from 0 to 3 on each task. 0 means the child could not attempt it, 1 well
              below grade level, 2 approaching grade level, 3 at grade level.
            </p>
          )}
        </div>

        {visit.spotCheck.size > 0 && (
          <>
            <p className="text-sm font-bold" style={{ color: NAVY_DEEP }}>
              {tested} of {visit.spotCheck.size} children tested
            </p>
            {visibleSlots.map((slot, idx) => {
              const key = spotKeyOf(slot.classLevel, slot.rollPosition);
              return (
                <SpotCheckCard
                  key={key}
                  classLevel={slot.classLevel}
                  rollPosition={slot.rollPosition}
                  isSubstitute={idx >= visit.spotCheck.slots.length}
                  local={
                    spots[key] ?? { reading: null, writing: null, numeracy: null, note: '', unavailable: false }
                  }
                  readOnly={readOnly}
                  onChange={(next) => commitSpot(slot.classLevel, slot.rollPosition, next)}
                />
              );
            })}
          </>
        )}
      </section>

      {/* Sign-off */}
      {!readOnly && (
        <section className="rounded-xl border-2 bg-white p-5" style={{ borderColor: GOLD }}>
          <h2 className="text-lg font-bold" style={{ color: NAVY_DEEP }}>
            Same-day sign-off
          </h2>
          <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
            Signing off closes the record. Every indicator where what you saw differs from what the
            school claimed is raised as a discrepancy.
          </p>

          <ul className="mt-4 space-y-2">
            <Requirement met={arrivedAt !== null} text="Arrival recorded" />
            <Requirement
              met={graded === total && total > 0}
              text={
                graded === total && total > 0
                  ? 'Every indicator graded'
                  : `${total - graded} ${total - graded === 1 ? 'indicator' : 'indicators'} still to grade`
              }
            />
            <Requirement
              met={signOffCheck.ok}
              text={signOffCheck.ok ? 'Everything synced to the server' : signOffCheck.reason ?? ''}
            />
            <Requirement met={online} text={online ? 'Connected' : 'No connection'} />
          </ul>

          {tested < visit.spotCheck.size && (
            <p className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold" style={{ backgroundColor: GOLD_WASH, color: GOLD_DARK }}>
              The spot check is not complete: {tested} of {visit.spotCheck.size} children tested.
              You can still sign off, and the shortfall stays visible to the supervisor.
            </p>
          )}

          <p className="mt-3 text-sm font-semibold" style={{ color: discrepancies > 0 ? RED : GREEN }}>
            {discrepancies > 0
              ? `${discrepancies} ${discrepancies === 1 ? 'discrepancy' : 'discrepancies'} will be raised. The case goes to review.`
              : 'No discrepancies so far. A clean sign-off publishes the verification.'}
          </p>

          <button
            type="button"
            onClick={() => void signOff()}
            disabled={!canSign}
            className="mt-4 min-h-14 w-full rounded-lg px-6 py-4 text-lg font-bold text-white disabled:opacity-50 sm:w-auto"
            style={{ backgroundColor: GOLD }}
          >
            {signing ? 'Signing off...' : 'Sign off this visit'}
          </button>
          {signError && (
            <p role="alert" className="mt-2 text-sm font-semibold" style={{ color: RED }}>
              {signError}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function Requirement({ met, text }: { met: boolean; text: string }) {
  return (
    <li className="flex items-start gap-2 text-sm font-semibold" style={{ color: met ? GREEN : RED }}>
      <span aria-hidden className="mt-0.5">
        {met ? '✓' : '✗'}
      </span>
      <span>{text}</span>
    </li>
  );
}

function IndicatorCard({
  indicator,
  local,
  readOnly,
  online,
  uploading,
  photoError,
  onLevel,
  onNoteChange,
  onNoteCommit,
  onPhoto,
}: {
  indicator: FieldIndicator;
  local: LocalFinding;
  readOnly: boolean;
  online: boolean;
  uploading: boolean;
  photoError: string;
  onLevel: (level: number) => void;
  onNoteChange: (note: string) => void;
  onNoteCommit: () => void;
  onPhoto: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const differs =
    indicator.claimedLevel !== null &&
    local.observedLevel !== null &&
    local.observedLevel !== indicator.claimedLevel;
  const photoReady = local.observedLevel !== null && online && !readOnly;

  return (
    <div className="rounded-xl border-2 bg-white p-4" style={{ borderColor: differs ? RED : '#E5E7EB' }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs font-bold" style={{ color: GOLD_DARK }}>
            {indicator.code}
          </p>
          <p className="mt-0.5 text-base font-bold text-gray-900">{indicator.titleEn}</p>
          <p className="text-sm" style={{ color: INK_MUTED }}>
            {indicator.titleHi}
          </p>
        </div>
        {differs && (
          <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: RED }}>
            Differs from the claim
          </span>
        )}
      </div>

      <p className="mt-2 text-sm font-semibold" style={{ color: NAVY_DEEP }}>
        {indicator.claimedLevel !== null
          ? `School claimed Level ${indicator.claimedLevel}: ${indicator.claimedLabelEn ?? ''}`
          : 'The school made no claim. This school did not submit a self assessment.'}
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {indicator.levels.map((level) => {
          const selected = local.observedLevel === level.order;
          return (
            <button
              key={level.order}
              type="button"
              disabled={readOnly}
              onClick={() => onLevel(level.order)}
              className="min-h-14 rounded-lg border-2 p-3 text-left disabled:opacity-60"
              style={{
                borderColor: selected ? GOLD : '#D1D5DB',
                backgroundColor: selected ? GOLD : 'white',
              }}
            >
              <span className="block text-sm font-bold" style={{ color: selected ? 'white' : NAVY_DEEP }}>
                Level {level.order}
              </span>
              <span className="mt-0.5 block text-xs" style={{ color: selected ? 'white' : '#374151' }}>
                {level.labelEn}
              </span>
            </button>
          );
        })}
      </div>

      <textarea
        value={local.note}
        onChange={(e) => onNoteChange(e.target.value)}
        onBlur={onNoteCommit}
        disabled={readOnly}
        placeholder="What you saw, in a line or two. Required in spirit wherever you differ from the claim."
        rows={2}
        className="mt-3 w-full rounded-lg border-2 border-gray-300 p-3 text-sm focus:outline-none disabled:bg-gray-50"
      />

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPhoto(file);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          disabled={!photoReady || uploading}
          onClick={() => fileRef.current?.click()}
          className="min-h-12 rounded-lg border-2 px-4 py-2.5 text-sm font-bold disabled:opacity-50"
          style={{ borderColor: GOLD, color: GOLD_DARK }}
        >
          {uploading ? 'Uploading photograph...' : local.photoBlobUrl ? 'Replace photograph' : 'Add photograph'}
        </button>
        {local.photoBlobUrl && (
          <a
            href={local.photoBlobUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-bold underline"
            style={{ color: GREEN }}
          >
            Photograph attached, view
          </a>
        )}
        {!readOnly && local.observedLevel === null && (
          <span className="text-xs font-semibold" style={{ color: INK_MUTED }}>
            Choose the observed level first.
          </span>
        )}
        {!readOnly && local.observedLevel !== null && !online && (
          <span className="text-xs font-semibold" style={{ color: GOLD_DARK }}>
            Photographs need signal. They upload straight away rather than queueing.
          </span>
        )}
      </div>
      {photoError && (
        <p role="alert" className="mt-1 text-sm font-semibold" style={{ color: RED }}>
          {photoError}
        </p>
      )}
    </div>
  );
}

const TASKS = [
  { key: 'reading', label: 'Reading' },
  { key: 'writing', label: 'Writing' },
  { key: 'numeracy', label: 'Numeracy' },
] as const;

function SpotCheckCard({
  classLevel,
  rollPosition,
  isSubstitute,
  local,
  readOnly,
  onChange,
}: {
  classLevel: number;
  rollPosition: number;
  isSubstitute: boolean;
  local: LocalSpot;
  readOnly: boolean;
  onChange: (next: LocalSpot) => void;
}) {
  const complete = isTested(local);
  return (
    <div
      className="rounded-xl border-2 bg-white p-4"
      style={{ borderColor: local.unavailable ? '#D1D5DB' : complete ? GREEN : GOLD_TINT }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-bold" style={{ color: NAVY_DEEP }}>
          Class {classLevel}, roll number {rollPosition}
          {isSubstitute && (
            <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: GOLD }}>
              Substitute
            </span>
          )}
        </p>
        <button
          type="button"
          disabled={readOnly}
          onClick={() =>
            onChange(
              local.unavailable
                ? { reading: null, writing: null, numeracy: null, note: '', unavailable: false }
                : { reading: null, writing: null, numeracy: null, note: local.note, unavailable: true },
            )
          }
          className="min-h-10 rounded-lg border-2 px-3 py-2 text-xs font-bold disabled:opacity-50"
          style={{
            borderColor: local.unavailable ? '#6B7280' : RED,
            color: local.unavailable ? '#374151' : RED,
          }}
        >
          {local.unavailable ? 'Marked unavailable, undo' : 'Child unavailable'}
        </button>
      </div>

      {local.unavailable ? (
        <p className="mt-2 text-sm font-semibold" style={{ color: INK_MUTED }}>
          Recorded as unavailable. A substitute has been drawn below.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {TASKS.map((task) => (
            <div key={task.key} className="flex flex-wrap items-center gap-2">
              <span className="w-24 text-sm font-bold text-gray-800">{task.label}</span>
              {[0, 1, 2, 3].map((score) => {
                const selected = local[task.key] === score;
                return (
                  <button
                    key={score}
                    type="button"
                    disabled={readOnly}
                    onClick={() => onChange({ ...local, [task.key]: score })}
                    className="min-h-12 min-w-12 rounded-lg border-2 text-base font-bold disabled:opacity-60"
                    style={{
                      borderColor: selected ? GOLD : '#D1D5DB',
                      backgroundColor: selected ? GOLD : 'white',
                      color: selected ? 'white' : NAVY_DEEP,
                    }}
                  >
                    {score}
                  </button>
                );
              })}
            </div>
          ))}
          <input
            type="text"
            value={local.note}
            onChange={(e) => onChange({ ...local, note: e.target.value })}
            disabled={readOnly}
            placeholder="Optional note"
            className="w-full rounded-lg border-2 border-gray-300 p-2.5 text-sm focus:outline-none disabled:bg-gray-50"
          />
        </div>
      )}
    </div>
  );
}
