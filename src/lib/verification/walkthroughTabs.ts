import type { QueueFacts } from '@/lib/verification/walkthroughSummary';

/**
 * Which of the three walkthrough tabs a case belongs to.
 *
 * The three read left to right as a pipeline rather than as three independent queues, because
 * that is what they are: a case starts with no time agreed, becomes a booked call, and only
 * reaches the recording route when the live call drops out on connectivity. Nothing arrives in
 * Recordings without having been in Booked first.
 *
 * Two placements are decisions rather than readings of the state, and both are here rather than
 * in the component so they can be stated once and tested.
 *
 * A call that was booked and missed goes back to To schedule. The session row still says
 * SCHEDULED, so the literal reading would leave it under Booked, but there is no time agreed any
 * more and the only move is to agree another one. Its button has always said "Book another call".
 *
 * A live call sits under Booked. It is the one state that belongs to no tab honestly: it is not
 * waiting for a time and it is not a future appointment, it is happening. Booked is where a
 * verifier who agreed that call would look for it, and `defaultTab` below stops the tab hiding
 * it.
 */

export const TABS = ['TO_SCHEDULE', 'BOOKED', 'RECORDINGS'] as const;
export type QueueTab = (typeof TABS)[number];

export const TAB_LABEL: Record<QueueTab, string> = {
  TO_SCHEDULE: 'To schedule',
  BOOKED: 'Booked',
  RECORDINGS: 'Recordings',
};

/** What the tab is for, under its table, so a verifier does not have to infer it from the rows. */
export const TAB_NOTE: Record<QueueTab, string> = {
  TO_SCHEDULE: 'No time has been agreed with the school yet.',
  BOOKED: 'A call is agreed, running, or was agreed and not held.',
  RECORDINGS: 'The call dropped out, so the school is filming each disputed indicator instead.',
};

export function tabFor(facts: QueueFacts, now: Date = new Date()): QueueTab {
  // Every recording case, including one where nothing has been sent and one whose window has
  // closed short. They are all on the filming route, and a verifier looking for "what is the
  // school recording" should find every one of them in one place, not only the ones that worked.
  if (facts.sessionState === 'GUIDED_CAPTURE') return 'RECORDINGS';
  if (facts.sessionState === 'LIVE') return 'BOOKED';
  if (facts.sessionState === 'SCHEDULED' && facts.scheduledFor) {
    return Date.parse(facts.scheduledFor) < now.getTime() ? 'TO_SCHEDULE' : 'BOOKED';
  }
  // NOT_STARTED, ENDED, and a SCHEDULED row carrying no time, which should not exist but would
  // otherwise land in a tab that promises a time it does not have.
  return 'TO_SCHEDULE';
}

/**
 * Which tab the page opens on.
 *
 * To schedule, the start of the pipeline, every time but one: a call running now is a person
 * sitting on a video link waiting, and opening a list of unbooked cases in front of that is the
 * one place where a tab costs something real. Only a live call of the verifier's own moves it,
 * so the default is predictable rather than chasing whatever is most urgent.
 */
export function defaultTab(
  rows: { facts: Pick<QueueFacts, 'sessionState'>; mine: boolean }[],
): QueueTab {
  return rows.some((r) => r.mine && r.facts.sessionState === 'LIVE') ? 'BOOKED' : 'TO_SCHEDULE';
}
