import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentActor, requireOnlineVerifier } from '@/lib/authz';
import { getWalkthroughQueue, type WalkthroughQueueRow } from '@/lib/actions/walkthrough';
import { ClaimWalkthroughButton } from '@/components/verifier/ClaimWalkthroughButton';

/**
 * The walkthrough queue: cases desk screening pushed over the risk threshold, on both routes.
 *
 * Most are settled on a live call. Where the call will not hold, the school records a clip for
 * each disputed indicator instead, and for a day those cases had a page of their own. They are
 * back here, because one case belongs in one queue and a second page was a second place to
 * forget it.
 *
 * Merging them back raises the problem that split them, and the zones are the answer. A call is
 * measured against the seven day turnaround and a recording against the school's 48 hour
 * window, so a single deadline column would be wrong for half the list: instead each row states
 * its own clock in the tile, and the zones sort by whether the verifier can act at all.
 *
 *   Do now          a live call, a clip pile that is complete, anything past the turnaround
 *   Yours           calls to place or keep, in deadline order
 *   Waiting         a school still filming. Nothing is needed here, and it says so
 *   Unclaimed       the pool anyone in the cell can take
 *
 * Ordering by whichever clock expires first would put "24 hours left" on a school that is still
 * filming above a call due in five days, although one needs the verifier and the other does not.
 * The question this page answers is what to do next, not what runs out first.
 *
 * Masked codes here, as everywhere in the online track; the identity discloses only inside a
 * case's console, at a recorded moment, immediately followed by the conflict declaration.
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

const dayMonth = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: IST });

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

/**
 * The left-hand tile, which states the clock that governs this particular row.
 *
 * A live call shows minutes elapsed, because while the school is on the line the turnaround is
 * not the thing that matters. A school still filming shows hours of its own window. Everything
 * else shows the turnaround. One column, one meaning per row, and none of them borrowed.
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
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(row.startedAt).getTime()) / 60_000));
    return tile(minutes, 'min in', '#BFE0CF', GREEN_WASH, GREEN);
  }

  const days = daysFromNow(row.dueBy);
  if (row.overdue) {
    const over = Math.abs(days);
    return tile(over, over === 1 ? 'day over' : 'days over', RED, RED_WASH, RED);
  }

  if (recording(row)) {
    // The window is shut: these are all the clips there will ever be, so the count is the fact
    // that matters rather than a deadline nobody can meet.
    if (row.windowClosed) {
      return tile(row.clipsReturned ?? 0, `of ${row.disputed} in`, RED, RED_WASH, RED);
    }
    if (clipsComplete(row)) {
      return tile(row.clipsReturned ?? 0, `of ${row.disputed} in`, '#BFE0CF', GREEN_WASH, GREEN);
    }
    const left = row.hoursLeft ?? 0;
    return tile(left, left === 1 ? 'hour left' : 'hours left', GOLD_TINT, GOLD_WASH, GOLD_DARK);
  }

  const urgent = days <= 2;
  return urgent
    ? tile(days, days === 1 ? 'day left' : 'days left', GOLD_TINT, GOLD_WASH, GOLD_DARK)
    : tile(days, days === 1 ? 'day left' : 'days left', '#C7D2E8', NAVY_WASH, NAVY_DEEP);
}

function StateChip({ row }: { row: WalkthroughQueueRow }) {
  if (row.sessionState === 'LIVE') {
    return (
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
    return (
      <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold" style={{ backgroundColor: NAVY_WASH, color: NAVY }}>
        Scheduled {weekdayTime(row.scheduledFor)}
      </span>
    );
  }
  return null;
}

/** What this case will involve, in the fewest words that are still true. */
function metaFor(row: WalkthroughQueueRow): string {
  const bits: string[] = [row.category];

  if (recording(row)) {
    const returned = row.clipsReturned ?? 0;
    const missing = Math.max(0, row.disputed - returned);
    if (row.windowClosed) {
      bits.push(`${returned.toLocaleString('en-IN')} of ${row.disputed.toLocaleString('en-IN')} clips returned`);
      if (missing > 0) bits.push(`${missing.toLocaleString('en-IN')} never sent`);
    } else if (clipsComplete(row)) {
      bits.push(
        row.lastClipAt ? `last clip arrived ${hoursSince(row.lastClipAt)} hours ago` : 'every clip is in',
      );
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
  if (row.sessionState === 'LIVE') return 'Rejoin the call';
  if (recording(row)) {
    if (row.windowClosed) return 'Review and send to the field';
    if (clipsComplete(row)) return 'Review the clips';
    const returned = row.clipsReturned ?? 0;
    return returned > 0 ? `Review ${returned} so far` : 'Open case';
  }
  return 'Open console';
}

function QueueRow({ row, quiet }: { row: WalkthroughQueueRow; quiet?: boolean }) {
  const live = row.sessionState === 'LIVE';
  const done = clipsComplete(row) && !row.windowClosed;
  const border = live || done
    ? GREEN
    : row.overdue || (recording(row) && row.windowClosed)
      ? RED
      : recording(row)
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

export default async function WalkthroughsPage() {
  const actor = await requireOnlineVerifier();
  // A signed-in verifier of the other cell goes to their own Overview, not to login.
  if (!actor) redirect((await currentActor()) ? '/app/verifier' : '/login?tab=verifier');
  const rows = await getWalkthroughQueue();

  // Live first, then the deadline. A call in progress outranks every clock on the page.
  const byUrgency = (a: WalkthroughQueueRow, b: WalkthroughQueueRow) =>
    (a.sessionState === 'LIVE' ? 0 : 1) - (b.sessionState === 'LIVE' ? 0 : 1) ||
    Date.parse(a.dueBy) - Date.parse(b.dueBy);

  const mine = rows.filter((r) => r.mine);
  const unclaimed = rows.filter((r) => !r.mine).sort(byUrgency);

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

  const overdue = rows.filter((r) => r.overdue).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Walkthroughs
        </h1>
        <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
          Cases whose risk score crossed the threshold. Most are settled on a live, geofenced
          call; where the call will not hold, the school records a clip for each disputed
          indicator instead. Either way the case is resolved or sent to the field within the
          turnaround.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border-2 border-gray-200 bg-white p-5 text-sm" style={{ color: INK_MUTED }}>
          Nothing is waiting for a walkthrough.
        </p>
      ) : (
        <>
          <p className="text-sm font-semibold" style={{ color: overdue > 0 ? RED : INK_MUTED }}>
            {rows.length.toLocaleString('en-IN')} open {rows.length === 1 ? 'case' : 'cases'}
            {overdue > 0 && ` · ${overdue.toLocaleString('en-IN')} past the turnaround`}
          </p>

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

          <p className="text-xs" style={{ color: INK_MUTED }}>
            Cases waiting since {dayMonth(rows[rows.length - 1]!.enteredStateAt)} at the oldest. A
            case whose call could not hold stays in this queue and changes its clock: hours of
            the school&apos;s recording window rather than days of the turnaround. The school is
            named only inside a console, at a recorded moment.
          </p>
        </>
      )}
    </div>
  );
}
