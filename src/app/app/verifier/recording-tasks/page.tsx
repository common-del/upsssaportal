import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentActor, requireOnlineVerifier } from '@/lib/authz';
import { getRecordingTaskQueue, type RecordingTaskRow } from '@/lib/actions/walkthrough';

/**
 * Recording tasks: the cases where the call could not hold.
 *
 * Its own page rather than a state inside the walkthrough queue, because conducting a call and
 * reviewing clips two days later are different jobs. One is an appointment, the other a pile of
 * homework, and they keep different clocks: the walkthrough turnaround against the school's 48
 * hour recording window. A case appears in exactly one of the two queues, so there is only ever
 * one place to lose it.
 *
 * Three zones in the order they need the verifier: what can be settled now, what is still
 * arriving, and what ran out of time. Masked codes, as everywhere in the online track.
 */

const NAVY = '#1F3864';
const NAVY_DEEP = '#073763';
const INK_MUTED = '#5F7190';
const GOLD_TINT = '#D0AD42';
const GOLD_DARK = '#7A5209';
const GOLD_WASH = '#FDF8EC';
const RED = '#96271E';
const RED_WASH = '#FBE9E7';
const GREEN = '#14603A';
const GREEN_WASH = '#E7F5EE';

const IST = 'Asia/Kolkata';

function sinceLabel(iso: string) {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return 'less than an hour ago';
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: IST,
  });
}

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: IST,
  });

const isReady = (r: RecordingTaskRow) => r.tasksSent > 0 && r.clipsReturned >= r.tasksSent;

/**
 * The left tile, which changes meaning by zone: hours left while the school records, clips in
 * once they are all back, clips missing after the window closes.
 */
function ClockTile({ row }: { row: RecordingTaskRow }) {
  const ready = isReady(row);
  const palette = row.windowClosed
    ? { border: RED, bg: RED_WASH, ink: RED }
    : ready
      ? { border: '#BFE0CF', bg: GREEN_WASH, ink: GREEN }
      : { border: GOLD_TINT, bg: GOLD_WASH, ink: GOLD_DARK };

  const value = row.windowClosed || ready ? row.clipsReturned : (row.hoursLeft ?? 0);
  const label = row.windowClosed || ready
    ? `of ${row.tasksSent} in`
    : row.hoursLeft === 1
      ? 'hour left'
      : 'hours left';

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

function TaskRow({ row }: { row: RecordingTaskRow }) {
  const ready = isReady(row);
  const missing = Math.max(0, row.tasksSent - row.clipsReturned);
  const border = row.windowClosed ? RED : ready ? GREEN : '#E5E7EB';

  const meta = row.windowClosed
    ? `${row.category} · window closed ${row.deadline ? dateTime(row.deadline) : ''} · ${row.clipsReturned} ${row.clipsReturned === 1 ? 'clip' : 'clips'} can still be reviewed`
    : ready
      ? `${row.category} · last clip arrived ${row.lastClipAt ? sinceLabel(row.lastClipAt) : 'recently'}`
      : row.clipsReturned === 0
        ? `${row.category} · nothing returned yet`
        : `${row.category} · ${row.clipsReturned} of ${row.tasksSent} clips returned · last arrived ${row.lastClipAt ? sinceLabel(row.lastClipAt) : 'recently'}`;

  const action = row.windowClosed
    ? 'Review and send to the field'
    : ready
      ? 'Review the clips'
      : row.clipsReturned > 0
        ? `Review ${row.clipsReturned} so far`
        : 'Open case';

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-xl border-2 bg-white px-3 py-2.5"
      style={{ borderColor: border }}
    >
      <ClockTile row={row} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-bold" style={{ color: NAVY_DEEP }}>
            {row.maskedCode}
          </span>
          {ready && !row.windowClosed && (
            <span
              className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold"
              style={{ backgroundColor: GREEN_WASH, color: GREEN }}
            >
              All clips returned
            </span>
          )}
          {row.windowClosed && missing > 0 && (
            <span
              className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold"
              style={{ backgroundColor: RED_WASH, color: RED }}
            >
              {missing} never returned
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs" style={{ color: INK_MUTED }}>
          {meta}
        </span>
      </span>
      <span className="hidden h-2 w-24 flex-none overflow-hidden rounded-full bg-[#EDEFF3] sm:block">
        <span
          className="block h-full rounded-full"
          style={{
            backgroundColor: row.windowClosed ? RED : ready ? GREEN : '#BF9000',
            width: `${row.tasksSent === 0 ? 0 : Math.min(100, Math.round((row.clipsReturned / row.tasksSent) * 100))}%`,
          }}
        />
      </span>
      <Link
        href={`/app/verifier/walkthrough/${row.runId}`}
        className="flex-none rounded-lg px-4 py-2 text-sm font-bold"
        style={
          ready && !row.windowClosed
            ? { backgroundColor: GREEN, color: 'white' }
            : row.windowClosed
              ? { backgroundColor: NAVY, color: 'white' }
              : { backgroundColor: 'white', border: `2px solid ${NAVY}`, color: NAVY }
        }
      >
        {action}
      </Link>
    </div>
  );
}

function Zone({
  label,
  explain,
  colour,
  rows,
}: {
  label: string;
  explain: string;
  colour: string;
  rows: RecordingTaskRow[];
}) {
  if (rows.length === 0) return null;
  return (
    <section className="space-y-3">
      <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: colour }}>
        {label} · {rows.length.toLocaleString('en-IN')}
        <span className="mt-0.5 block text-[11.5px] font-semibold normal-case tracking-normal" style={{ color: INK_MUTED }}>
          {explain}
        </span>
      </p>
      {rows.map((row) => (
        <TaskRow key={row.runId} row={row} />
      ))}
    </section>
  );
}

export default async function RecordingTasksPage() {
  const actor = await requireOnlineVerifier();
  // A signed-in verifier of the other cell goes to their own Overview, not to login.
  if (!actor) redirect((await currentActor()) ? '/app/verifier' : '/login?tab=verifier');

  const rows = await getRecordingTaskQueue();
  const closed = rows.filter((r) => r.windowClosed);
  const ready = rows.filter((r) => !r.windowClosed && isReady(r));
  const waiting = rows.filter((r) => !r.windowClosed && !isReady(r));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY_DEEP }}>
          Recording tasks
        </h1>
        <p className="mt-1 text-sm" style={{ color: INK_MUTED }}>
          When a call will not hold, the school records a short clip for each disputed indicator
          instead, within 48 hours. Review them here. Each clip is stamped with its time and
          place, and a clip taken from the gallery rather than recorded in the app is flagged.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border-2 border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-700">No school is recording clips for you right now.</p>
          <p className="mt-2 text-sm" style={{ color: INK_MUTED }}>
            A case arrives here on its own, when a live walkthrough loses its connection twice.
            Until then everything stays in Walkthroughs.
          </p>
        </div>
      ) : (
        <>
          <Zone
            label="Ready to review"
            explain="Every clip is in. Settle these and the case moves on."
            colour={GREEN}
            rows={ready}
          />
          <Zone
            label="Waiting on the school"
            explain="Nothing is needed from you until the clips arrive."
            colour={GOLD_DARK}
            rows={waiting}
          />
          <Zone
            label="Window closed short"
            explain="The 48 hours passed with clips missing. These indicators cannot be settled from a screen, so the case goes for a physical visit."
            colour={RED}
            rows={closed}
          />

          <p className="text-xs" style={{ color: INK_MUTED }}>
            Schools are shown by code. A case was named to you when its console opened; the code
            is how it is listed.
          </p>
        </>
      )}
    </div>
  );
}
