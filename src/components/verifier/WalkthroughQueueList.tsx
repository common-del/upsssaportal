'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { WalkthroughQueueRow } from '@/lib/actions/walkthrough';
import { ClaimWalkthroughButton } from '@/components/verifier/ClaimWalkthroughButton';

/**
 * The walkthrough queue, as one case in front of you and the rest on a rail.
 *
 * The page answers "what now" with an answer rather than the raw material of one. The next case
 * fills the left with everything needed to start it, including which of its disputed indicators
 * are still to check, so a verifier knows what they are walking into before the console opens.
 * Everything else compresses into a rail that still shows the whole queue, grouped the way the
 * work groups.
 *
 * The rail's groups sort by whether the verifier can act, not by which clock expires first. A
 * call runs against the seven day deadline and a school's filming time against forty-eight
 * hours, so ordering by whichever runs out first would put a school that is still filming above
 * a call due next week, although one needs the verifier and the other does not.
 *
 * Two controls, and no filter panel. The search field answers "where is the case somebody just
 * emailed me about", which is the question asked several times a day and the reason the code is
 * worth searching at all, being the only name a case has. The summary line beneath it was
 * already printing its counts and doing nothing with them, so pressing a number filters to it:
 * the duplicate becomes the control rather than sitting beside one.
 */

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const GOLD_DARK = '#7A5209';
const GOLD_WASH = '#FDF8EC';
const RED = '#96271E';
const RED_WASH = '#FBE9E7';
const GREEN = '#14603A';
const GREEN_WASH = '#E7F5EE';

const IST = 'Asia/Kolkata';

/**
 * A walkthrough call runs for tens of minutes. Past this it is not a call in progress, it is a
 * session somebody never closed, and saying "Live now" on it is a lie that hides a real problem.
 */
const STALE_CALL_HOURS = 4;

/** How many indicators the focus panel lists before it stops and counts the rest. */
const AGENDA_SHOWN = 5;

const weekdayTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: IST,
  });

const dayMonth = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', timeZone: IST });

const daysFromNow = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
const hoursSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);

const recording = (row: WalkthroughQueueRow) => row.sessionState === 'GUIDED_CAPTURE';

/** Every video asked for has come back, so the case can be settled now. */
const videosIn = (row: WalkthroughQueueRow) =>
  recording(row) && row.disputed > 0 && (row.clipsReturned ?? 0) >= row.disputed;

const minutesLive = (row: WalkthroughQueueRow) =>
  row.startedAt ? Math.max(0, Math.floor((Date.now() - new Date(row.startedAt).getTime()) / 60_000)) : 0;

const staleCall = (row: WalkthroughQueueRow) =>
  row.sessionState === 'LIVE' && minutesLive(row) > STALE_CALL_HOURS * 60;

/** Can this be finished now? A live call, every video in, a filming time that ran out with
 *  videos missing, or anything already past the deadline. */
const canAct = (r: WalkthroughQueueRow) =>
  r.sessionState === 'LIVE' || r.overdue || (recording(r) && (videosIn(r) || r.windowClosed));

/**
 * The clock that governs a row, in a unit a person reads.
 *
 * Minutes stop being legible around an hour and a half; a session left open for weeks printed
 * 37,308 minutes, which is a number nobody converts at a glance.
 */
function clockFor(row: WalkthroughQueueRow): { value: number; label: string; tone: string } {
  if (row.sessionState === 'LIVE' && row.startedAt) {
    const minutes = minutesLive(row);
    const tone = staleCall(row) ? GOLD_DARK : GREEN;
    if (minutes < 90) return { value: minutes, label: 'min in', tone };
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return { value: hours, label: hours === 1 ? 'hour in' : 'hours in', tone };
    const days = Math.floor(hours / 24);
    return { value: days, label: days === 1 ? 'day open' : 'days open', tone };
  }

  const days = daysFromNow(row.dueBy);
  if (row.overdue) {
    const over = Math.abs(days);
    return { value: over, label: over === 1 ? 'day over' : 'days over', tone: RED };
  }

  if (recording(row)) {
    // The filming time is up: these are all the videos there will ever be, so the count is the
    // fact that matters rather than a deadline nobody can meet.
    if (row.windowClosed) return { value: row.clipsReturned ?? 0, label: `of ${row.disputed} in`, tone: RED };
    if (videosIn(row)) return { value: row.clipsReturned ?? 0, label: `of ${row.disputed} in`, tone: GREEN };
    const left = row.hoursLeft ?? 0;
    return { value: left, label: left === 1 ? 'hour left' : 'hours left', tone: GOLD_DARK };
  }

  return {
    value: days,
    label: days === 1 ? 'day left' : 'days left',
    tone: days <= 2 ? GOLD_DARK : NAVY_DEEP,
  };
}

