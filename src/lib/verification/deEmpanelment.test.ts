import { describe, expect, it } from 'vitest';
import { evaluateDeEmpanelment, type AuditedCaseFact } from './deEmpanelment';

const CONFIG = { contradictionRatePct: 20, minimumAuditedCases: 10, absoluteCount: 3 };
const NOW = new Date('2026-08-20T00:00:00Z');

const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const record = (contradicted: number, consistent: number, at: Date = daysAgo(30)): AuditedCaseFact[] => [
  ...Array.from({ length: contradicted }, () => ({ contradicted: true, decidedAt: at })),
  ...Array.from({ length: consistent }, () => ({ contradicted: false, decidedAt: at })),
];

describe('the rate rule and its floor', () => {
  // The reason the floor exists, demonstrated: one contradiction in five audited cases is 20%,
  // which without the floor would end a career on a sample of five.
  it('stays silent below the minimum-cases floor even when the rate is met', () => {
    const r = evaluateDeEmpanelment(record(1, 4), CONFIG, NOW);
    expect(r.contradictionRatePct).toBe(20);
    expect(r.floorMet).toBe(false);
    expect(r.rateRule.triggered).toBe(false);
  });

  it('triggers at exactly the configured rate once the floor is met', () => {
    const r = evaluateDeEmpanelment(record(2, 8), CONFIG, NOW);
    expect(r.auditedCount).toBe(10);
    expect(r.contradictionRatePct).toBe(20);
    expect(r.rateRule.triggered).toBe(true);
    expect(r.recommended).toBe(true);
  });

  it('does not trigger just below the rate', () => {
    const r = evaluateDeEmpanelment(record(1, 9), CONFIG, NOW);
    expect(r.contradictionRatePct).toBe(10);
    expect(r.rateRule.triggered).toBe(false);
  });

  it('reports null rather than a rate when nothing has been audited', () => {
    const r = evaluateDeEmpanelment([], CONFIG, NOW);
    expect(r.contradictionRatePct).toBeNull();
    expect(r.recommended).toBe(false);
  });
});

describe('the rolling twelve-month count rule', () => {
  it('triggers on the configured number of proven contradictions inside the window', () => {
    const cases = [
      { contradicted: true, decidedAt: daysAgo(10) },
      { contradicted: true, decidedAt: daysAgo(100) },
      { contradicted: true, decidedAt: daysAgo(300) },
    ];
    const r = evaluateDeEmpanelment(cases, CONFIG, NOW);
    expect(r.rolling12MonthCount).toBe(3);
    expect(r.countRule.triggered).toBe(true);
    expect(r.recommended).toBe(true);
  });

  // The count rule has no floor on purpose: three proven contradictions in a year are three
  // facts, not a rate on a thin sample.
  it('ignores the minimum-cases floor', () => {
    const cases = record(3, 0, daysAgo(5));
    const r = evaluateDeEmpanelment(cases, CONFIG, NOW);
    expect(r.floorMet).toBe(false);
    expect(r.countRule.triggered).toBe(true);
  });

  it('lets contradictions age out of the window', () => {
    const cases = [
      { contradicted: true, decidedAt: daysAgo(400) },
      { contradicted: true, decidedAt: daysAgo(380) },
      { contradicted: true, decidedAt: daysAgo(20) },
    ];
    const r = evaluateDeEmpanelment(cases, CONFIG, NOW);
    expect(r.rolling12MonthCount).toBe(1);
    expect(r.countRule.triggered).toBe(false);
    // The lifetime record still counts them for the rate rule's numerator.
    expect(r.contradictedCount).toBe(3);
  });

  it('is inclusive at exactly 365 days ago', () => {
    const cases = [
      { contradicted: true, decidedAt: daysAgo(365) },
      { contradicted: true, decidedAt: daysAgo(365) },
      { contradicted: true, decidedAt: daysAgo(365) },
    ];
    expect(evaluateDeEmpanelment(cases, CONFIG, NOW).countRule.triggered).toBe(true);
  });
});

describe('what the evaluation is for', () => {
  it('recommends when either rule fires, and never both silently', () => {
    const quiet = evaluateDeEmpanelment(record(1, 19), CONFIG, NOW);
    expect(quiet.recommended).toBe(false);

    const byRate = evaluateDeEmpanelment(record(4, 8), CONFIG, NOW);
    expect(byRate.rateRule.triggered).toBe(true);
    expect(byRate.recommended).toBe(true);
  });
});
