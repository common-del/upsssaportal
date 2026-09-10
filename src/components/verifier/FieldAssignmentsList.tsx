'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { declareConflict } from '@/lib/actions/cohort';

/**
 * The Field Assignments screen as a day plan, per the approved redesign.
 *
 * Reading order is the working order: whatever needs the verifier right now sits on top at full
 * size with one button; later visits collapse into a dated route list whose rows open in place;
 * finished work is one green line. The reveal rule is written once, as the route list's label,
 * instead of repeating on every sealed card.
 *
 * Sealed rows are built from the sealed assignment shape, which carries no school field of any
 * kind, so there is nothing here to hide and nothing to leak. SSSA's wording rule for this
 * screen: what unlocks is the school information, never "the school".
 *
 * The conflict declaration is a single confirmation by SSSA's direction. Standing down over a
 * connection remains possible through the quiet two-step link beneath it: the mechanism is
 * required by the terms of reference even where the button is not wanted.
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

const IST = 'Asia/Kolkata';

export type TodayVisit = {
  visitId: string;
  schoolName: string;
  schoolUdise: string;
  blockName: string;
  districtName: string;
  addressEn: string | null;
  conflictDeclaredAt: string | null;
  recusedAt: string | null;
  arrivedAt: string | null;
  gradedCount: number;
  totalIndicators: number;
  differCount: number;
};

export type UpcomingVisit = {
  visitId: string;
  districtName: string;
  travelWindowStart: string;
  travelWindowEnd: string;
  notifiedDate: string;
  revealAt: string;
  deskFlagCount: number;
};

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: IST });
}

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: IST });
}

function weekdayOf(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'long', timeZone: IST });
}

/** Calendar-day difference in IST, so "opens tomorrow" flips at midnight in India, not in UTC. */
function istDaysUntil(iso: string) {
  const istDay = (t: number) => Math.floor((t + 5.5 * 3_600_000) / 86_400_000);
  return istDay(new Date(iso).getTime()) - istDay(Date.now());
}

function unlocksPhrase(revealAt: string) {
  const days = istDaysUntil(revealAt);
  if (days <= 0) return `unlocks today at ${timeOf(revealAt)}`;
  if (days === 1) return `unlocks tomorrow at ${timeOf(revealAt)}`;
  return `unlocks in ${days} days`;
}

function Zone({ children, quiet = false }: { children: React.ReactNode; quiet?: boolean }) {
  return (
    <p
      className="text-[11px] font-extrabold uppercase tracking-widest"
      style={{ color: quiet ? INK_MUTED : GOLD_DARK }}
    >
      {children}
    </p>
  );
}

function DateTile({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <div
      className="w-[52px] flex-none rounded-lg border-2 py-1 text-center"
      style={{ borderColor: GOLD_TINT, backgroundColor: GOLD_WASH }}
    >
      <p className="text-[10px] font-extrabold tracking-wider" style={{ color: GOLD_DARK }}>
        {d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: IST }).toUpperCase()}
      </p>
      <p className="text-xl font-extrabold leading-tight" style={{ color: NAVY_DEEP }}>
        {d.toLocaleDateString('en-IN', { day: 'numeric', timeZone: IST })}
      </p>
      <p className="text-[10px] font-bold" style={{ color: INK_MUTED }}>
        {d.toLocaleDateString('en-IN', { month: 'short', timeZone: IST }).toUpperCase()}
      </p>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border-2 border-gray-200 bg-[#F8F9FB] px-2.5 py-2">
      <p className="text-[10.5px] font-extrabold uppercase tracking-wide" style={{ color: INK_MUTED }}>
        {k}
      </p>
      <p className="mt-0.5 text-sm font-bold" style={{ color: NAVY_DEEP }}>
        {v}
      </p>
    </div>
  );
}

