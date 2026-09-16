'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { WalkthroughQueueRow } from '@/lib/actions/walkthrough';
import { ClaimWalkthroughButton } from '@/components/verifier/ClaimWalkthroughButton';

/**
 * The walkthrough queue's list, with its zones and its filters.
 *
 * Four zones sorted by whether the verifier can act, not by which clock expires first. Ordering
 * by clock alone would put "24 hours left" on a school that is still filming above a call due in
 * five days, although one needs the verifier and the other does not. The question the page
 * answers is what to do next.
 *
 * The filters are deliberately orthogonal to the zones. Filtering by "what can I act on" would
 * only reproduce the Do now heading two inches lower; what a zone cannot answer is "where is the
 * case somebody just emailed me about", "show me only the recordings", and "what is late". So:
 * a find bar on the masked code, a route filter, and a turnaround toggle. They appear at volume
 * only, because on a nine case queue a filter bar is furniture.
 */

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const NAVY_WASH = '#EEF2F9';
const INK_MUTED = '#5F7190';
const GOLD = '#BF9000';
const GOLD_TINT = '#D0AD42';
const GOLD_DARK = '#7A5209';
const GOLD_WASH = '#FDF8EC';
const RED = '#96271E';
const RED_WASH = '#FBE9E7';
const GREEN = '#14603A';
const GREEN_WASH = '#E7F5EE';

const IST = 'Asia/Kolkata';

/** Below this the queue is short enough to read, and controls are clutter. */
const FILTER_BAR_MIN = 6;

/**
 * A walkthrough call runs for tens of minutes. Past this it is not a call in progress, it is a
 * session somebody never closed, and saying "Live now" on it is a lie that hides a real problem.
 */
const STALE_CALL_HOURS = 4;

const weekdayTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: IST,
  });

function daysFromNow(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function hoursSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
}

const recording = (row: WalkthroughQueueRow) => row.sessionState === 'GUIDED_CAPTURE';

/** Every clip asked for has come back, so the case can be settled now. */
const clipsComplete = (row: WalkthroughQueueRow) =>
  recording(row) && row.disputed > 0 && (row.clipsReturned ?? 0) >= row.disputed;

const minutesLive = (row: WalkthroughQueueRow) =>
  row.startedAt ? Math.max(0, Math.floor((Date.now() - new Date(row.startedAt).getTime()) / 60_000)) : 0;

const staleCall = (row: WalkthroughQueueRow) =>
  row.sessionState === 'LIVE' && minutesLive(row) > STALE_CALL_HOURS * 60;

/**
 * How long a session has been open, in a unit a person reads.
 *
 * Minutes stop being legible somewhere around an hour and a half; a session left open for weeks
 * printed 37,308 minutes, which is a number nobody can convert at a glance.
 */
function elapsed(row: WalkthroughQueueRow): { value: number; label: string } {
  const minutes = minutesLive(row);
  if (minutes < 90) return { value: minutes, label: 'min in' };
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return { value: hours, label: hours === 1 ? 'hour in' : 'hours in' };
  const days = Math.floor(hours / 24);
  return { value: days, label: days === 1 ? 'day open' : 'days open' };
}

/**
 * The school's category, as stored.
 *
 * Two conventions live in this column: the grade stage for hand-seeded schools, and an ownership
 * type for the bulk register. Both are printed as written rather than translated, because a
 * screener needs to know which they are looking at; only the underscores go, since a raw enum on
 * screen is a bug whichever convention it belongs to.
 */
const prettyCategory = (c: string) =>
  /^[A-Z][A-Z_]*$/.test(c)
    ? c.replace(/_/g, ' ').toLowerCase().replace(/^./, (m) => m.toUpperCase())
    : c;

/**
 * The left-hand tile, which states the clock that governs its own row.
 *
 * A live call shows time elapsed, because while the school is on the line the turnaround is not
 * the thing that matters. A school still filming shows hours of its own window. Everything else
 * shows the turnaround. One column, one meaning per row, and none of them borrowed.
 */