type State = { label: string; tone: string; solid: boolean } | null;

function stateFor(row: WalkthroughQueueRow): State {
  if (row.sessionState === 'LIVE') {
    // A session open for days is not a call. Saying so is the point: somebody has to close it.
    return staleCall(row)
      ? { label: 'Call left open', tone: GOLD_DARK, solid: false }
      : { label: 'Live now', tone: GREEN, solid: true };
  }
  if (recording(row)) {
    if (row.windowClosed) return { label: 'Window closed short', tone: RED, solid: true };
    if (videosIn(row)) return { label: 'All videos returned', tone: GREEN, solid: false };
    // "Recording" named no actor and could be read as the verifier recording something. This
    // says who is doing what.
    return { label: 'School is filming', tone: GOLD_DARK, solid: false };
  }
  if (row.sessionState === 'SCHEDULED' && row.scheduledFor) {
    const past = new Date(row.scheduledFor).getTime() < Date.now();
    return past
      ? { label: `Missed ${weekdayTime(row.scheduledFor)}`, tone: RED, solid: false }
      : { label: `Scheduled ${weekdayTime(row.scheduledFor)}`, tone: NAVY, solid: false };
  }
  return null;
}

/**
 * The school's category, as stored.
 *
 * Two conventions live in this column: the grade stage for hand-seeded schools, and an ownership
 * type for the bulk register. Both are printed as written, because a screener needs to know which
 * they are looking at; only the underscores go, since a raw enum on screen is a bug whichever
 * convention it belongs to.
 */
const prettyCategory = (c: string) =>
  /^[A-Z][A-Z_]*$/.test(c) ? c.replace(/_/g, ' ').toLowerCase().replace(/^./, (m) => m.toUpperCase()) : c;

/** The one line that says why this case is in front of you. */
function whyFor(row: WalkthroughQueueRow): string {
  const returned = row.clipsReturned ?? 0;
  const missing = Math.max(0, row.disputed - returned);

  if (staleCall(row) && row.startedAt) {
    return `A call was started on ${dayMonth(row.startedAt)} and never ended. Until the session is closed this case cannot leave the queue.`;
  }
  if (row.sessionState === 'LIVE') return 'The school is on the line now.';
  if (recording(row)) {
    if (row.windowClosed) {
      return missing > 0
        ? `The filming time ran out with ${missing.toLocaleString('en-IN')} ${missing === 1 ? 'video' : 'videos'} never sent. Those indicators cannot be settled from a screen, so the case goes for a visit.`
        : 'The filming time has ended. Every video the school sent is here.';
    }
    if (videosIn(row)) {
      return `Every video the school was asked for has arrived${row.lastClipAt ? `, the last one ${hoursSince(row.lastClipAt)} hours ago` : ''}. Settle these and the case moves on.`;
    }
    return `The school has sent ${returned.toLocaleString('en-IN')} of ${row.disputed.toLocaleString('en-IN')} videos${row.hoursLeft !== null ? `, with ${row.hoursLeft} hours left to send the rest` : ''}. Nothing is needed from you until they arrive.`;
  }
  if (row.overdue) {
    const over = Math.abs(daysFromNow(row.dueBy));
    return `This case passed its deadline ${over.toLocaleString('en-IN')} ${over === 1 ? 'day' : 'days'} ago and has not been settled.`;
  }
  if (row.sessionState === 'SCHEDULED' && row.scheduledFor) {
    return `A call is scheduled for ${weekdayTime(row.scheduledFor)}.`;
  }
  const left = daysFromNow(row.dueBy);
  return `Not started. ${left.toLocaleString('en-IN')} ${left === 1 ? 'day' : 'days'} left to settle it or send a field team.`;
}

