/**
 * One walkthrough case, said in a sentence.
 *
 * The queue used to name a case by its masked code and little else, so nine rows read as nine
 * hex strings and choosing between them meant holding ten characters in your head. The code is
 * still the only name a case has, and that cannot change while the online track stays masked.
 * What can change is what the row leads with: what happened, in words.
 *
 * Pure, and separate from the component, because the sentence a row shows is a set of rules
 * about the state machine rather than a piece of layout, and the rules are worth testing.
 */

const IST = 'Asia/Kolkata';

/**
 * A walkthrough call runs for tens of minutes. Past this it is not a call in progress, it is a
 * session somebody never closed, and saying "running now" on it hides a real problem.
 */
export const STALE_CALL_HOURS = 4;

/** A filming window with this long left is one the verifier should clear today. */
export const WINDOW_PRESSING_HOURS = 8;

export type QueueFacts = {
  sessionState: 'NOT_STARTED' | 'SCHEDULED' | 'LIVE' | 'GUIDED_CAPTURE' | 'ENDED';
  scheduledFor: string | null;
  startedAt: string | null;
  disputed: number;
  observed: number;
  /** Recording cases only. Null means this case is on the call route. */
  clipsReturned: number | null;
  hoursLeft: number | null;
  windowClosed: boolean;
  dueBy: string;
  overdue: boolean;
};

export type QueueSummary = {
  /** The figure on the left: "6h", "24d", "now". */
  clock: string;
  /** What the figure counts. Never a bare number without this. */
  clockNote: string;
  /** What has happened, in one sentence. */
  sentence: string;
  /** What the button offers to do about it. */
  action: string;
  /** Needs attention today. Drives the red, and nothing else does. */
  pressing: boolean;
  /**
   * Which band the row sorts into, lowest first. Ordered by whether the verifier can act rather
   * than by which clock expires soonest: a call runs against the seven day turnaround and a
   * school's filming against forty-eight hours, so a single ordering by time left would put a
   * school that is still filming above a call somebody needs to join now.
   */
  rank: number;
};

/**
 * When a call is booked for, in IST.
 *
 * Exported because the Booked table prints the same time in its own column, and reading it back
 * out of the sentence would make a table cell depend on the wording of a sentence.
 */
export const weekdayTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: IST,
  });

const hoursSince = (iso: string, now: Date) => (now.getTime() - Date.parse(iso)) / 3_600_000;

const daysBetween = (from: number, to: number) => Math.max(0, Math.round((to - from) / 86_400_000));

/** Days against the seven day turnaround, which is the clock for every case not filming. */
function turnaroundClock(facts: QueueFacts, now: Date): { clock: string; clockNote: string } {
  const due = Date.parse(facts.dueBy);
  if (facts.overdue) {
    return { clock: `${daysBetween(due, now.getTime())}d`, clockNote: 'past the deadline' };
  }
  return { clock: `${daysBetween(now.getTime(), due)}d`, clockNote: 'left' };
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function summarise(facts: QueueFacts, now: Date = new Date()): QueueSummary {
  const turnaround = turnaroundClock(facts, now);

  if (facts.sessionState === 'LIVE') {
    const stale = facts.startedAt !== null && hoursSince(facts.startedAt, now) > STALE_CALL_HOURS;
    return {
      clock: stale ? 'open' : 'now',
      clockNote: stale ? 'call never closed' : 'call running',
      sentence: stale
        ? `A call was started on ${facts.startedAt ? weekdayTime(facts.startedAt) : 'an earlier day'} and never closed.`
        : 'A call is running on this case now.',
      action: 'Open the call',
      pressing: true,
      rank: 0,
    };
  }

  if (facts.sessionState === 'GUIDED_CAPTURE') {
    const returned = facts.clipsReturned ?? 0;
    const missing = Math.max(0, facts.disputed - returned);

    if (facts.windowClosed) {
      return {
        ...turnaround,
        sentence:
          missing > 0
            ? `The filming window closed with ${missing} ${plural(missing, 'clip', 'clips')} never sent.`
            : `The filming window has closed with all ${facts.disputed} clips in.`,
        // Nothing can be filmed now, so a case still missing clips cannot be settled from a
        // screen and the only honest button says so.
        action: missing > 0 ? 'Send to the field' : 'Review the clips',
        pressing: true,
        rank: 1,
      };
    }

    const hours = facts.hoursLeft ?? 0;
    const clock = { clock: `${hours}h`, clockNote: 'left in the window' };
    if (returned === 0) {
      return {
        ...clock,
        sentence: 'The school has not sent any clips yet.',
        action: 'Open the case',
        pressing: hours <= WINDOW_PRESSING_HOURS,
        rank: 3,
      };
    }
    return {
      ...clock,
      sentence:
        returned >= facts.disputed
          ? `All ${facts.disputed} clips are in.`
          : `${returned} of the ${facts.disputed} clips are in.`,
      action: 'Review the clips',
      pressing: hours <= WINDOW_PRESSING_HOURS,
      rank: 2,
    };
  }

  if (facts.sessionState === 'SCHEDULED' && facts.scheduledFor) {
    const when = weekdayTime(facts.scheduledFor);
    if (Date.parse(facts.scheduledFor) < now.getTime()) {
      return {
        ...turnaround,
        sentence: `The school missed its call on ${when} and has not rebooked.`,
        action: 'Book another call',
        pressing: true,
        rank: 1,
      };
    }
    return {
      ...turnaround,
      sentence: `A call is booked for ${when}.`,
      action: 'Open the case',
      pressing: facts.overdue,
      rank: 4,
    };
  }

  // NOT_STARTED, and ENDED as a guard: a case whose session ended should have left this queue,
  // so if one is here it needs the same first move as one that never started.
  return {
    ...turnaround,
    sentence: 'Nothing has happened on this case yet.',
    action: 'Book a call',
    pressing: facts.overdue,
    rank: 5,
  };
}

/**
 * Soonest first, within what the verifier can act on.
 *
 * Band, then whether it is pressing, then the oldest, so two cases in the same state are settled
 * in the order the schools have been waiting.
 */
export function compareSummaries(
  a: { summary: QueueSummary; enteredStateAt: string },
  b: { summary: QueueSummary; enteredStateAt: string },
): number {
  return (
    a.summary.rank - b.summary.rank ||
    Number(b.summary.pressing) - Number(a.summary.pressing) ||
    Date.parse(a.enteredStateAt) - Date.parse(b.enteredStateAt)
  );
}