function StateTile({ row }: { row: WalkthroughQueueRow }) {
  const tile = (value: number, label: string, border: string, bg: string, ink: string) => (
    <span className="w-16 flex-none rounded-lg border-2 py-1 text-center" style={{ borderColor: border, backgroundColor: bg }}>
      <span className="block text-lg font-extrabold leading-tight tabular-nums" style={{ color: ink }}>
        {value.toLocaleString('en-IN')}
      </span>
      <span className="block text-[9px] font-extrabold uppercase tracking-wide" style={{ color: ink }}>
        {label}
      </span>
    </span>
  );

  if (row.sessionState === 'LIVE' && row.startedAt) {
    const { value, label } = elapsed(row);
    return staleCall(row)
      ? tile(value, label, GOLD_TINT, GOLD_WASH, GOLD_DARK)
      : tile(value, label, '#BFE0CF', GREEN_WASH, GREEN);
  }

  const days = daysFromNow(row.dueBy);
  if (row.overdue) {
    const over = Math.abs(days);
    return tile(over, over === 1 ? 'day over' : 'days over', RED, RED_WASH, RED);
  }

  if (recording(row)) {
    // The window is shut: these are all the clips there will ever be, so the count is the fact
    // that matters rather than a deadline nobody can meet.
    if (row.windowClosed) return tile(row.clipsReturned ?? 0, `of ${row.disputed} in`, RED, RED_WASH, RED);
    if (clipsComplete(row)) return tile(row.clipsReturned ?? 0, `of ${row.disputed} in`, '#BFE0CF', GREEN_WASH, GREEN);
    const left = row.hoursLeft ?? 0;
    return tile(left, left === 1 ? 'hour left' : 'hours left', GOLD_TINT, GOLD_WASH, GOLD_DARK);
  }

  return days <= 2
    ? tile(days, days === 1 ? 'day left' : 'days left', GOLD_TINT, GOLD_WASH, GOLD_DARK)
    : tile(days, days === 1 ? 'day left' : 'days left', '#C7D2E8', NAVY_WASH, NAVY_DEEP);
}

function StateChip({ row }: { row: WalkthroughQueueRow }) {
  if (row.sessionState === 'LIVE') {
    // A session open for days is not a call. Saying so is the point: somebody has to close it.
    return staleCall(row) ? (
      <span
        className="rounded-full border px-2.5 py-0.5 text-[10.5px] font-extrabold"
        style={{ borderColor: GOLD_TINT, backgroundColor: GOLD_WASH, color: GOLD_DARK }}
      >
        Call left open
      </span>
    ) : (
      <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold text-white" style={{ backgroundColor: GREEN }}>
        Live now
      </span>
    );
  }
  if (recording(row)) {
    if (row.windowClosed) {
      return (
        <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold text-white" style={{ backgroundColor: RED }}>
          Window closed short
        </span>
      );
    }
    if (clipsComplete(row)) {
      return (
        <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold" style={{ backgroundColor: GREEN_WASH, color: GREEN }}>
          All clips returned
        </span>
      );
    }
    return (
      <span
        className="rounded-full border px-2.5 py-0.5 text-[10.5px] font-extrabold"
        style={{ borderColor: GOLD_TINT, backgroundColor: GOLD_WASH, color: GOLD_DARK }}
      >
        Recording
      </span>
    );
  }
  if (row.sessionState === 'SCHEDULED' && row.scheduledFor) {
    const past = new Date(row.scheduledFor).getTime() < Date.now();
    return (
      <span
        className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold"
        style={past ? { backgroundColor: RED_WASH, color: RED } : { backgroundColor: NAVY_WASH, color: NAVY }}
      >
        {past ? 'Missed ' : 'Scheduled '}
        {weekdayTime(row.scheduledFor)}
      </span>
    );
  }
  return null;
}

