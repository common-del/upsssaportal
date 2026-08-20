import { beforeEach, describe, expect, it } from 'vitest';
import {
  drawSpotCheckSample,
  isSameISTDay,
  isSpotCheckComplete,
  perClassEstimate,
  spotCheckSize,
  type SpotCheckConfig,
} from './spotCheck';

const FIXED: SpotCheckConfig = { mode: 'FIXED_COUNT', fixedCount: 10, percentage: 10, minimum: 5 };
const PCT: SpotCheckConfig = { mode: 'PERCENTAGE', fixedCount: 10, percentage: 10, minimum: 5 };

beforeEach(() => {
  process.env.AUTH_SECRET = 'test-secret-for-spot-checks';
});

describe('sample size, and the two instruments the documents disagree about', () => {
  it('takes the fixed count the terms of reference specify', () => {
    expect(spotCheckSize(FIXED, 400)).toBe(10);
  });

  it('takes the percentage the role card specifies', () => {
    expect(spotCheckSize(PCT, 400)).toBe(40);
  });

  // The two readings diverge most on large schools, which is why the mode has to be a stored
  // choice rather than an assumption: 10 children or 271 is not a detail.
  it('diverges sharply on a large school', () => {
    expect(spotCheckSize(FIXED, 2710)).toBe(10);
    expect(spotCheckSize(PCT, 2710)).toBe(271);
  });

  it('applies the floor in percentage mode so a tiny school is still sampled', () => {
    // 10% of 20 is 2, below the floor of 5.
    expect(spotCheckSize(PCT, 20)).toBe(5);
  });

  // The floor must not override an explicitly configured fixed count.
  it('does not apply the floor in fixed-count mode', () => {
    expect(spotCheckSize({ ...FIXED, fixedCount: 3 }, 400)).toBe(3);
  });

  it('never asks for more children than the school has', () => {
    expect(spotCheckSize(FIXED, 6)).toBe(6);
    expect(spotCheckSize(FIXED, 0)).toBe(0);
    expect(spotCheckSize(PCT, 0)).toBe(0);
  });

  // The floor is a minimum, not a target. A school of six children with a floor of five is
  // sampled at five, because five already satisfies the floor; rounding up to all six would
  // exceed it for no reason. Written down because the first version of this test asserted six.
  it('satisfies the floor without exceeding it', () => {
    expect(spotCheckSize(PCT, 6)).toBe(5);
    expect(spotCheckSize(PCT, 5)).toBe(5);
    expect(spotCheckSize(PCT, 4)).toBe(4);
  });
});

describe('the draw is unpredictable, stable and not the verifier’s to choose', () => {
  it('is stable for the same visit, so an auditor can re-derive it', () => {
    const a = drawSpotCheckSample('visit_1', 1, 8, 10, 40);
    const b = drawSpotCheckSample('visit_1', 1, 8, 10, 40);
    expect(a).toEqual(b);
  });

  it('differs between visits', () => {
    const a = drawSpotCheckSample('visit_1', 1, 8, 10, 40);
    const b = drawSpotCheckSample('visit_2', 1, 8, 10, 40);
    expect(a.slots).not.toEqual(b.slots);
  });

  // The point of keying it. A school that learned the visit id could otherwise recompute the
  // draw and have those ten children ready.
  it('depends on the secret, so the visit id alone does not reveal it', () => {
    const withFirst = drawSpotCheckSample('visit_1', 1, 8, 10, 40);
    process.env.AUTH_SECRET = 'a-different-secret';
    expect(drawSpotCheckSample('visit_1', 1, 8, 10, 40).slots).not.toEqual(withFirst.slots);
  });

  it('refuses to draw rather than produce a predictable sample', () => {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    expect(() => drawSpotCheckSample('visit_1', 1, 8, 10, 40)).toThrow(/would be predictable/);
  });
});

describe('the draw spreads across classes', () => {
  // Ten children all from class 5 would be a sample of class 5, not of the school.
  it('covers every class when the sample is at least as large as the class range', () => {
    const { slots } = drawSpotCheckSample('visit_1', 1, 8, 10, 40);
    expect(new Set(slots.map((s) => s.classLevel)).size).toBe(8);
  });

  it('stays inside the class range', () => {
    const { slots } = drawSpotCheckSample('visit_1', 6, 8, 9, 40);
    for (const s of slots) {
      expect(s.classLevel).toBeGreaterThanOrEqual(6);
      expect(s.classLevel).toBeLessThanOrEqual(8);
    }
  });

  it('keeps roll positions inside the estimated roll and above zero', () => {
    const { slots } = drawSpotCheckSample('visit_1', 1, 5, 10, 30);
    for (const s of slots) {
      expect(s.rollPosition).toBeGreaterThanOrEqual(1);
      expect(s.rollPosition).toBeLessThanOrEqual(30);
    }
  });

  // Testing one child twice and reporting it as two overstates the sample.
  it('never draws the same child twice', () => {
    const { slots, substitutes } = drawSpotCheckSample('visit_1', 1, 8, 10, 40);
    const keys = [...slots, ...substitutes].map((s) => `${s.classLevel}:${s.rollPosition}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('provides substitutes so a short roll is not the verifier’s judgement call', () => {
    const { slots, substitutes } = drawSpotCheckSample('visit_1', 1, 8, 10, 40);
    expect(slots).toHaveLength(10);
    expect(substitutes).toHaveLength(3);
  });

  it('returns nothing for an empty class range or a zero sample', () => {
    expect(drawSpotCheckSample('v', 5, 4, 10, 40).slots).toEqual([]);
    expect(drawSpotCheckSample('v', 1, 8, 0, 40).slots).toEqual([]);
  });
});

describe('per-class estimate', () => {
  it('divides the roll across the classes taught', () => {
    expect(perClassEstimate(320, 1, 8)).toBe(40);
  });

  it('never returns zero, so a roll position is always drawable', () => {
    expect(perClassEstimate(0, 1, 8)).toBe(1);
    expect(perClassEstimate(3, 1, 8)).toBe(1);
  });
});

describe('a spot-check record is all three tasks or none', () => {
  // Reading filled and numeracy blank is ambiguous between "the child could not" and "the
  // verifier ran out of time", and those mean opposite things about the school.
  it('is incomplete when any task is missing', () => {
    expect(isSpotCheckComplete({ reading: 2, writing: 2, numeracy: null })).toBe(false);
    expect(isSpotCheckComplete({ reading: null, writing: null, numeracy: null })).toBe(false);
  });

  it('is complete when all three are recorded, including zeroes', () => {
    expect(isSpotCheckComplete({ reading: 0, writing: 0, numeracy: 0 })).toBe(true);
  });
});

describe('same-day sign-off, in Indian time', () => {
  it('accepts a sign-off later the same working day', () => {
    expect(
      isSameISTDay(new Date('2026-08-21T04:00:00.000Z'), new Date('2026-08-21T11:00:00.000Z')),
    ).toBe(true);
  });

  // The boundary that a UTC comparison gets wrong. 19:00 UTC on the 20th is 00:30 IST on the
  // 21st, so a visit that afternoon and a sign-off that evening are different IST days.
  it('treats the IST midnight boundary as the day boundary', () => {
    expect(
      isSameISTDay(new Date('2026-08-20T10:00:00.000Z'), new Date('2026-08-20T19:00:00.000Z')),
    ).toBe(false);
  });

  it('rejects a sign-off the next day', () => {
    expect(
      isSameISTDay(new Date('2026-08-21T04:00:00.000Z'), new Date('2026-08-22T04:00:00.000Z')),
    ).toBe(false);
  });
});
