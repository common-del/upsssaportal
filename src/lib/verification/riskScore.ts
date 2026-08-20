import type { AutoCheckOutcome, DeskDecision, RiskThresholdBasis } from '@prisma/client';

/**
 * The risk rubric, as a pure function.
 *
 * The brief is firm on the shape of this and the reasons are good ones, so they are restated
 * here rather than left in the document: the score is computed by the system but built from the
 * verifier's judgements, not instead of them; the weights and thresholds live in a versioned
 * table only SSSA PMU can edit, because the terms of reference say verifiers apply the rubric
 * without modifying it; and every score records the rubric version that produced it, so a
 * later reweighting cannot silently move a number that has already driven a decision.
 *
 * What the score does. It decides one thing: whether a school goes to a video walkthrough or
 * into the census queue. That is the only consequence, and it is worth keeping in view, because
 * it means a wrong score costs a school an unnecessary video call or spares it a warranted one.
 * It is not the school's grade. The grade comes from the SQAAF weighted score, which is a
 * different calculation over the same answers.
 *
 * Why the denominator is the hard part. Every indicator that could not be judged, whether
 * because no government system holds the field or because no threshold rule exists to turn a
 * count into a level, is a hole in the coverage. Divide by the applicable indicators and a
 * school with mostly unanswerable indicators looks safe because its few findings are diluted.
 * Divide only by what was judged and a school with two judged indicators, one of them bad,
 * scores 50% risk on a sample of two. Neither is right in every case, which is why the basis is
 * configurable and why every score stores the three coverage counts that let a reader tell
 * which situation they are looking at.
 */

export type RubricWeights = {
  AUTO_MISMATCH: number;
  EVIDENCE_SUPPORTS_LEVEL: number;
  EVIDENCE_INSUFFICIENT: number;
  EVIDENCE_MISSING: number;
  EVIDENCE_CONTRADICTS_LEVEL: number;
  /** Applied once per run, not per indicator. */
  ESCALATED_RUN: number;
};

export type Rubric = {
  version: number;
  weights: RubricWeights;
  thresholdBasis: RiskThresholdBasis;
  thresholdValue: number;
  minimumAutoIndicatorsForBasis: number;
};

/** One indicator's contribution, as the workspace knows it. */
export type IndicatorVerdict = {
  parameterCode: string;
  /** Domain code, for the PER_DOMAIN_WORST basis. */
  domainCode: string;
  /** Set for an AUTO indicator that was cross-matched. */
  autoOutcome?: AutoCheckOutcome;
  /** Set for a MANUAL indicator the verifier has decided. */
  deskDecision?: DeskDecision;
};

export type RiskInputs = {
  verdicts: IndicatorVerdict[];
  /** Applicable indicators for this school, including ones with no verdict yet. */
  applicableCount: number;
  /** True when the verifier could not apply the rubric anywhere on this run. */
  escalated: boolean;
};

export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH';

export type RiskResult = {
  score: number;
  band: RiskBand;
  aboveThreshold: boolean;
  /** The basis actually used, which is not always the one requested. */
  basisUsed: RiskThresholdBasis;
  /** Set when the requested basis was abandoned, with the reason. */
  basisFallbackReason: string | null;
  autoCheckedCount: number;
  manualDecidedCount: number;
  applicableCount: number;
  rubricVersion: number;
};

/**
 * The worst a single indicator can contribute.
 *
 * An automated mismatch and a verifier finding evidence that contradicts the claim are not
 * equivalent, and the denominator has to reflect that or the percentage is not comparable
 * between schools. A school whose findings are all automated is measured against a lower
 * ceiling than one whose findings are all human, which is right: the human judgement is the
 * stronger signal and the rubric weights it higher.
 */
function maxForVerdict(v: IndicatorVerdict, w: RubricWeights): number {
  if (v.deskDecision !== undefined) {
    return Math.max(
      w.EVIDENCE_SUPPORTS_LEVEL,
      w.EVIDENCE_INSUFFICIENT,
      w.EVIDENCE_MISSING,
      w.EVIDENCE_CONTRADICTS_LEVEL,
    );
  }
  return w.AUTO_MISMATCH;
}

function weightForVerdict(v: IndicatorVerdict, w: RubricWeights): number {
  if (v.deskDecision !== undefined) return w[v.deskDecision];
  if (v.autoOutcome === 'MISMATCH') return w.AUTO_MISMATCH;
  // MATCH contributes nothing, and NOT_CHECKABLE must contribute nothing either. An
  // unanswerable indicator is not evidence of risk, and treating it as any would penalise a
  // school for a gap in a government dataset.
  return 0;
}

/** A verdict that actually says something, as opposed to one that could not be reached. */
function isJudged(v: IndicatorVerdict): boolean {
  if (v.deskDecision !== undefined) return true;
  return v.autoOutcome === 'MATCH' || v.autoOutcome === 'MISMATCH';
}

function percent(points: number, ceiling: number): number {
  if (ceiling <= 0) return 0;
  return Math.round((points / ceiling) * 1000) / 10;
}

