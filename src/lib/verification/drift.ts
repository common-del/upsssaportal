/**
 * The risk algorithm drift monitor.
 *
 * The brief asks the supervisor screen to show the distribution of risk scores over time and
 * to flag shifts for referral to the platform vendor. The premise: the rubric is fixed, so if
 * the population of scores moves, either the schools changed, the screeners changed, or the
 * inputs changed, and someone should look at which.
 *
 * This module only detects; it does not diagnose. The thresholds below are presentation
 * heuristics for when a shift is worth a person's attention, not programme rules, which is
 * why they are exported constants with stated reasons rather than configuration.
 */

export type ScorePoint = {
  score: number;
  aboveThreshold: boolean;
  computedAt: Date;
};

export type DriftBucket = {
  /** Calendar month in IST, e.g. "2026-08". */
  key: string;
  count: number;
  meanScore: number;
  aboveThresholdPct: number;
};

export type DriftFlag = {
  bucketKey: string;
  kind: 'MEAN_SHIFT' | 'THRESHOLD_SHARE_SHIFT';
  /** Signed change against the baseline of all earlier buckets. */
  delta: number;
  detail: string;
};

export type DriftReport = {
  buckets: DriftBucket[];
  flags: DriftFlag[];
};

/** Below this many scores a month is noise, not a distribution. */
export const DRIFT_MIN_BUCKET = 20;
/** A mean moving this many points against the running baseline is worth a referral. */
export const DRIFT_MEAN_SHIFT_POINTS = 10;
/** The above-threshold share moving this many percentage points likewise. */
export const DRIFT_SHARE_SHIFT_POINTS = 15;

const IST_OFFSET_MINUTES = 5 * 60 + 30;

/** The IST calendar month, because the programme's months are Indian months. */
export function monthKeyIST(at: Date): string {
  const ist = new Date(at.getTime() + IST_OFFSET_MINUTES * 60_000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function bucketScores(points: ScorePoint[]): DriftBucket[] {
  const byMonth = new Map<string, ScorePoint[]>();
  for (const p of points) {
    const key = monthKeyIST(p.computedAt);
    const list = byMonth.get(key) ?? [];
    list.push(p);
    byMonth.set(key, list);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => ({
      key,
      count: list.length,
      meanScore: list.reduce((s, p) => s + p.score, 0) / list.length,
      aboveThresholdPct: (list.filter((p) => p.aboveThreshold).length / list.length) * 100,
    }));
}

/**
 * Compare each month against the count-weighted baseline of every earlier month.
 *
 * Cumulative rather than month-on-month, so a slow one-way creep is caught: five months each
 * moving four points never trips a month-on-month check but has moved the distribution
 * twenty points from where it started. Both the month and its baseline must clear the
 * minimum size, or a quiet week of twelve screenings would flag itself.
 */
export function driftReport(points: ScorePoint[]): DriftReport {
  const buckets = bucketScores(points);
  const flags: DriftFlag[] = [];

  let baseCount = 0;
  let baseScoreSum = 0;
  let baseAboveCount = 0;

  for (const bucket of buckets) {
    if (baseCount >= DRIFT_MIN_BUCKET && bucket.count >= DRIFT_MIN_BUCKET) {
      const baseMean = baseScoreSum / baseCount;
      const baseSharePct = (baseAboveCount / baseCount) * 100;

      const meanDelta = bucket.meanScore - baseMean;
      if (Math.abs(meanDelta) >= DRIFT_MEAN_SHIFT_POINTS) {
        flags.push({
          bucketKey: bucket.key,
          kind: 'MEAN_SHIFT',
          delta: meanDelta,
          detail: `Mean risk score ${bucket.meanScore.toFixed(1)} against a baseline of ${baseMean.toFixed(1)}.`,
        });
      }

      const shareDelta = bucket.aboveThresholdPct - baseSharePct;
      if (Math.abs(shareDelta) >= DRIFT_SHARE_SHIFT_POINTS) {
        flags.push({
          bucketKey: bucket.key,
          kind: 'THRESHOLD_SHARE_SHIFT',
          delta: shareDelta,
          detail: `${bucket.aboveThresholdPct.toFixed(0)}% of cases above threshold against a baseline of ${baseSharePct.toFixed(0)}%.`,
        });
      }
    }

    baseCount += bucket.count;
    baseScoreSum += bucket.meanScore * bucket.count;
    baseAboveCount += (bucket.aboveThresholdPct / 100) * bucket.count;
  }

  return { buckets, flags };
}
