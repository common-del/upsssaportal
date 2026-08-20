/**
 * The de-empanelment rules, applied to an empanelled verifier's audited record.
 *
 * The terms of reference set two triggers, whichever comes first: audit findings contradict
 * the verifier's reports in more than the configured share of audited cases, or a configured
 * number of proven contradictions inside a rolling twelve months.
 *
 * Two properties of this module matter more than its arithmetic.
 *
 * First, it consumes *confirmed* contradictions only. Whether one audit contradicts one report
 * is a judgement signed at reconciliation by the Audit Cell, not a ratio computed here; this
 * module never decides that a case was contradicted, only what the confirmed record adds up to.
 *
 * Second, it recommends and never removes. The output is shown on the supervisor's case view
 * with both rules and the floor visible, and a person confirms or does not. A function that
 * ended careers on its own would be exactly the automation the audit trail exists to prevent.
 *
 * The minimum-cases floor is not in the source documents and the config table says why it
 * exists: without it, one contradiction in the first five audited cases reads as 20% and
 * triggers removal on a sample too small to mean anything. The floor guards the percentage
 * rule only. The absolute rule has no floor because three proven contradictions in a year are
 * three facts, not a rate on a thin sample.
 */

export type DeEmpanelConfig = {
  /** Percentage of audited cases contradicted at or above which the rate rule triggers. */
  contradictionRatePct: number;
  /** Audited cases below which the rate rule stays silent. */
  minimumAuditedCases: number;
  /** Confirmed contradictions in a rolling 12 months at or above which the count rule triggers. */
  absoluteCount: number;
};

export type AuditedCaseFact = {
  contradicted: boolean;
  /** When the reconciliation was signed, which is when a contradiction becomes "proven". */
  decidedAt: Date;
};

export type DeEmpanelEvaluation = {
  auditedCount: number;
  contradictedCount: number;
  /** Null when nothing has been audited, because 0/0 is not a rate. */
  contradictionRatePct: number | null;
  floorMet: boolean;
  rateRule: { triggered: boolean; thresholdPct: number; minimumCases: number };
  rolling12MonthCount: number;
  countRule: { triggered: boolean; threshold: number };
  /** Either rule triggered. A recommendation to a person, not a removal. */
  recommended: boolean;
};

const ROLLING_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

export function evaluateDeEmpanelment(
  cases: AuditedCaseFact[],
  config: DeEmpanelConfig,
  now: Date = new Date(),
): DeEmpanelEvaluation {
  const auditedCount = cases.length;
  const contradictedCount = cases.filter((c) => c.contradicted).length;
  const ratePct = auditedCount === 0 ? null : (contradictedCount / auditedCount) * 100;
  const floorMet = auditedCount >= config.minimumAuditedCases;

  // At the boundary the rule fires: "more than 20%" in the ToR is read as at-or-above the
  // configured value because the configured value is itself the line the programme chose.
  const rateTriggered = floorMet && ratePct !== null && ratePct >= config.contradictionRatePct;

  // Inclusive at exactly twelve months ago: a contradiction decided 365 days ago today is
  // still inside the window until tomorrow.
  const cutoff = now.getTime() - ROLLING_WINDOW_MS;
  const rolling = cases.filter(
    (c) => c.contradicted && c.decidedAt.getTime() >= cutoff && c.decidedAt.getTime() <= now.getTime(),
  ).length;
  const countTriggered = rolling >= config.absoluteCount;

  return {
    auditedCount,
    contradictedCount,
    contradictionRatePct: ratePct,
    floorMet,
    rateRule: {
      triggered: rateTriggered,
      thresholdPct: config.contradictionRatePct,
      minimumCases: config.minimumAuditedCases,
    },
    rolling12MonthCount: rolling,
    countRule: { triggered: countTriggered, threshold: config.absoluteCount },
    recommended: rateTriggered || countTriggered,
  };
}