export function computeRisk(inputs: RiskInputs, rubric: Rubric): RiskResult {
  const { weights } = rubric;
  const judged = inputs.verdicts.filter(isJudged);

  const autoCheckedCount = judged.filter((v) => v.deskDecision === undefined).length;
  const manualDecidedCount = judged.filter((v) => v.deskDecision !== undefined).length;

  const points =
    judged.reduce((sum, v) => sum + weightForVerdict(v, weights), 0) +
    (inputs.escalated ? weights.ESCALATED_RUN : 0);

  // Requested basis, and the fallback when it would be measuring too little to mean anything.
  let basisUsed = rubric.thresholdBasis;
  let basisFallbackReason: string | null = null;

  if (
    basisUsed === 'MATCHED_INDICATORS_ONLY' &&
    autoCheckedCount < rubric.minimumAutoIndicatorsForBasis
  ) {
    basisUsed = 'TOTAL_SCORE';
    basisFallbackReason =
      `Only ${autoCheckedCount} automated check(s) returned a verdict, below the ` +
      `minimum of ${rubric.minimumAutoIndicatorsForBasis}, so the score is measured over ` +
      `all applicable indicators instead.`;
  }

  let score: number;

  if (basisUsed === 'PER_DOMAIN_WORST') {
    const byDomain = new Map<string, { points: number; ceiling: number }>();
    for (const v of judged) {
      const d = byDomain.get(v.domainCode) ?? { points: 0, ceiling: 0 };
      d.points += weightForVerdict(v, weights);
      d.ceiling += maxForVerdict(v, weights);
      byDomain.set(v.domainCode, d);
    }
    // The escalation penalty is per run, so it cannot be attributed to one domain. Applied to
    // the worst domain's points rather than spread, because an escalation is a statement about
    // the case as a whole and diluting it across domains would let it disappear.
    const perDomain = [...byDomain.values()].map((d) => percent(d.points, d.ceiling));
    const worst = perDomain.length > 0 ? Math.max(...perDomain) : 0;
    const escalationBump = inputs.escalated
      ? percent(weights.ESCALATED_RUN, Math.max(1, weights.EVIDENCE_CONTRADICTS_LEVEL))
      : 0;
    score = Math.min(100, Math.round((worst + escalationBump) * 10) / 10);
  } else if (basisUsed === 'MATCHED_INDICATORS_ONLY') {
    const ceiling = judged.reduce((sum, v) => sum + maxForVerdict(v, weights), 0);
    score = Math.min(100, percent(points, ceiling));
  } else {
    // TOTAL_SCORE: measured over every applicable indicator, judged or not. Uses the manual
    // ceiling for the unjudged remainder, since an indicator with no verdict yet could turn
    // out to be either kind and the manual ceiling is the higher of the two.
    const judgedCeiling = judged.reduce((sum, v) => sum + maxForVerdict(v, weights), 0);
    const unjudged = Math.max(0, inputs.applicableCount - judged.length);
    const ceiling =
      judgedCeiling +
      unjudged *
        Math.max(
          weights.EVIDENCE_SUPPORTS_LEVEL,
          weights.EVIDENCE_INSUFFICIENT,
          weights.EVIDENCE_MISSING,
          weights.EVIDENCE_CONTRADICTS_LEVEL,
        );
    score = Math.min(100, percent(points, ceiling));
  }

  const aboveThreshold = score > rubric.thresholdValue;

  return {
    score,
    band: bandFor(score, rubric.thresholdValue),
    aboveThreshold,
    basisUsed,
    basisFallbackReason,
    autoCheckedCount,
    manualDecidedCount,
    applicableCount: inputs.applicableCount,
    rubricVersion: rubric.version,
  };
}

/**
 * Bands are presentational and the threshold is not.
 *
 * Only `aboveThreshold` decides where a school goes next, so these three labels can be retuned
 * for the Supervisor's drift monitor without changing a single school's route. Anchored to the
 * threshold rather than to fixed numbers so they cannot drift away from it when SSSA edits the
 * rubric.
 */
export function bandFor(score: number, thresholdValue: number): RiskBand {
  if (score <= thresholdValue) return 'LOW';
  if (score <= thresholdValue * 2) return 'MEDIUM';
  return 'HIGH';
}

/**
 * Whether the verifier has done enough for a score to be meaningful.
 *
 * The brief requires the score to be hidden until every per-indicator decision is entered, so
 * that seeing it cannot anchor the judgements still to be made. This is the check behind that:
 * it is about the verifier's own work, so an AUTO indicator the source could not answer does
 * not block them, but a MANUAL indicator they have not looked at does.
 */
export function readyToScore(
  manualIndicatorCount: number,
  manualDecidedCount: number,
): { ready: boolean; remaining: number } {
  const remaining = Math.max(0, manualIndicatorCount - manualDecidedCount);
  return { ready: remaining === 0, remaining };
}

/** A rationale is mandatory for every decision other than "the evidence supports the level". */
export function rationaleRequired(decision: DeskDecision): boolean {
  return decision !== 'EVIDENCE_SUPPORTS_LEVEL';
}
