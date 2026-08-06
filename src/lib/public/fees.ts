import { illustrativeFeeBand } from '@/lib/public/nearbyDummyData';
import type { SchoolType } from '@/lib/public/constants';

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/**
 * The annual fee to show for one school.
 *
 * Shared by the directory and the Find a School results so the two cannot drift
 * into showing different figures for the same school. A real disclosure wins
 * where it exists; otherwise illustrativeFeeBand fills in, because only the
 * hand-seeded demo schools carry feesRangeMin/Max at all.
 */
export function feeLabel(
  udise: string,
  type: SchoolType,
  feesMin: number | null,
  feesMax: number | null,
): string {
  const disclosed = feesMin !== null || feesMax !== null;
  const { min, max } = disclosed
    ? { min: feesMin ?? feesMax ?? 0, max: feesMax ?? feesMin ?? 0 }
    : illustrativeFeeBand(udise, type);

  if (min === 0 && max === 0) return 'No fee';
  if (min === max) return rupees(min);
  return `${rupees(min)} – ${rupees(max)}`;
}
