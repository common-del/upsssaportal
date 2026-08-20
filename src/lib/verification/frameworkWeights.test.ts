import { describe, expect, it } from 'vitest';
import { REAL_FRAMEWORK_DATA } from '../../../prisma/realFrameworkData';

/**
 * The weightage table from SCERT, asserted rather than trusted.
 *
 * A weighted score computed over weights that do not sum to 100 is not a percentage of
 * anything, and the failure is silent: every school still gets a number, it is just not the
 * number the framework describes. The grade bands then cut that wrong number at 55 and 80.
 */
describe('SCERT domain weightage', () => {
  it('sums to 100', () => {
    const sum = REAL_FRAMEWORK_DATA.reduce((n, d) => n + d.weightPercent, 0);
    expect(sum).toBe(100);
  });

  it('matches the supplied weightage table exactly', () => {
    expect(
      Object.fromEntries(REAL_FRAMEWORK_DATA.map((d) => [d.code, d.weightPercent])),
    ).toEqual({ D1: 20, D2: 15, D3: 20, D4: 30, D5: 15 });
  });

  // The public homepage tells parents this domain is the heaviest. It was saying so while the
  // seed weighted every domain equally, so this ties the claim to the data.
  it('makes Assessment and Learning Outcomes the single heaviest domain', () => {
    const sorted = [...REAL_FRAMEWORK_DATA].sort((a, b) => b.weightPercent - a.weightPercent);
    expect(sorted[0]!.code).toBe('D4');
    expect(sorted[0]!.titleEn).toBe('Assessment and Learning Outcomes');
    expect(sorted[1]!.weightPercent).toBeLessThan(sorted[0]!.weightPercent);
  });

  it('keeps the five domains and eleven sub-domains the table lists', () => {
    expect(REAL_FRAMEWORK_DATA).toHaveLength(5);
    const subs = REAL_FRAMEWORK_DATA.flatMap((d) => d.subDomains);
    expect(subs).toHaveLength(11);
  });

  it('gives every domain a positive weight', () => {
    for (const d of REAL_FRAMEWORK_DATA) {
      expect(d.weightPercent, `${d.code} has no weight`).toBeGreaterThan(0);
    }
  });
});
