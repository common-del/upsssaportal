import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentActor, requireOnlineVerifier } from '@/lib/authz';
import { getWalkthroughQueue, type WalkthroughQueueRow } from '@/lib/actions/walkthrough';
import { ClaimWalkthroughButton } from '@/components/verifier/ClaimWalkthroughButton';

/**
 * The walkthrough queue: cases desk screening pushed over the risk threshold.
 *
 * Two zones, because the page answers two different questions. "Yours" is what you are already
 * committed to, with a call in progress at the top because nothing else on this screen matters
 * while a school is waiting on the line. "Unclaimed" is the pool anyone in the cell can pick up.
 * Deadline order inside each zone. The old page gave a live session the same white card as an
 * untouched one and printed raw dates instead of a clock.
 *
 * Masked codes here, as everywhere in the online track; the identity discloses only inside a
 * case's console, at a recorded moment, immediately followed by the conflict declaration.
 */

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const NAVY_WASH = '#EEF2F9';
const INK_MUTED = '#5F7190';
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

/**
 * The left-hand tile. A live call shows minutes elapsed rather than a deadline, because while
 * the school is on the line the turnaround is not the thing that matters.
 */
function StateTile({ row }: { row: WalkthroughQueueRow }) {
  if (row.sessionState === 'LIVE' && row.startedAt) {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(row.startedAt).getTime()) / 60_000));
    return (
      <span
        className="w-16 flex-none rounded-lg border-2 py-1 text-center"
        style={{ borderColor: '#BFE0CF', backgroundColor: GREEN_WASH }}
      >
        <span className="block text-lg font-extrabold leading-tight tabular-nums" style={{ color: GREEN }}>
          {minutes.toLocaleString('en-IN')}
        </span>
        <span className="block text-[9px] font-extrabold uppercase tracking-wide" style={{ color: GREEN }}>
          min in
        </span>
      </span>
    );
  }

  const days = daysFromNow(row.dueBy);
  const overdue = row.overdue;
  const urgent = !overdue && days <= 2;
  const palette = overdue
    ? { border: RED, bg: RED_WASH, ink: RED }
    : urgent
      ? { border: GOLD_TINT, bg: GOLD_WASH, ink: GOLD_DARK }
      : { border: '#C7D2E8', bg: NAVY_WASH, ink: NAVY_DEEP };
  const value = Math.abs(days);
  const label = overdue
    ? value === 1
      ? 'day over'
      : 'days over'
    : value === 1
      ? 'day left'
      : 'days left';

  return (
    <span
      className="w-16 flex-none rounded-lg border-2 py-1 text-center"
      style={{ borderColor: palette.border, backgroundColor: palette.bg }}
    >
      <span className="block text-lg font-extrabold leading-tight tabular-nums" style={{ color: palette.ink }}>
        {value.toLocaleString('en-IN')}
      </span>
      <span className="block text-[9px] font-extrabold uppercase tracking-wide" style={{ color: palette.ink }}>
        {label}
      </span>
    </span>
  );
}

function StateChip({ row }: { row: WalkthroughQueueRow }) {
  if (row.sessionState === 'LIVE') {
    return (
      <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold text-white" style={{ backgroundColor: GREEN }}>
        Live now
      </span>
    );
  }
  if (row.sessionState === 'GUIDED_CAPTURE') {
    return (
      <span
        className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold"
        style={{ backgroundColor: GOLD_WASH, color: GOLD_DARK }}
      >
        Guided capture
      </span>
    );
  }
  if (row.sessionState === 'SCHEDULED' && row.scheduledFor) {
    return (
      <span
        className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold"
        style={{ backgroundColor: NAVY_WASH, color: NAVY }}
      >
        Scheduled {weekdayTime(row.scheduledFor)}
      </span>
    );
  }
  return null;
}

/** What this case will involve, in the fewest words that are still true. */
function metaFor(row: WalkthroughQueueRow): string {
  const bits: string[] = [row.category];

  if (row.sessionState === 'GUIDED_CAPTURE') {
    // The live call failed twice, so the school is recording clips instead. Progress against
    // the tasks it was sent is the only number that matters on this row.
    bits.push(
      `${(row.clipsReturned ?? 0).toLocaleString('en-IN')} of ${row.disputed.toLocaleString('en-IN')} clips returned`,
    );
  } else if (row.observed > 0) {
    bits.push(
      `${row.observed.toLocaleString('en-IN')} of ${row.disputed.toLocaleString('en-IN')} observed`,
    );
  } else {
    bits.push(
      `${row.disputed.toLocaleString('en-IN')} disputed ${row.disputed === 1 ? 'indicator' : 'indicators'}`,
    );
  }

  // An unclaimed row has to justify itself: the score is why it is here at all.
  if (!row.mine && row.riskScore !== null) bits.push(`risk ${row.riskScore}%`);
  return bits.join(' · ');
}

function QueueRow({ row }: { row: WalkthroughQueueRow }) {
  const live = row.sessionState === 'LIVE';
  const border = live ? GREEN : row.overdue ? RED : row.sessionState === 'GUIDED_CAPTURE' ? GOLD_TINT : '#E5E7EB';

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-xl border-2 bg-white px-3 py-2.5"
      style={{ borderColor: border }}
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
      {row.mine ? (
        <Link
          href={`/app/verifier/walkthrough/${row.runId}`}
          className="flex-none rounded-lg px-4 py-2 text-sm font-bold text-white"
          style={{ backgroundColor: live ? GREEN : NAVY }}
        >
          {live ? 'Rejoin the call' : 'Open console'}
        </Link>
      ) : (
        <ClaimWalkthroughButton runId={row.runId} />
      )}
    </div>
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

  const mine = rows.filter((r) => r.mine).sort(byUrgency);
  const unclaimed = rows.filter((r) => !r.mine).sort(byUrgency);
  const overdue = rows.filter((r) => r.overdue).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Video walkthroughs
        </h1>
        <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
          Cases whose risk score crossed the threshold. Each needs a live, geofenced walkthrough,
          resolved or sent to the field within the turnaround.
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

          {mine.length > 0 && (
            <section className="space-y-3">
              <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: GREEN }}>
                Yours · {mine.length.toLocaleString('en-IN')}
              </p>
              {mine.map((row) => (
                <QueueRow key={row.runId} row={row} />
              ))}
            </section>
          )}

          {unclaimed.length > 0 && (
            <section className="space-y-3">
              <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: INK_MUTED }}>
                Unclaimed · {unclaimed.length.toLocaleString('en-IN')}
                <span className="mt-0.5 block text-[11.5px] font-semibold normal-case tracking-normal" style={{ color: INK_MUTED }}>
                  Anyone in the online cell can take these. Claiming is recorded.
                </span>
              </p>
              {unclaimed.map((row) => (
                <QueueRow key={row.runId} row={row} />
              ))}
            </section>
          )}

          <p className="text-xs" style={{ color: INK_MUTED }}>
            Cases waiting since {dayMonth(rows[rows.length - 1]!.enteredStateAt)} at the oldest.
            The school is named only inside a console, at a recorded moment.
          </p>
        </>
      )}
    </div>
  );
}
