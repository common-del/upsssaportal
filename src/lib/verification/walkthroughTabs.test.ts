import { describe, expect, it } from 'vitest';
import { TABS, defaultTab, tabFor } from './walkthroughTabs';
import type { QueueFacts } from './walkthroughSummary';

const NOW = new Date('2026-09-17T10:00:00+05:30');
const hours = (n: number) => new Date(NOW.getTime() + n * 3_600_000).toISOString();

function facts(over: Partial<QueueFacts> = {}): QueueFacts {
  return {
    sessionState: 'NOT_STARTED',
    scheduledFor: null,
    startedAt: null,
    disputed: 5,
    observed: 0,
    clipsReturned: null,
    hoursLeft: null,
    windowClosed: false,
    dueBy: hours(72),
    overdue: false,
    ...over,
  };
}

describe('which tab a case belongs to', () => {
  it('puts a case nobody has spoken to under To schedule', () => {
    expect(tabFor(facts(), NOW)).toBe('TO_SCHEDULE');
  });

  it('puts a future call under Booked', () => {
    expect(tabFor(facts({ sessionState: 'SCHEDULED', scheduledFor: hours(24) }), NOW)).toBe('BOOKED');
  });

  // The placement that is a decision rather than a reading. The session row still says SCHEDULED,
  // but no time is agreed any more and the only move is to agree another one.
  it('sends a missed call back to To schedule', () => {
    expect(tabFor(facts({ sessionState: 'SCHEDULED', scheduledFor: hours(-3) }), NOW)).toBe(
      'TO_SCHEDULE',
    );
  });

  it('keeps a running call under Booked', () => {
    expect(tabFor(facts({ sessionState: 'LIVE', startedAt: hours(-0.5) }), NOW)).toBe('BOOKED');
  });

  it('keeps a call nobody closed under Booked', () => {
    expect(tabFor(facts({ sessionState: 'LIVE', startedAt: hours(-30) }), NOW)).toBe('BOOKED');
  });
});

describe('everything on the filming route lands in Recordings', () => {
  // All four filming states, including the two with nothing to review. A verifier looking for
  // what a school is recording should find every case, not only the ones that worked.
  const filming: [string, Partial<QueueFacts>][] = [
    ['nothing sent yet', { clipsReturned: 0, hoursLeft: 24 }],
    ['some clips in', { clipsReturned: 2, hoursLeft: 7 }],
    ['every clip in', { clipsReturned: 5, hoursLeft: 21 }],
    ['window closed short', { clipsReturned: 2, hoursLeft: 0, windowClosed: true }],
  ];
  for (const [name, over] of filming) {
    it(name, () => {
      expect(tabFor(facts({ sessionState: 'GUIDED_CAPTURE', ...over }), NOW)).toBe('RECORDINGS');
    });
  }
});

describe('the states that would otherwise fall through', () => {
  it('puts an ended session under To schedule rather than nowhere', () => {
    expect(tabFor(facts({ sessionState: 'ENDED' }), NOW)).toBe('TO_SCHEDULE');
  });

  // A SCHEDULED row with no time should not exist. If one does, Booked would promise a time it
  // does not have, so it goes where the work of agreeing one is done.
  it('puts a booking with no time under To schedule', () => {
    expect(tabFor(facts({ sessionState: 'SCHEDULED', scheduledFor: null }), NOW)).toBe(
      'TO_SCHEDULE',
    );
  });

  it('assigns every state to one of the three tabs', () => {
    const states: QueueFacts['sessionState'][] = [
      'NOT_STARTED',
      'SCHEDULED',
      'LIVE',
      'GUIDED_CAPTURE',
      'ENDED',
    ];
    for (const sessionState of states) {
      expect(TABS).toContain(tabFor(facts({ sessionState }), NOW));
    }
  });
});

describe('which tab the page opens on', () => {
  it('opens on To schedule when nothing is live', () => {
    expect(
      defaultTab([
        { facts: { sessionState: 'SCHEDULED' }, mine: true },
        { facts: { sessionState: 'GUIDED_CAPTURE' }, mine: true },
      ]),
    ).toBe('TO_SCHEDULE');
  });

  it('opens on To schedule with an empty queue', () => {
    expect(defaultTab([])).toBe('TO_SCHEDULE');
  });

  // The one exception, and the whole reason tabs are affordable here: a call running now is a
  // person on a video link waiting, and a list of unbooked cases in front of that is wrong.
  it('opens on Booked when one of my own calls is live', () => {
    expect(
      defaultTab([
        { facts: { sessionState: 'NOT_STARTED' }, mine: true },
        { facts: { sessionState: 'LIVE' }, mine: true },
      ]),
    ).toBe('BOOKED');
  });

  // Somebody else's live call is not this verifier's to join, and moving their tab for it would
  // make the default unpredictable for a case they cannot act on.
  it('ignores a live call on a case nobody has taken', () => {
    expect(
      defaultTab([
        { facts: { sessionState: 'NOT_STARTED' }, mine: true },
        { facts: { sessionState: 'LIVE' }, mine: false },
      ]),
    ).toBe('TO_SCHEDULE');
  });
});