function TodayCard({ visit }: { visit: TodayVisit }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [standDown, setStandDown] = useState(false);

  function confirmNoConflict() {
    setError('');
    startTransition(async () => {
      const res = await declareConflict(visit.visitId, false);
      if (!res.success) return setError(res.error ?? 'Could not record your confirmation.');
      router.push(`/app/verifier/visit/${visit.visitId}`);
    });
  }

  function recuse() {
    setError('');
    startTransition(async () => {
      const res = await declareConflict(visit.visitId, true);
      if (!res.success) return setError(res.error ?? 'Could not record it.');
      router.refresh();
    });
  }

  const inProgress = visit.arrivedAt !== null;
  const declared = visit.conflictDeclaredAt !== null;

  return (
    <div className="overflow-hidden rounded-xl border-2 bg-white" style={{ borderColor: GOLD }}>
      <div
        className="flex flex-wrap justify-between gap-2 px-4 py-2 text-[12.5px] font-extrabold text-white"
        style={{ backgroundColor: inProgress ? GOLD : GOLD_TINT }}
      >
        <span>
          {visit.recusedAt
            ? 'Stood down'
            : inProgress
              ? 'In progress'
              : declared
                ? 'Revealed · ready'
                : 'Revealed · not started'}
        </span>
        {inProgress && visit.arrivedAt && <span className="font-bold opacity-90">arrived {timeOf(visit.arrivedAt)}</span>}
      </div>

      <div className="p-4">
        <p className="text-[17px] font-extrabold leading-snug" style={{ color: NAVY_DEEP }}>
          {visit.schoolName}
        </p>
        <p className="mt-0.5 font-mono text-[11px]" style={{ color: INK_MUTED }}>
          {visit.schoolUdise}
        </p>
        <p className="mt-0.5 text-[13px] text-gray-700">
          {visit.blockName}, {visit.districtName}
        </p>
        {visit.addressEn && !inProgress && (
          <p className="mt-0.5 text-[13px]" style={{ color: INK_MUTED }}>
            {visit.addressEn}
          </p>
        )}

        {visit.recusedAt ? (
          <p className="mt-3 rounded-lg bg-[#FBE9E7] px-3 py-2 text-sm font-semibold" style={{ color: RED }}>
            You stood down from this visit. It is waiting to be reassigned.
          </p>
        ) : inProgress ? (
          <>
            <div className="mt-2.5 flex flex-wrap justify-between gap-2 text-xs font-bold">
              <span style={{ color: NAVY_DEEP }}>
                {visit.gradedCount} of {visit.totalIndicators} indicators graded
              </span>
              {visit.differCount > 0 && (
                <span style={{ color: RED }}>
                  {visit.differCount} differ from the claim
                </span>
              )}
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#EDEFF3]">
              <div
                className="h-full rounded-full"
                style={{
                  backgroundColor: GOLD,
                  width: `${visit.totalIndicators === 0 ? 0 : Math.round((visit.gradedCount / visit.totalIndicators) * 100)}%`,
                }}
              />
            </div>
            <Link
              href={`/app/verifier/visit/${visit.visitId}`}
              className="mt-3 block min-h-12 rounded-lg px-4 py-3 text-center text-[15px] font-extrabold text-white"
              style={{ backgroundColor: GOLD }}
            >
              Continue the visit
            </Link>
          </>
        ) : declared ? (
          <Link
            href={`/app/verifier/visit/${visit.visitId}`}
            className="mt-3 block min-h-12 rounded-lg px-4 py-3 text-center text-[15px] font-extrabold text-white"
            style={{ backgroundColor: GOLD }}
          >
            Open the visit workspace
          </Link>
        ) : (
          <>
            <p className="mt-3 text-[13px] font-bold" style={{ color: GOLD_DARK }}>
              Before you begin
            </p>
            <p className="mt-0.5 text-[12.5px]" style={{ color: GOLD_DARK }}>
              Confirm you have no personal, family or professional connection to this school, and
              have never held a position here or in this cluster.
            </p>
            <button
              type="button"
              onClick={confirmNoConflict}
              disabled={pending}
              className="mt-2.5 block min-h-12 w-full rounded-lg px-4 py-3 text-center text-[15px] font-extrabold text-white disabled:opacity-60"
              style={{ backgroundColor: GOLD }}
            >
              {pending ? 'One moment...' : 'I confirm, begin the visit'}
            </button>
            {/* Standing down stays possible, deliberately quiet: one link, then one confirm. */}
            {!standDown ? (
              <button
                type="button"
                onClick={() => setStandDown(true)}
                className="mt-2 text-[12px] font-bold underline"
                style={{ color: INK_MUTED }}
              >
                I have a connection to this school
              </button>
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-semibold" style={{ color: INK_MUTED }}>
                  Stand down and send this visit back for reassignment?
                </span>
                <button
                  type="button"
                  onClick={recuse}
                  disabled={pending}
                  className="rounded-lg border-2 px-3 py-1.5 text-[12px] font-extrabold disabled:opacity-60"
                  style={{ borderColor: RED, color: RED }}
                >
                  Yes, stand down
                </button>
                <button
                  type="button"
                  onClick={() => setStandDown(false)}
                  disabled={pending}
                  className="rounded-lg border-2 border-gray-300 px-3 py-1.5 text-[12px] font-extrabold text-gray-700 disabled:opacity-60"
                >
                  Keep
                </button>
              </div>
            )}
            {error && (
              <p role="alert" className="mt-2 text-sm font-semibold" style={{ color: RED }}>
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function UpcomingRow({ visit, open, onToggle }: { visit: UpcomingVisit; open: boolean; onToggle: () => void }) {
  const range = `${shortDate(visit.travelWindowStart)} to ${shortDate(visit.travelWindowEnd)}`;
  return (
    <div className="rounded-xl border-2 bg-white" style={{ borderColor: open ? GOLD : '#E5E7EB' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        <DateTile iso={visit.notifiedDate} />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-extrabold" style={{ color: NAVY_DEEP }}>
            {visit.districtName} district
          </span>
          <span className="mt-0.5 block text-xs" style={{ color: INK_MUTED }}>
            {open
              ? `Sealed · school information ${unlocksPhrase(visit.revealAt)}`
              : `Travel ${range} · school information unlocks ${timeOf(visit.revealAt)}`}
          </span>
        </span>
        {!open && visit.deskFlagCount > 0 && (
          <span
            className="flex-none rounded-full px-2.5 py-0.5 text-[11px] font-extrabold text-white"
            style={{ backgroundColor: NAVY_DEEP }}
          >
            {visit.deskFlagCount} flagged at desk
          </span>
        )}
        <span
          aria-hidden
          className="flex-none text-lg font-bold transition-transform"
          style={{ color: open ? GOLD_DARK : INK_MUTED, transform: open ? 'rotate(90deg)' : 'none' }}
        >
          ›
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2.5 border-t-2 p-3" style={{ borderColor: GOLD_WASH }}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Fact k="Travel window" v={range} />
            <Fact k="Inspection day" v={`${weekdayOf(visit.notifiedDate)} ${shortDate(visit.notifiedDate)}`} />
            <Fact k="Information unlocks" v={`${timeOf(visit.revealAt)} on the day`} />
            <Fact
              k="Flagged at desk"
              v={visit.deskFlagCount > 0 ? `${visit.deskFlagCount} ${visit.deskFlagCount === 1 ? 'indicator' : 'indicators'}` : 'None'}
            />
          </div>

          <div className="rounded-lg border-2 px-3 py-2.5" style={{ borderColor: GOLD_TINT, backgroundColor: GOLD_WASH }}>
            <p className="text-[13px] font-extrabold" style={{ color: GOLD_DARK }}>
              Why you cannot see the school yet
            </p>
            <p className="mt-1 text-[12.5px]" style={{ color: GOLD_DARK }}>
              Which school you are visiting is not held on this device before{' '}
              {timeOf(visit.revealAt)} on {weekdayOf(visit.notifiedDate)}. Anyone opening this
              page, or reading its network traffic, sees exactly what you see now. Travel to the
              district and open this row on the morning of the inspection.
            </p>
            {visit.deskFlagCount > 0 && (
              <div className="mt-2.5 border-t-2 border-dashed pt-2.5" style={{ borderColor: GOLD_TINT }}>
                <p className="text-[13px] font-extrabold" style={{ color: NAVY_DEEP }}>
                  {visit.deskFlagCount} {visit.deskFlagCount === 1 ? 'indicator' : 'indicators'} flagged
                  at desk screening {visit.deskFlagCount === 1 ? 'waits' : 'wait'} behind the seal
                </p>
                <p className="mt-1 text-xs" style={{ color: INK_MUTED }}>
                  The online cell&apos;s notes open with the school on reveal morning, inside the
                  visit workspace. The school has not seen them.
                </p>
              </div>
            )}
          </div>

          <p className="text-xs" style={{ color: INK_MUTED }}>
            At {timeOf(visit.revealAt)} on {weekdayOf(visit.notifiedDate)} this row becomes the
            school card, with the confirmation before anything else.
          </p>
        </div>
      )}
    </div>
  );
}

export function FieldAssignmentsList({
  today,
  upcoming,
  signedOffCount,
}: {
  today: TodayVisit[];
  upcoming: UpcomingVisit[];
  signedOffCount: number;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const now = new Date();
  const todayLabel = `${now.toLocaleDateString('en-IN', { weekday: 'long', timeZone: IST })} ${now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', timeZone: IST })}`;
  const next = upcoming[0] ?? null;
  const nextWindowOpen = next !== null && new Date(next.travelWindowStart).getTime() <= Date.now();

  return (
    <div className="flex flex-col gap-3">
      <Zone>Today · {todayLabel}</Zone>

      {today.length === 0 ? (
        <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
          <p className="text-[17px] font-extrabold" style={{ color: INK_MUTED }}>
            Nothing to visit today
          </p>
          {next ? (
            <p className="mt-1.5 text-[13px] text-gray-700">
              Your next visit is in {next.districtName} district; the school information{' '}
              {unlocksPhrase(next.revealAt)}.{' '}
              {nextWindowOpen
                ? `The travel window is already open, ${shortDate(next.travelWindowStart)} to ${shortDate(next.travelWindowEnd)}.`
                : `The travel window is ${shortDate(next.travelWindowStart)} to ${shortDate(next.travelWindowEnd)}.`}
            </p>
          ) : (
            <p className="mt-1.5 text-[13px] text-gray-700">
              Nothing is sealed for later either. New assignments appear here once SSSA builds the
              next field cohort.
            </p>
          )}
        </div>
      ) : (
        today.map((visit) => <TodayCard key={visit.visitId} visit={visit} />)
      )}

      {upcoming.length > 0 && (
        <>
          <Zone quiet>
            Coming up
            <span className="mt-0.5 block text-[11.5px] font-semibold normal-case tracking-normal" style={{ color: INK_MUTED }}>
              Sealed until inspection morning: you know where to travel, not which school. Tap a
              row to open it.
            </span>
          </Zone>
          {upcoming.map((visit) => (
            <UpcomingRow
              key={visit.visitId}
              visit={visit}
              open={openId === visit.visitId}
              onToggle={() => setOpenId((id) => (id === visit.visitId ? null : visit.visitId))}
            />
          ))}
        </>
      )}

      {signedOffCount > 0 && (
        <div
          className="flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-[13px] font-bold"
          style={{ borderColor: '#BFE0CF', backgroundColor: GREEN_WASH, color: GREEN }}
        >
          <span aria-hidden>✓</span>
          <span>
            {signedOffCount.toLocaleString('en-IN')} {signedOffCount === 1 ? 'visit' : 'visits'} signed
            off this cycle. Appeals on them show on your Overview.
          </span>
        </div>
      )}
    </div>
  );
}
