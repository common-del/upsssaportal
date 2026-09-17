import { describe, expect, it } from 'vitest';
import {
  chooseReplacement,
  istDayNumber,
  replacementDate,
  REALLOCATION_LEAD_DAYS,
} from './reallocation';

/** 07:00 IST is 01:30 UTC, the hour a recusal is normally declared. */
const ist = (iso: string) => new Date(iso);

describe('chooseReplacement', () => {
  it('picks the verifier carrying the fewest open visits', () => {
    const picked = chooseReplacement(
      [
        { profileId: 'p-heavy', openVisits: 40 },
        { profileId: 'p-light', openVisits: 3 },
        { profileId: 'p-mid', openVisits: 12 },
      ],
      [],
    );
    expect(picked).toBe('p-light');
  });

  it('breaks a tie by id, so the same inputs always give the same answer', () => {
    const args: [{ profileId: string; openVisits: number }[], string[]] = [
      [
        { profileId: 'p-b', openVisits: 5 },
        { profileId: 'p-a', openVisits: 5 },
      ],
      [],
    ];
    expect(chooseReplacement(...args)).toBe('p-a');
    expect(chooseReplacement(...args)).toBe('p-a');
  });

  it('never returns someone who has already stood down from this school', () => {
    // The lightest load belongs to the person who just recused. Load does not override the bar.
    const picked = chooseReplacement(
      [
        { profileId: 'p-recused', openVisits: 0 },
        { profileId: 'p-earlier-recusal', openVisits: 1 },
        { profileId: 'p-available', openVisits: 30 },
      ],
      ['p-recused', 'p-earlier-recusal'],
    );
    expect(picked).toBe('p-available');
  });

  it('returns null when the pool is empty', () => {
    expect(chooseReplacement([], [])).toBeNull();
  });

  it('returns null when everyone eligible is barred', () => {
    // A district with one certified verifier, the moment that person recuses.
    expect(chooseReplacement([{ profileId: 'p-only', openVisits: 2 }], ['p-only'])).toBeNull();
  });
});

describe('replacementDate', () => {
  const windowStart = ist('2026-10-06T00:00:00Z');
  const windowEnd = ist('2026-12-20T00:00:00Z');

  it('gives the replacement tomorrow, not today', () => {
    const now = ist('2026-11-02T01:30:00Z'); // 07:00 IST on 2 November
    const { notifiedDate, outsideWindow } = replacementDate(now, windowStart, windowEnd);
    expect(istDayNumber(notifiedDate)).toBe(istDayNumber(ist('2026-11-03T01:30:00Z')));
    expect(outsideWindow).toBe(false);
  });

  it('clamps forward to the start of a window that has not opened yet', () => {
    const now = ist('2026-09-20T01:30:00Z');
    const { notifiedDate } = replacementDate(now, windowStart, windowEnd);
    expect(notifiedDate).toEqual(windowStart);
  });

  it('flags a date past the window rather than capping it', () => {
    const now = ist('2026-12-20T01:30:00Z'); // recusal on the window's last day
    const { notifiedDate, outsideWindow } = replacementDate(now, windowStart, windowEnd);
    expect(outsideWindow).toBe(true);
    // Still a real future date, so the visit stays scheduled and visible.
    expect(notifiedDate.getTime()).toBeGreaterThan(now.getTime());
  });

  it('treats the window’s last day as inside it', () => {
    // A recusal the day before the window closes lands on the closing day itself.
    const now = ist('2026-12-19T01:30:00Z');
    expect(replacementDate(now, windowStart, windowEnd).outsideWindow).toBe(false);
  });

  it('takes the lead time from the shared constant', () => {
    const now = ist('2026-11-02T01:30:00Z');
    const { notifiedDate } = replacementDate(now, windowStart, windowEnd);
    const expected = new Date(now.getTime() + REALLOCATION_LEAD_DAYS * 86_400_000);
    expect(istDayNumber(notifiedDate)).toBe(istDayNumber(expected));
  });
});

describe('istDayNumber', () => {
  it('keeps the late-evening UTC hours on the following Indian day', () => {
    // 19:00 UTC on 5 October is 00:30 IST on 6 October. A UTC reading would put the reveal a
    // day early, which is the bug the reveal gate exists to prevent.
    expect(istDayNumber(ist('2026-10-05T19:00:00Z'))).toBe(istDayNumber(ist('2026-10-06T06:00:00Z')));
  });

  it('separates two moments on different Indian days', () => {
    expect(istDayNumber(ist('2026-10-06T18:29:00Z'))).toBe(istDayNumber(ist('2026-10-06T00:00:00Z')));
    expect(istDayNumber(ist('2026-10-06T18:31:00Z'))).toBe(istDayNumber(ist('2026-10-06T00:00:00Z')) + 1);
  });
});
