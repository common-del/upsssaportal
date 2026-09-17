import { describe, expect, it } from 'vitest';
import {
  STALE_CALL_HOURS,
  WINDOW_PRESSING_HOURS,
  compareSummaries,
  summarise,
  type QueueFacts,
} from './walkthroughSummary';

const NOW = new Date('2026-09-17T06:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
const daysAhead = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

function facts(over: Partial<QueueFacts> = {}): QueueFacts {
  return {
    sessionState: 'NOT_STARTED',
    scheduledFor: null,
    startedAt: null,
    disputed: 8,
    observed: 0,
    clipsReturned: null,
    hoursLeft: null,
    windowClosed: false,
    dueBy: daysAhead(3),
    overdue: false,
    ...over,
  };
}

describe('a call in progress', () => {
  it('reads as running when it started minutes ago', () => {
    const s = summarise(facts({ sessionState: 'LIVE', startedAt: hoursAgo(1) }), NOW);
    expect(s.sentence).toBe('A call is running on this case now.');
    expect(s.clock).toBe('now');
    expect(s.rank).toBe(0);
  });

  it('stops claiming to be running once it is a session nobody closed', () => {
    const s = summarise(
      facts({ sessionState: 'LIVE', startedAt: hoursAgo(STALE_CALL_HOURS + 1) }),
      NOW,
    );
    expect(s.sentence).toContain('never closed');
    expect(s.clockNote).toBe('call never closed');
    expect(s.pressing).toBe(true);
  });

  it('sorts a live call above everything else', () => {
    const live = summarise(facts({ sessionState: 'LIVE', startedAt: hoursAgo(1) }), NOW);
    const closed = summarise(
      facts({ sessionState: 'GUIDED_CAPTURE', windowClosed: true, clipsReturned: 0, overdue: true, dueBy: daysAgo(20) }),
      NOW,
    );
    expect(live.rank).toBeLessThan(closed.rank);
  });
});

describe('a school that is filming', () => {
  const filming = (over: Partial<QueueFacts>) =>
    summarise(facts({ sessionState: 'GUIDED_CAPTURE', hoursLeft: 21, ...over }), NOW);

  it('counts the window in hours, not the turnaround in days', () => {
    const s = filming({ clipsReturned: 4 });
    expect(s.clock).toBe('21h');
    expect(s.clockNote).toBe('left in the window');
  });

  it('says how many clips are in', () => {
    expect(filming({ clipsReturned: 4, disputed: 11 }).sentence).toBe('4 of the 11 clips are in.');
    expect(filming({ clipsReturned: 11, disputed: 11 }).sentence).toBe('All 11 clips are in.');
  });

  it('separates a school that has sent nothing from one part way through', () => {
    const none = filming({ clipsReturned: 0 });
    const some = filming({ clipsReturned: 4 });
    expect(none.sentence).toBe('The school has not sent any clips yet.');
    expect(none.action).toBe('Open the case');
    // Waiting on the school ranks below work the verifier can actually do now.
    expect(none.rank).toBeGreaterThan(some.rank);
  });

  it('turns pressing only as the window runs out', () => {
    expect(filming({ clipsReturned: 4, hoursLeft: 21 }).pressing).toBe(false);
    expect(filming({ clipsReturned: 4, hoursLeft: WINDOW_PRESSING_HOURS }).pressing).toBe(true);
  });
});

describe('a filming window that has closed', () => {
  const closed = (over: Partial<QueueFacts>) =>
    summarise(
      facts({ sessionState: 'GUIDED_CAPTURE', windowClosed: true, disputed: 11, overdue: true, dueBy: daysAgo(24), ...over }),
      NOW,
    );

  it('offers the field when clips are missing, because nothing more can be filmed', () => {
    const s = closed({ clipsReturned: 0 });
    expect(s.sentence).toBe('The filming window closed with 11 clips never sent.');
    expect(s.action).toBe('Send to the field');
  });

  it('still offers a review when everything arrived before it shut', () => {
    const s = closed({ clipsReturned: 11 });
    expect(s.sentence).toBe('The filming window has closed with all 11 clips in.');
    expect(s.action).toBe('Review the clips');
  });

  it('counts one missing clip in the singular', () => {
    expect(closed({ clipsReturned: 10 }).sentence).toBe(
      'The filming window closed with 1 clip never sent.',
    );
  });

  it('shows the turnaround, since the filming clock has stopped mattering', () => {
    expect(closed({ clipsReturned: 0 }).clock).toBe('24d');
    expect(closed({ clipsReturned: 0 }).clockNote).toBe('past the deadline');
  });
});

describe('a booked call', () => {
  it('reads as booked while it is still ahead', () => {
    const s = summarise(
      facts({ sessionState: 'SCHEDULED', scheduledFor: daysAhead(2) }),
      NOW,
    );
    expect(s.sentence).toContain('A call is booked for');
    expect(s.action).toBe('Open the case');
    expect(s.pressing).toBe(false);
  });

  it('reads as missed once the time has passed', () => {
    const s = summarise(
      facts({ sessionState: 'SCHEDULED', scheduledFor: daysAgo(1), overdue: true, dueBy: daysAgo(5) }),
      NOW,
    );
    expect(s.sentence).toContain('missed its call');
    expect(s.action).toBe('Book another call');
    expect(s.pressing).toBe(true);
  });
});

describe('a case nobody has started', () => {
  it('says so, and offers the first move', () => {
    const s = summarise(facts(), NOW);
    expect(s.sentence).toBe('Nothing has happened on this case yet.');
    expect(s.action).toBe('Book a call');
    expect(s.clockNote).toBe('left');
  });

  it('turns pressing once the turnaround is blown', () => {
    expect(summarise(facts({ overdue: true, dueBy: daysAgo(26) }), NOW).pressing).toBe(true);
  });

  it('treats an ended session the same way, since it should not be in this queue', () => {
    expect(summarise(facts({ sessionState: 'ENDED' }), NOW).action).toBe('Book a call');
  });
});

describe('compareSummaries', () => {
  const row = (over: Partial<QueueFacts>, enteredStateAt: string) => ({
    summary: summarise(facts(over), NOW),
    enteredStateAt,
  });

  it('orders by band, then by what is pressing, then by who has waited longest', () => {
    const rows = [
      row({ sessionState: 'SCHEDULED', scheduledFor: daysAhead(2) }, daysAgo(5)),
      row({ sessionState: 'GUIDED_CAPTURE', hoursLeft: 21, clipsReturned: 4 }, daysAgo(3)),
      row({ sessionState: 'LIVE', startedAt: hoursAgo(1) }, daysAgo(1)),
      row({ sessionState: 'GUIDED_CAPTURE', windowClosed: true, clipsReturned: 0, overdue: true, dueBy: daysAgo(24) }, daysAgo(24)),
    ];
    const order = rows.slice().sort(compareSummaries).map((r) => r.summary.rank);
    expect(order).toEqual([0, 1, 2, 4]);
  });

  it('puts the longest wait first inside one band', () => {
    const older = row({ sessionState: 'GUIDED_CAPTURE', hoursLeft: 20, clipsReturned: 2 }, daysAgo(9));
    const newer = row({ sessionState: 'GUIDED_CAPTURE', hoursLeft: 20, clipsReturned: 2 }, daysAgo(2));
    expect([newer, older].sort(compareSummaries)[0]).toBe(older);
  });
});