/** The one thing this case is for. */
function actionFor(row: WalkthroughQueueRow): string {
  if (row.sessionState === 'LIVE') return staleCall(row) ? 'Open' : 'Rejoin the call';
  if (recording(row)) {
    if (row.windowClosed) return 'Review and send to the field';
    if (videosIn(row)) return 'Review the videos';
    return (row.clipsReturned ?? 0) > 0 ? `Review ${row.clipsReturned} so far` : 'Open';
  }
  return 'Open';
}

/**
 * A pressable count.
 *
 * Prose that behaves like a button has to be a real button with a visible focus state, or it is
 * a control only a mouse user can find. aria-pressed carries the on state to a screen reader,
 * and the dotted underline is what says "press me" to everyone else.
 */
function Pick({
  label,
  on,
  tone,
  onClick,
}: {
  label: string;
  on: boolean;
  tone?: string;
  onClick: () => void;
}) {
  const colour = tone ?? NAVY;
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="rounded px-1.5 py-0.5 font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
      style={
        on
          ? { backgroundColor: colour, color: 'white', borderBottom: `2px solid ${colour}` }
          : { color: colour, borderBottom: '2px dotted #94A3C4' }
      }
    >
      {label}
    </button>
  );
}

function RailItem({
  row,
  focused,
  onFocus,
}: {
  row: WalkthroughQueueRow;
  focused: boolean;
  onFocus: () => void;
}) {
  const clock = clockFor(row);
  const state = stateFor(row);
  return (
    <button
      type="button"
      onClick={onFocus}
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left focus:outline-none focus-visible:ring-2"
      style={focused ? { backgroundColor: 'white', boxShadow: '0 0 0 2px #C7D2E8' } : undefined}
    >
      <span className="w-11 flex-none text-right">
        <span className="block text-[13px] font-extrabold leading-none tabular-nums" style={{ color: clock.tone }}>
          {clock.value.toLocaleString('en-IN')}
        </span>
        <span className="mt-0.5 block text-[8px] font-bold uppercase leading-none" style={{ color: clock.tone }}>
          {clock.label}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-[11.5px] font-bold" style={{ color: NAVY_DEEP }}>
          {row.maskedCode}
        </span>
        <span className="block truncate text-[10.5px]" style={{ color: INK_MUTED }}>
          {state ? state.label : `${row.disputed} disputed`}
        </span>
      </span>
    </button>
  );
}