/** What this case will involve, in the fewest words that are still true. */
function metaFor(row: WalkthroughQueueRow): string {
  const bits: string[] = [prettyCategory(row.category)];

  if (recording(row)) {
    const returned = row.clipsReturned ?? 0;
    const missing = Math.max(0, row.disputed - returned);
    if (row.windowClosed) {
      bits.push(`${returned.toLocaleString('en-IN')} of ${row.disputed.toLocaleString('en-IN')} clips returned`);
      if (missing > 0) bits.push(`${missing.toLocaleString('en-IN')} never sent`);
    } else if (clipsComplete(row)) {
      bits.push(row.lastClipAt ? `last clip arrived ${hoursSince(row.lastClipAt)} hours ago` : 'every clip is in');
      if (row.hoursLeft !== null) bits.push(`${row.hoursLeft} h of the window left`);
    } else {
      bits.push(
        returned === 0
          ? 'nothing returned yet'
          : `${returned.toLocaleString('en-IN')} of ${row.disputed.toLocaleString('en-IN')} clips returned`,
      );
      if (returned > 0 && row.lastClipAt) bits.push(`last arrived ${hoursSince(row.lastClipAt)} hours ago`);
    }
  } else if (row.observed > 0) {
    bits.push(`${row.observed.toLocaleString('en-IN')} of ${row.disputed.toLocaleString('en-IN')} observed`);
  } else {
    bits.push(`${row.disputed.toLocaleString('en-IN')} disputed ${row.disputed === 1 ? 'indicator' : 'indicators'}`);
  }

  // An unclaimed row has to justify itself: the score is why it is here at all.
  if (!row.mine && row.riskScore !== null) bits.push(`risk ${row.riskScore}%`);
  return bits.join(' · ');
}

/** The one thing this row is for. A recording case says how much there is to look at. */
function actionLabel(row: WalkthroughQueueRow): string {
  if (row.sessionState === 'LIVE') return staleCall(row) ? 'Open and close it' : 'Rejoin the call';
  if (recording(row)) {
    if (row.windowClosed) return 'Review and send to the field';
    if (clipsComplete(row)) return 'Review the clips';
    const returned = row.clipsReturned ?? 0;
    return returned > 0 ? `Review ${returned} so far` : 'Open case';
  }
  return 'Open console';
}

function QueueRow({ row, quiet }: { row: WalkthroughQueueRow; quiet?: boolean }) {
  const live = row.sessionState === 'LIVE' && !staleCall(row);
  const done = clipsComplete(row) && !row.windowClosed;
  const border = live || done
    ? GREEN
    : row.overdue || (recording(row) && row.windowClosed)
      ? RED
      : recording(row) || staleCall(row)
        ? GOLD_TINT
        : '#E5E7EB';

  const actionStyle = live || done
    ? { backgroundColor: GREEN, color: 'white' }
    : quiet
      ? { backgroundColor: 'white', border: '2px solid #D1D5DB', color: '#3C4A61' }
      : { backgroundColor: NAVY, color: 'white' };

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-xl border-2 px-3 py-2.5"
      style={{ borderColor: border, backgroundColor: quiet ? '#FAFBFD' : 'white' }}
    >
      <StateTile row={row} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-bold" style={{ color: NAVY_DEEP }}>
            {row.maskedCode}
          </span>
          <StateChip row={row} />
        </span>
        <span className="mt-0.5 block text-xs" style={{ color: INK_MUTED }}>
          {metaFor(row)}
        </span>
      </span>
      {/* Progress against the agenda, whichever route the case took: clips returned for a
          recording, indicators settled for a call. */}
      <span className="hidden h-2 w-24 flex-none overflow-hidden rounded-full bg-[#EDEFF3] sm:block">
        <span
          className="block h-full rounded-full"
          style={{
            backgroundColor: row.overdue || (recording(row) && row.windowClosed) ? RED : done || live ? GREEN : GOLD,
            width: `${
              row.disputed === 0
                ? 0
                : Math.min(100, Math.round(((recording(row) ? (row.clipsReturned ?? 0) : row.observed) / row.disputed) * 100))
            }%`,
          }}
        />
      </span>
      {row.mine ? (
        <Link
          href={`/app/verifier/walkthrough/${row.runId}`}
          className="flex-none rounded-lg px-4 py-2 text-sm font-bold"
          style={actionStyle}
        >
          {actionLabel(row)}
        </Link>
      ) : (
        <ClaimWalkthroughButton runId={row.runId} />
      )}
    </div>
  );
}

