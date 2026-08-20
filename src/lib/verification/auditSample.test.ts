import { beforeEach, describe, expect, it } from 'vitest';
import { compareAuditToPrimary, drawAuditSample, drawGroupedSample } from './auditSample';
import { bucketScores, driftReport, monthKeyIST, type ScorePoint } from './drift';

beforeEach(() => {
  process.env.AUTH_SECRET = 'test-secret-for-audit-sampling';
});

const ids = (n: number, prefix = 'run') => Array.from({ length: n }, (_, i) => `${prefix}-${i}`);

describe('the audit draw', () => {
  it('is deterministic: the same seed and candidates give the same sample', () => {
    const pool = ids(200);
    expect(drawAuditSample('audit:2026', pool, 3)).toEqual(drawAuditSample('audit:2026', pool, 3));
  });

  it('does not depend on the order the candidates arrive in', () => {
    const pool = ids(50);
    const reversed = [...pool].reverse();
    expect(new Set(drawAuditSample('s', pool, 10))).toEqual(new Set(drawAuditSample('s', reversed, 10)));
  });

  it('draws a different sample under a different seed', () => {
    const pool = ids(200);
    expect(drawAuditSample('audit:2026', pool, 5)).not.toEqual(drawAuditSample('audit:2027', pool, 5));
  });

  it('takes the ceiling of the share, so a small district still gets audited', () => {
    // 3% of 20 is 0.6; a draw that rounds to zero is a district with no audit at all.
    expect(drawAuditSample('s', ids(20), 3)).toHaveLength(1);
    expect(drawAuditSample('s', ids(100), 3)).toHaveLength(3);
    expect(drawAuditSample('s', ids(101), 3)).toHaveLength(4);
  });

  it('returns nothing for an empty pool or a zero percentage', () => {
    expect(drawAuditSample('s', [], 3)).toEqual([]);
    expect(drawAuditSample('s', ids(10), 0)).toEqual([]);
  });

  it('never draws more than the pool holds', () => {
    expect(drawAuditSample('s', ids(2), 100)).toHaveLength(2);
  });

  it('refuses to draw without the server secret', () => {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    expect(() => drawAuditSample('s', ids(10), 3)).toThrow(/AUTH_SECRET/);
  });

  it('seeds each district separately, so adding one district never reshuffles another', () => {
    const groups = new Map([
      ['D01', ids(100, 'a')],
      ['D02', ids(100, 'b')],
    ]);
    const before = drawGroupedSample('audit:2026', groups, 3);

    groups.set('D03', ids(100, 'c'));
    const after = drawGroupedSample('audit:2026', groups, 3);

    expect(after.get('D01')).toEqual(before.get('D01'));
    expect(after.get('D02')).toEqual(before.get('D02'));
    expect(after.get('D03')).toHaveLength(3);
  });
});

describe('comparing an audit with the primary record', () => {
  it('counts re-checked indicators and the disagreements among them', () => {
    const audit = new Map([
      ['p1', 2],
      ['p2', 3],
      ['p3', 1],
    ]);
    const primary = new Map([
      ['p1', 2],
      ['p2', 1],
      ['p3', 1],
    ]);
    expect(compareAuditToPrimary(audit, primary)).toEqual({ findingCount: 3, contradictionCount: 1 });
  });

  // An indicator the primary verifier never recorded cannot be contradicted, and counting it
  // would inflate the denominator the de-empanelment rate is read against.
  it('excludes indicators the primary record does not cover', () => {
    const audit = new Map([
      ['p1', 2],
      ['p9', 3],
    ]);
    const primary = new Map([['p1', 1]]);
    expect(compareAuditToPrimary(audit, primary)).toEqual({ findingCount: 1, contradictionCount: 1 });
  });
});

describe('the drift monitor', () => {
  const point = (score: number, above: boolean, iso: string): ScorePoint => ({
    score,
    aboveThreshold: above,
    computedAt: new Date(iso),
  });

  it('buckets by the IST calendar month, not the UTC one', () => {
    // 19:30 UTC on 31 July is 01:00 IST on 1 August.
    expect(monthKeyIST(new Date('2026-07-31T19:30:00Z'))).toBe('2026-08');
    expect(monthKeyIST(new Date('2026-07-31T18:29:00Z'))).toBe('2026-07');
  });

  it('flags a mean shift against the running baseline', () => {
    const points = [
      ...Array.from({ length: 30 }, (_, i) => point(30, false, `2026-05-${String((i % 28) + 1).padStart(2, '0')}T06:00:00Z`)),
      ...Array.from({ length: 30 }, (_, i) => point(45, false, `2026-06-${String((i % 28) + 1).padStart(2, '0')}T06:00:00Z`)),
    ];
    const report = driftReport(points);
    expect(report.flags.some((f) => f.kind === 'MEAN_SHIFT' && f.bucketKey === '2026-06')).toBe(true);
  });

  it('flags a shift in the above-threshold share', () => {
    const points = [
      ...Array.from({ length: 40 }, (_, i) => point(50, i < 4, `2026-05-10T0${i % 10}:00:00Z`)),
      ...Array.from({ length: 40 }, (_, i) => point(50, i < 20, `2026-06-10T0${i % 10}:00:00Z`)),
    ];
    const report = driftReport(points);
    expect(
      report.flags.some((f) => f.kind === 'THRESHOLD_SHARE_SHIFT' && f.bucketKey === '2026-06'),
    ).toBe(true);
  });

  it('stays quiet when the distribution is stable', () => {
    const points = [
      ...Array.from({ length: 30 }, () => point(42, false, '2026-05-10T06:00:00Z')),
      ...Array.from({ length: 30 }, () => point(44, false, '2026-06-10T06:00:00Z')),
    ];
    expect(driftReport(points).flags).toEqual([]);
  });

  // A quiet month of twelve screenings is not a distribution, and flagging it would teach
  // people to ignore the monitor.
  it('does not flag months below the minimum size', () => {
    const points = [
      ...Array.from({ length: 30 }, () => point(30, false, '2026-05-10T06:00:00Z')),
      ...Array.from({ length: 5 }, () => point(80, true, '2026-06-10T06:00:00Z')),
    ];
    expect(driftReport(points).flags).toEqual([]);
  });

  it('reports buckets in calendar order with their sizes', () => {
    const points = [
      point(10, false, '2026-06-10T06:00:00Z'),
      point(20, false, '2026-05-10T06:00:00Z'),
      point(30, false, '2026-05-11T06:00:00Z'),
    ];
    const buckets = bucketScores(points);
    expect(buckets.map((b) => b.key)).toEqual(['2026-05', '2026-06']);
    expect(buckets[0]!.count).toBe(2);
    expect(buckets[0]!.meanScore).toBe(25);
  });
});