function RailGroup({
  label,
  colour,
  rows,
  focusId,
  onFocus,
}: {
  label: string;
  colour: string;
  rows: WalkthroughQueueRow[];
  focusId: string | null;
  onFocus: (id: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mb-3">
      <p className="px-2 pb-1 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: colour }}>
        {label} · {rows.length.toLocaleString('en-IN')}
      </p>
      {rows.map((row) => (
        <RailItem key={row.runId} row={row} focused={row.runId === focusId} onFocus={() => onFocus(row.runId)} />
      ))}
    </div>
  );
}

type Route = 'ALL' | 'CALLS' | 'VIDEOS' | 'LATE';

export function WalkthroughQueueList({ rows }: { rows: WalkthroughQueueRow[] }) {
  const [route, setRoute] = useState<Route>('ALL');
  const [find, setFind] = useState('');
  const [focusId, setFocusId] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      all: rows.length,
      calls: rows.filter((r) => !recording(r)).length,
      videos: rows.filter(recording).length,
      late: rows.filter((r) => r.overdue).length,
    }),
    [rows],
  );

  const shown = useMemo(() => {
    const needle = find.trim().toUpperCase();
    return rows.filter((r) => {
      if (route === 'CALLS' && recording(r)) return false;
      if (route === 'VIDEOS' && !recording(r)) return false;
      if (route === 'LATE' && !r.overdue) return false;
      if (needle && !r.maskedCode.toUpperCase().includes(needle)) return false;
      return true;
    });
  }, [rows, route, find]);

  // Live first, then the deadline. A call in progress outranks every clock on the page.
  const byUrgency = (a: WalkthroughQueueRow, b: WalkthroughQueueRow) =>
    (a.sessionState === 'LIVE' ? 0 : 1) - (b.sessionState === 'LIVE' ? 0 : 1) ||
    Date.parse(a.dueBy) - Date.parse(b.dueBy);

  const { doNow, notStarted, waiting, unclaimed, order } = useMemo(() => {
    const mine = shown.filter((r) => r.mine);
    const d = mine.filter(canAct).sort(byUrgency);
    const w = mine
      .filter((r) => !canAct(r) && recording(r))
      .sort((a, b) => (a.hoursLeft ?? 9999) - (b.hoursLeft ?? 9999));
    const n = mine.filter((r) => !canAct(r) && !recording(r)).sort(byUrgency);
    const u = shown.filter((r) => !r.mine).sort(byUrgency);
    // The order the rail reads in, which is also the order "skip to the next case" walks.
    return { doNow: d, notStarted: n, waiting: w, unclaimed: u, order: [...d, ...n, ...w, ...u] };
  }, [shown]);

  // Focus follows the work: the first case that needs you, unless the verifier picked another
  // or a search narrowed the list under them.
  useEffect(() => {
    if (order.length === 0) {
      setFocusId(null);
      return;
    }
    setFocusId((current) => (current && order.some((r) => r.runId === current) ? current : order[0]!.runId));
  }, [order]);

  const focused = order.find((r) => r.runId === focusId) ?? null;
  const filtered = shown.length !== rows.length;

  return (
    <div className="space-y-4">
      {/* The search field, given the width it earns. Finding a case by its code is the question
          asked several times a day, and the code is the only name a case has. */}
      <div>
        <label htmlFor="walkthrough-find" className="sr-only">
          Find a case by its code
        </label>
        <input
          id="walkthrough-find"
          type="search"
          value={find}
          onChange={(e) => setFind(e.target.value)}
          placeholder="Find a case code, for example AC5DF"
          className="w-full rounded-xl border-2 px-4 py-3 text-sm"
          style={{ borderColor: '#C7D2E8', backgroundColor: '#F7F9FD' }}
        />
      </div>

      <p className="flex flex-wrap items-center gap-1 text-sm font-semibold" style={{ color: INK_MUTED }}>
        <Pick label={`${counts.all.toLocaleString('en-IN')} open`} on={route === 'ALL'} onClick={() => setRoute('ALL')} />
        <span aria-hidden>·</span>
        <Pick label={`${counts.calls.toLocaleString('en-IN')} calls`} on={route === 'CALLS'} onClick={() => setRoute('CALLS')} />
        <span aria-hidden>·</span>
        <Pick label={`${counts.videos.toLocaleString('en-IN')} videos`} on={route === 'VIDEOS'} onClick={() => setRoute('VIDEOS')} />
        <span aria-hidden>·</span>
        <Pick
          label={`${counts.late.toLocaleString('en-IN')} past the deadline`}
          on={route === 'LATE'}
          tone={RED}
          onClick={() => setRoute('LATE')}
        />
        {(filtered || find.trim() !== '') && (
          <>
            <span aria-hidden>·</span>
            <span className="font-normal">showing {shown.length.toLocaleString('en-IN')}</span>
            <button
              type="button"
              onClick={() => {
                setRoute('ALL');
                setFind('');
              }}
              className="font-bold underline"
              style={{ color: NAVY }}
            >
              show everything
            </button>
          </>
        )}
      </p>

      {shown.length === 0 ? (
        <p className="rounded-xl border-2 border-gray-200 bg-white p-5 text-sm" style={{ color: INK_MUTED }}>
          No case matches. {counts.all.toLocaleString('en-IN')} are open in total.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_272px]">
            {focused && (
              <FocusPanel
                row={focused}
                canSkip={order.length > 1}
                onSkip={() => {
                  const i = order.findIndex((r) => r.runId === focused.runId);
                  const next = order[(i + 1) % order.length];
                  if (next) setFocusId(next.runId);
                }}
              />
            )}

            <div className="border-t border-gray-100 bg-[#FAFBFD] p-3 lg:border-l lg:border-t-0">
              <RailGroup label="Do now" colour={GREEN} rows={doNow} focusId={focusId} onFocus={setFocusId} />
              <RailGroup label="Not started" colour={NAVY} rows={notStarted} focusId={focusId} onFocus={setFocusId} />
              <RailGroup label="Waiting on a school" colour={GOLD_DARK} rows={waiting} focusId={focusId} onFocus={setFocusId} />
              <RailGroup label="Unclaimed" colour={INK_MUTED} rows={unclaimed} focusId={focusId} onFocus={setFocusId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FocusPanel({
  row,
  onSkip,
  canSkip,
}: {
  row: WalkthroughQueueRow;
  onSkip: () => void;
  canSkip: boolean;
}) {
  const clock = clockFor(row);
  const state = stateFor(row);
  const checked = row.agenda.filter((a) => a.checked).length;
  const shownAgenda = row.agenda.slice(0, AGENDA_SHOWN);
  const moreAgenda = row.agenda.length - shownAgenda.length;
  // A school still filming needs nothing from the verifier, so the panel says so instead of
  // telling them to start on a case they cannot finish.
  const quiet = recording(row) && !row.windowClosed && !videosIn(row);

  const stateStyle = state
    ? state.solid
      ? { backgroundColor: state.tone, color: 'white' }
      : {
          border: `1px solid ${state.tone}`,
          color: state.tone,
          backgroundColor: state.tone === RED ? RED_WASH : state.tone === GREEN ? GREEN_WASH : GOLD_WASH,
        }
    : undefined;

  return (
    <div className="p-5">
      <p className="text-[10.5px] font-extrabold uppercase tracking-widest" style={{ color: quiet ? GOLD_DARK : GREEN }}>
        {quiet ? 'Waiting on this school' : 'Start here'}
      </p>

      <p className="mt-2 flex flex-wrap items-baseline gap-2">
        <span className="text-4xl font-extrabold leading-none tabular-nums" style={{ color: clock.tone }}>
          {clock.value.toLocaleString('en-IN')}
        </span>
        <span className="text-sm font-bold" style={{ color: clock.tone }}>
          {clock.label}
        </span>
        {state && (
          <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold" style={stateStyle}>
            {state.label}
          </span>
        )}
      </p>

      <p className="mt-3 font-mono text-lg font-bold" style={{ color: NAVY_DEEP }}>
        {row.maskedCode}
      </p>
      <p className="text-xs" style={{ color: INK_MUTED }}>
        {prettyCategory(row.category)}
        {!row.mine && row.riskScore !== null && ` · risk ${row.riskScore}%`}
      </p>

      <p className="mt-2 max-w-prose text-sm" style={{ color: '#3C4A61' }}>
        {whyFor(row)}
      </p>

      {row.agenda.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <p className="text-[10.5px] font-extrabold uppercase tracking-wide" style={{ color: INK_MUTED }}>
            {row.agenda.length.toLocaleString('en-IN')} disputed{' '}
            {row.agenda.length === 1 ? 'indicator' : 'indicators'} · {checked.toLocaleString('en-IN')} checked
          </p>
          <ul className="mt-2 space-y-1">
            {shownAgenda.map((item) => (
              <li key={item.code} className="flex items-center gap-2.5 text-[13px]">
                <span
                  className="flex h-4 w-4 flex-none items-center justify-center rounded text-[9px] font-extrabold text-white"
                  style={item.checked ? { backgroundColor: GREEN } : { border: '2px solid #D8DEE9' }}
                  aria-hidden
                >
                  {item.checked ? '✓' : ''}
                </span>
                <span className="font-mono text-[11.5px] font-bold" style={{ color: NAVY }}>
                  {item.code}
                </span>
                <span className="min-w-0 truncate" style={{ color: '#3C4A61' }}>
                  {item.titleEn}
                </span>
              </li>
            ))}
          </ul>
          {moreAgenda > 0 && (
            <p className="mt-1 pl-6 text-xs" style={{ color: INK_MUTED }}>
              and {moreAgenda.toLocaleString('en-IN')} more
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {row.mine ? (
          <Link
            href={`/app/verifier/walkthrough/${row.runId}`}
            className="rounded-lg px-5 py-2.5 text-sm font-bold text-white"
            style={{ backgroundColor: quiet || row.overdue || (recording(row) && row.windowClosed) ? NAVY : GREEN }}
          >
            {actionFor(row)}
          </Link>
        ) : (
          <ClaimWalkthroughButton runId={row.runId} />
        )}
        {canSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="rounded-lg border-2 px-5 py-2.5 text-sm font-bold"
            style={{ borderColor: '#D1D5DB', color: '#3C4A61' }}
          >
            Skip to the next case
          </button>
        )}
      </div>
    </div>
  );
}