function Zone({
  label,
  explain,
  colour,
  rows,
  quiet,
}: {
  label: string;
  explain?: string;
  colour: string;
  rows: WalkthroughQueueRow[];
  quiet?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="space-y-3">
      <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: colour }}>
        {label} · {rows.length.toLocaleString('en-IN')}
        {explain && (
          <span className="mt-0.5 block text-[11.5px] font-semibold normal-case tracking-normal" style={{ color: INK_MUTED }}>
            {explain}
          </span>
        )}
      </p>
      {rows.map((row) => (
        <QueueRow key={row.runId} row={row} quiet={quiet} />
      ))}
    </section>
  );
}

type Route = 'ALL' | 'CALLS' | 'RECORDINGS';

function RouteChip({
  label,
  count,
  on,
  onClick,
}: {
  label: string;
  count: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border-2 px-3 py-1.5 text-xs font-bold"
      style={on ? { borderColor: NAVY, backgroundColor: NAVY, color: 'white' } : { borderColor: '#D1D5DB', color: '#3C4A61' }}
    >
      {label}
      <span className="ml-1.5 tabular-nums" style={{ opacity: 0.8 }}>
        {count.toLocaleString('en-IN')}
      </span>
    </button>
  );
}

export function WalkthroughQueueList({ rows }: { rows: WalkthroughQueueRow[] }) {
  const [route, setRoute] = useState<Route>('ALL');
  const [lateOnly, setLateOnly] = useState(false);
  const [find, setFind] = useState('');

  const counts = useMemo(
    () => ({
      all: rows.length,
      calls: rows.filter((r) => !recording(r)).length,
      recordings: rows.filter(recording).length,
      late: rows.filter((r) => r.overdue).length,
    }),
    [rows],
  );

  const shown = useMemo(() => {
    const needle = find.trim().toUpperCase();
    return rows.filter((r) => {
      if (route === 'CALLS' && recording(r)) return false;
      if (route === 'RECORDINGS' && !recording(r)) return false;
      if (lateOnly && !r.overdue) return false;
      if (needle && !r.maskedCode.toUpperCase().includes(needle)) return false;
      return true;
    });
  }, [rows, route, lateOnly, find]);

  const filtered = shown.length !== rows.length;

  // Live first, then the deadline. A call in progress outranks every clock on the page.
  const byUrgency = (a: WalkthroughQueueRow, b: WalkthroughQueueRow) =>
    (a.sessionState === 'LIVE' ? 0 : 1) - (b.sessionState === 'LIVE' ? 0 : 1) ||
    Date.parse(a.dueBy) - Date.parse(b.dueBy);

  const mine = shown.filter((r) => r.mine);
  const unclaimed = shown.filter((r) => !r.mine).sort(byUrgency);

  // Can this be finished now? A live call, a complete pile of clips, a window that shut with
  // clips missing, or anything already past the turnaround.
  const canAct = (r: WalkthroughQueueRow) =>
    r.sessionState === 'LIVE' || r.overdue || (recording(r) && (clipsComplete(r) || r.windowClosed));

  const doNow = mine.filter(canAct).sort(byUrgency);
  // A school still filming. Sorted by its own clock, which is the only one that applies.
  const waiting = mine
    .filter((r) => !canAct(r) && recording(r))
    .sort((a, b) => (a.hoursLeft ?? 9999) - (b.hoursLeft ?? 9999));
  const yours = mine.filter((r) => !canAct(r) && !recording(r)).sort(byUrgency);

  return (
    <div className="space-y-5">
      <p className="text-sm font-semibold" style={{ color: counts.late > 0 ? RED : INK_MUTED }}>
        {counts.all.toLocaleString('en-IN')} open {counts.all === 1 ? 'case' : 'cases'}
        {counts.late > 0 && ` · ${counts.late.toLocaleString('en-IN')} past the turnaround`}
      </p>

      {rows.length >= FILTER_BAR_MIN && (
        <div className="space-y-2 rounded-xl border-2 border-gray-200 bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <RouteChip label="All" count={counts.all} on={route === 'ALL'} onClick={() => setRoute('ALL')} />
            <RouteChip label="Calls" count={counts.calls} on={route === 'CALLS'} onClick={() => setRoute('CALLS')} />
            <RouteChip
              label="Recordings"
              count={counts.recordings}
              on={route === 'RECORDINGS'}
              onClick={() => setRoute('RECORDINGS')}
            />
            <span className="mx-1 h-6 w-px flex-none bg-gray-200" aria-hidden />
            <button
              type="button"
              onClick={() => setLateOnly(!lateOnly)}
              className="rounded-full border-2 px-3 py-1.5 text-xs font-bold"
              style={lateOnly ? { borderColor: RED, backgroundColor: RED, color: 'white' } : { borderColor: '#D1D5DB', color: '#3C4A61' }}
            >
              Past the turnaround
              <span className="ml-1.5 tabular-nums" style={{ opacity: 0.8 }}>
                {counts.late.toLocaleString('en-IN')}
              </span>
            </button>
            <label className="ml-auto flex items-center gap-2">
              <span className="sr-only">Find a case by its code</span>
              <input
                id="walkthrough-find"
                type="search"
                value={find}
                onChange={(e) => setFind(e.target.value)}
                placeholder="Find a code, e.g. AC5DF"
                className="w-44 rounded-lg border-2 border-gray-300 px-3 py-1.5 text-xs"
              />
            </label>
          </div>

          {/* A filtered page must never masquerade as the whole queue. */}
          {filtered && (
            <p className="flex flex-wrap items-center gap-2 text-xs" style={{ color: INK_MUTED }}>
              Showing {shown.length.toLocaleString('en-IN')} of {counts.all.toLocaleString('en-IN')}{' '}
              {counts.all === 1 ? 'case' : 'cases'}.
              <button
                type="button"
                onClick={() => {
                  setRoute('ALL');
                  setLateOnly(false);
                  setFind('');
                }}
                className="font-bold underline"
                style={{ color: NAVY }}
              >
                Show everything
              </button>
            </p>
          )}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="rounded-xl border-2 border-gray-200 bg-white p-5 text-sm" style={{ color: INK_MUTED }}>
          No case matches those filters. {counts.all.toLocaleString('en-IN')} are open in total.
        </p>
      ) : (
        <>
          <Zone
            label="Do now"
            explain="A call in progress, clip piles that are complete, and anything past the turnaround."
            colour={GREEN}
            rows={doNow}
          />
          <Zone
            label="Yours, not yet started"
            explain="Calls to place or keep. Deadline order."
            colour={NAVY}
            rows={yours}
          />
          <Zone
            label="Waiting on a school"
            explain="Nothing is needed from you until the clips arrive. Listed so you know they exist, not so you act on them."
            colour={GOLD_DARK}
            rows={waiting}
            quiet
          />
          <Zone
            label="Unclaimed"
            explain="Anyone in the online cell can take these. Claiming is recorded."
            colour={INK_MUTED}
            rows={unclaimed}
          />
        </>
      )}
    </div>
  );
}
