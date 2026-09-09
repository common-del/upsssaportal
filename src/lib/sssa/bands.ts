export type GradeBandRange = { labelEn: string; minPercent: number; maxPercent: number };

/**
 * Which grade band a score falls in. Upper bound exclusive except on the top band,
 * matching computeAndStoreResult, so a school on exactly 80 is Utkarsh everywhere it
 * is printed. Shared by the verification queue and the decisions inbox so the two
 * can never disagree about a band label.
 */
export function bandForScore(bands: GradeBandRange[], score: number | null): string | null {
  if (score == null) return null;
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i]!;
    const last = i === bands.length - 1;
    if (score >= b.minPercent && (last ? score <= b.maxPercent : score < b.maxPercent)) {
      return b.labelEn;
    }
  }
  return null;
}
