import { describe, expect, it } from 'vitest';
import {
  bandFor,
  computeRisk,
  rationaleRequired,
  readyToScore,
  type IndicatorVerdict,
  type Rubric,
} from './riskScore';

/** The rubric seeded as version 1, so the tests exercise what actually ships. */
const RUBRIC: Rubric = {
  version: 1,
  weights: {
    AUTO_MISMATCH: 2,
    EVIDENCE_SUPPORTS_LEVEL: 0,
    EVIDENCE_INSUFFICIENT: 2,
    EVIDENCE_MISSING: 3,
    EVIDENCE_CONTRADICTS_LEVEL: 4,
    ESCALATED_RUN: 5,
  },
  thresholdBasis: 'MATCHED_INDICATORS_ONLY',
  thresholdValue: 20,
  minimumAutoIndicatorsForBasis: 5,
};

const auto = (
  code: string,
  outcome: IndicatorVerdict['autoOutcome'],
  domainCode = 'D1',
): IndicatorVerdict => ({ parameterCode: code, domainCode, autoOutcome: outcome });

const desk = (
  code: string,
  decision: IndicatorVerdict['deskDecision'],
  domainCode = 'D1',
): IndicatorVerdict => ({ parameterCode: code, domainCode, deskDecision: decision });

/** Enough automated verdicts to clear minimumAutoIndicatorsForBasis. */
const fiveClean = [1, 2, 3, 4, 5].map((n) => auto(`1.1.${n}`, 'MATCH'));

