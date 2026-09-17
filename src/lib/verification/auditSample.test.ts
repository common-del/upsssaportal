import { beforeEach, describe, expect, it } from 'vitest';
import { compareAuditToPrimary, drawAuditSample, drawGroupedSample } from './auditSample';

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
