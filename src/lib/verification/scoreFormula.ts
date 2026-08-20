/**
 * The domain-weighted score formula, extracted pure.
 *
 * The same arithmetic already lives in two places that predate the verification pipeline:
 * `computeAndStoreResult` in finalization.ts (the legacy verifier-submission flow) and the
 * results backfill. Both are working code with their own data sources and are left alone.
 * This module exists so the publication path introduced in build step 8 computes scores
 * from plain maps with no session gate and no Prisma handle, which is what makes it
 * testable and callable from inside a state transition.
 *
 * The formula: within each domain, achieved points over possible points across the
 * applicable indicators; domains combine by their configured weight; the result is a
 * percentage rounded to one decimal. A domain with no possible points or no weight simply
 * drops out of the weighting rather than counting as zero, because "not measured" and
 * "scored nothing" are different facts.
 */

export type ScorableParameter = {
  id: string;
  domainId: string;
  /** Option keys this indicator offers, e.g. LEVEL_1, LEVEL_2, LEVEL_3. */
  optionKeys: string[];
};

/** rubric.get(`${parameterId}:${optionKey}`) → points for choosing that option. */
export type RubricPoints = Map<string, number>;

export function domainWeightedPercent(
  applicable: ScorableParameter[],
  rubric: RubricPoints,
  domainWeights: Map<string, number>,
  responses: Map<string, string>,
): number | null {
  const groups = new Map<string, { achieved: number; possible: number }>();
  for (const p of applicable) {
    const group = groups.get(p.domainId) ?? { achieved: 0, possible: 0 };
    group.possible += Math.max(0, ...p.optionKeys.map((k) => rubric.get(`${p.id}:${k}`) ?? 0));
    const chosen = responses.get(p.id);
    if (chosen) group.achieved += rubric.get(`${p.id}:${chosen}`) ?? 0;
    groups.set(p.domainId, group);
  }

  let weightedSum = 0;
  let totalWeight = 0;
  for (const [domainId, group] of groups) {
    const weight = domainWeights.get(domainId) ?? 0;
    if (weight > 0 && group.possible > 0) {
      weightedSum += (group.achieved / group.possible) * weight;
      totalWeight += weight;
    }
  }
  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100 * 10) / 10 : null;
}

export type GradeBandDef = { key: string; minPercent: number; maxPercent: number };

/**
 * Band lookup, half-open below the top band and closed on it, exactly as the two older
 * implementations do it: a 55 sits in the band that starts at 55, and 100 still lands in
 * the top band rather than falling off the end.
 */
export function gradeBandFor(score: number | null, bands: GradeBandDef[]): string | null {
  if (score === null) return null;
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i]!;
    const last = i === bands.length - 1;
    if (score >= band.minPercent && (last ? score <= band.maxPercent : score < band.maxPercent)) {
      return band.key;
    }
  }
  return null;
}

/**
 * The verified response set: the school's claims with every upheld correction applied.
 *
 * A correction carries a level number (the option's order) because that is what the field
 * verifier observed and the supervisor ruled on; `orderToKey` translates it back to the
 * option key the rubric scores. A correction whose level has no option for that indicator
 * is skipped rather than guessed at, and the caller is told, because silently dropping a
 * ruling and silently mis-scoring one are both worse than saying so.
 */
export function applyCorrections(
  claims: Map<string, string>,
  corrections: { parameterId: string; level: number }[],
  orderToKey: Map<string, string>,
): { responses: Map<string, string>; unmapped: string[] } {
  const responses = new Map(claims);
  const unmapped: string[] = [];
  for (const c of corrections) {
    const key = orderToKey.get(`${c.parameterId}:${c.level}`);
    if (key === undefined) {
      unmapped.push(c.parameterId);
      continue;
    }
    responses.set(c.parameterId, key);
  }
  return { responses, unmapped };
}