describe('what does and does not count as risk', () => {
  it('scores a clean school at zero', () => {
    const r = computeRisk(
      { verdicts: [...fiveClean, desk('3.1.1', 'EVIDENCE_SUPPORTS_LEVEL')], applicableCount: 6, escalated: false },
      RUBRIC,
    );
    expect(r.score).toBe(0);
    expect(r.aboveThreshold).toBe(false);
    expect(r.band).toBe('LOW');
  });

  // The single most important rule in the file. A government dataset with a hole in it is not
  // evidence against a school, and counting it as risk would penalise schools for the state's
  // own record keeping.
  it('never treats an unanswerable check as risk', () => {
    const allUnanswerable = [1, 2, 3, 4, 5, 6].map((n) => auto(`1.1.${n}`, 'NOT_CHECKABLE'));
    const r = computeRisk({ verdicts: allUnanswerable, applicableCount: 6, escalated: false }, RUBRIC);
    expect(r.score).toBe(0);
    expect(r.aboveThreshold).toBe(false);
    // And it is not counted as a check that happened, either.
    expect(r.autoCheckedCount).toBe(0);
  });

  it('counts an automated mismatch', () => {
    const r = computeRisk(
      { verdicts: [...fiveClean.slice(1), auto('1.1.1', 'MISMATCH')], applicableCount: 5, escalated: false },
      RUBRIC,
    );
    // One mismatch worth 2, over five automated verdicts with a ceiling of 2 each.
    expect(r.score).toBe(20);
  });

  it('weights a verifier contradicting the claim above an automated mismatch', () => {
    const withAuto = computeRisk(
      { verdicts: [...fiveClean.slice(1), auto('1.1.1', 'MISMATCH'), desk('3.1.1', 'EVIDENCE_SUPPORTS_LEVEL')], applicableCount: 6, escalated: false },
      RUBRIC,
    );
    const withDesk = computeRisk(
      { verdicts: [...fiveClean, desk('3.1.1', 'EVIDENCE_CONTRADICTS_LEVEL')], applicableCount: 6, escalated: false },
      RUBRIC,
    );
    expect(withDesk.score).toBeGreaterThan(withAuto.score);
  });

  it('ranks the four desk decisions in the intended order', () => {
    const scoreFor = (d: IndicatorVerdict['deskDecision']) =>
      computeRisk({ verdicts: [...fiveClean, desk('3.1.1', d)], applicableCount: 6, escalated: false }, RUBRIC).score;

    expect(scoreFor('EVIDENCE_SUPPORTS_LEVEL')).toBe(0);
    expect(scoreFor('EVIDENCE_INSUFFICIENT')).toBeGreaterThan(scoreFor('EVIDENCE_SUPPORTS_LEVEL'));
    expect(scoreFor('EVIDENCE_MISSING')).toBeGreaterThan(scoreFor('EVIDENCE_INSUFFICIENT'));
    expect(scoreFor('EVIDENCE_CONTRADICTS_LEVEL')).toBeGreaterThan(scoreFor('EVIDENCE_MISSING'));
  });

  it('applies the escalation penalty once per run, not per indicator', () => {
    const base = { verdicts: fiveClean, applicableCount: 5 };
    const clean = computeRisk({ ...base, escalated: false }, RUBRIC);
    const escalated = computeRisk({ ...base, escalated: true }, RUBRIC);
    expect(escalated.score).toBeGreaterThan(clean.score);
  });

  it('never exceeds 100', () => {
    const allBad = Array.from({ length: 8 }, (_, i) => desk(`3.1.${i}`, 'EVIDENCE_CONTRADICTS_LEVEL'));
    const r = computeRisk({ verdicts: allBad, applicableCount: 8, escalated: true }, RUBRIC);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe('the threshold basis, which the source documents leave unspecified', () => {
  // The brief's own concern: a percentage over automated checks alone is measured on partial
  // coverage. This is the guard against it firing on a sample of two.
  it('falls back to TOTAL_SCORE when too few automated checks returned a verdict', () => {
    const r = computeRisk(
      {
        verdicts: [auto('1.1.1', 'MISMATCH'), auto('1.1.2', 'MATCH')],
        applicableCount: 80,
        escalated: false,
      },
      RUBRIC,
    );
    expect(r.basisUsed).toBe('TOTAL_SCORE');
    expect(r.basisFallbackReason).toMatch(/below the minimum of 5/);
    // Over 80 applicable indicators, one mismatch is nowhere near the threshold. Measured over
    // the two judged indicators alone it would have been 50% and triggered a video call.
    expect(r.aboveThreshold).toBe(false);
  });

  it('keeps MATCHED_INDICATORS_ONLY once enough automated checks have landed', () => {
    const r = computeRisk(
      { verdicts: [...fiveClean, auto('1.1.6', 'MISMATCH')], applicableCount: 80, escalated: false },
      RUBRIC,
    );
    expect(r.basisUsed).toBe('MATCHED_INDICATORS_ONLY');
    expect(r.basisFallbackReason).toBeNull();
  });

  it('dilutes findings across all applicable indicators under TOTAL_SCORE', () => {
    const verdicts = [...fiveClean, desk('3.1.1', 'EVIDENCE_CONTRADICTS_LEVEL')];
    const matched = computeRisk({ verdicts, applicableCount: 80, escalated: false }, RUBRIC);
    const total = computeRisk({ verdicts, applicableCount: 80, escalated: false }, { ...RUBRIC, thresholdBasis: 'TOTAL_SCORE' });
    expect(total.score).toBeLessThan(matched.score);
  });

  // The basis that exists so a school cannot hide one very bad domain behind four good ones.
  it('reports the worst domain under PER_DOMAIN_WORST', () => {
    const verdicts = [
      ...[1, 2, 3, 4, 5].map((n) => auto(`1.1.${n}`, 'MATCH', 'D1')),
      desk('4.1.1', 'EVIDENCE_CONTRADICTS_LEVEL', 'D4'),
    ];
    const worst = computeRisk({ verdicts, applicableCount: 6, escalated: false }, { ...RUBRIC, thresholdBasis: 'PER_DOMAIN_WORST' });
    const matched = computeRisk({ verdicts, applicableCount: 6, escalated: false }, RUBRIC);
    // D4 is entirely bad, so the worst-domain figure is 100 while the pooled figure is not.
    expect(worst.score).toBe(100);
    expect(worst.score).toBeGreaterThan(matched.score);
  });

  it('reports zero rather than dividing by nothing when no verdict exists', () => {
    const r = computeRisk({ verdicts: [], applicableCount: 0, escalated: false }, RUBRIC);
    expect(r.score).toBe(0);
    expect(Number.isFinite(r.score)).toBe(true);
  });
});

describe('reproducibility and coverage', () => {
  // Without this a score cannot be re-derived after SSSA edits the rubric, which is the whole
  // reason RiskScore stores a version.
  it('stamps every result with the rubric version', () => {
    const r = computeRisk({ verdicts: fiveClean, applicableCount: 5, escalated: false }, { ...RUBRIC, version: 7 });
    expect(r.rubricVersion).toBe(7);
  });

  // A score of 15 over four judged indicators and a score of 15 over eighty are not the same
  // claim, and a reader has to be able to tell them apart.
  it('reports the three coverage counts', () => {
    const r = computeRisk(
      { verdicts: [...fiveClean, auto('1.1.9', 'NOT_CHECKABLE'), desk('3.1.1', 'EVIDENCE_INSUFFICIENT')], applicableCount: 80, escalated: false },
      RUBRIC,
    );
    expect(r.autoCheckedCount).toBe(5);
    expect(r.manualDecidedCount).toBe(1);
    expect(r.applicableCount).toBe(80);
  });

  it('is deterministic', () => {
    const inputs = { verdicts: [...fiveClean, desk('3.1.1', 'EVIDENCE_MISSING')], applicableCount: 12, escalated: false };
    expect(computeRisk(inputs, RUBRIC)).toEqual(computeRisk(inputs, RUBRIC));
  });
});

describe('bands track the threshold rather than fixed numbers', () => {
  it('puts anything at or below the threshold in LOW', () => {
    expect(bandFor(0, 20)).toBe('LOW');
    expect(bandFor(20, 20)).toBe('LOW');
  });

  it('splits MEDIUM and HIGH at twice the threshold', () => {
    expect(bandFor(20.1, 20)).toBe('MEDIUM');
    expect(bandFor(40, 20)).toBe('MEDIUM');
    expect(bandFor(40.1, 20)).toBe('HIGH');
  });

  it('moves with the threshold when SSSA edits it', () => {
    expect(bandFor(25, 20)).toBe('MEDIUM');
    expect(bandFor(25, 30)).toBe('LOW');
  });

  // Strictly above, so a school exactly on the threshold is not sent to a video call. The
  // flowchart says "deviation greater than 20%".
  it('treats the threshold as exclusive', () => {
    const on = computeRisk({ verdicts: [...fiveClean.slice(1), auto('1.1.1', 'MISMATCH')], applicableCount: 5, escalated: false }, RUBRIC);
    expect(on.score).toBe(20);
    expect(on.aboveThreshold).toBe(false);
  });
});

describe('the anti-anchoring rule', () => {
  // The brief requires the score to stay hidden until every decision is in, so that seeing it
  // cannot colour the judgements still to be made.
  it('is not ready while any manual indicator is undecided', () => {
    expect(readyToScore(48, 47)).toEqual({ ready: false, remaining: 1 });
    expect(readyToScore(48, 0)).toEqual({ ready: false, remaining: 48 });
  });

  it('is ready once every manual indicator has a decision', () => {
    expect(readyToScore(48, 48)).toEqual({ ready: true, remaining: 0 });
  });

  // An unanswerable automated check must not block the verifier: it is not their work.
  it('does not count automated coverage against readiness', () => {
    expect(readyToScore(0, 0)).toEqual({ ready: true, remaining: 0 });
  });
});

describe('rationale', () => {
  it('is required for everything except evidence supporting the level', () => {
    expect(rationaleRequired('EVIDENCE_SUPPORTS_LEVEL')).toBe(false);
    expect(rationaleRequired('EVIDENCE_INSUFFICIENT')).toBe(true);
    expect(rationaleRequired('EVIDENCE_MISSING')).toBe(true);
    expect(rationaleRequired('EVIDENCE_CONTRADICTS_LEVEL')).toBe(true);
  });
});
