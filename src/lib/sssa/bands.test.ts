import { describe, expect, it } from 'vitest';
import { bandForScore, type GradeBandRange } from './bands';

// The real bands: Uday to 55, Unnat to 80, Utkarsh above.
const BANDS: GradeBandRange[] = [
  { labelEn: 'Uday', minPercent: 0, maxPercent: 55 },
  { labelEn: 'Unnat', minPercent: 55, maxPercent: 80 },
  { labelEn: 'Utkarsh', minPercent: 80, maxPercent: 100 },
];

describe('bandForScore', () => {
  it('places scores in their band', () => {
    expect(bandForScore(BANDS, 12.5)).toBe('Uday');
    expect(bandForScore(BANDS, 61.4)).toBe('Unnat');
    expect(bandForScore(BANDS, 92)).toBe('Utkarsh');
  });

  // Boundaries follow computeAndStoreResult: lower bound inclusive, upper bound
  // exclusive except the top band, so 55 is Unnat, 80 is Utkarsh, and 100 stays in.
  it('resolves the shared boundaries upward and keeps the ceiling', () => {
    expect(bandForScore(BANDS, 55)).toBe('Unnat');
    expect(bandForScore(BANDS, 80)).toBe('Utkarsh');
    expect(bandForScore(BANDS, 100)).toBe('Utkarsh');
  });

  it('returns null for a missing score or empty bands', () => {
    expect(bandForScore(BANDS, null)).toBeNull();
    expect(bandForScore([], 60)).toBeNull();
  });
});
