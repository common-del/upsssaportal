import { createHmac } from 'crypto';

/**
 * What an Online Verifier is allowed to see about a school.
 *
 * The terms of reference promise that Online Verifiers and the schools they review stay
 * anonymous to each other. The verifier half is easy and is handled elsewhere: they appear to
 * the school as a pseudonym. This file is the school half, and it is the harder direction,
 * because the portal knows exactly who the school is and has to work hard not to say.
 *
 * The important design decision is the code itself, and it is easy to get wrong.
 *
 * A plain hash of the UDISE would look anonymous and provide almost no anonymity. An Online
 * Verifier is a VSK data analyst; the register of 2,65,278 UDISE codes is not secret, and
 * anyone holding it can hash every code once and build a lookup table. Unkeyed hashing of a
 * value drawn from a small, public, enumerable set is obfuscation, not anonymisation.
 *
 * So the code is an HMAC keyed on a server-side secret the verifier does not have. Same school,
 * same code, every session, so a case can be discussed and referred to; but no way to invert it
 * or to build a table without the key.
 *
 * The key is the application's existing auth secret rather than a new variable, for a specific
 * reason: it is already required for the portal to run at all, so there is no configuration in
 * which masking silently degrades to the unkeyed version. If the secret is missing, this throws
 * rather than falling back. A masking function that quietly stops masking is worse than one
 * that fails, because nobody notices the first.
 */

/** Everything the desk screening workspace may know about the school under review. */
export type MaskedSchool = {
  /** Stable, keyed, non-invertible. Shown to the verifier in place of a name. */
  maskedCode: string;
  /**
   * The school's stage: PRIMARY, UPPER_PRIMARY or SECONDARY. Not identifying, and the verifier
   * needs it, because 18 of the 89 indicators do not apply to every stage and a screener has to
   * know which paper they are reading.
   */
  category: string;
};

/** The fields a school row carries that must never reach an Online Verifier. */
export const IDENTIFYING_FIELDS = [
  'udise',
  'nameEn',
  'nameHi',
  'addressEn',
  'addressHi',
  'publicPhone',
  'districtCode',
  'blockCode',
  'district',
  'block',
  'feesRangeMin',
  'feesRangeMax',
  'management',
] as const;

function maskingKey(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    // Fails closed. The alternative is an unkeyed code that reads as anonymous while being
    // trivially reversible by anyone holding the school register, which every verifier does.
    throw new Error(
      'Cannot mask a school: AUTH_SECRET is not set, and an unkeyed code would not be anonymous.',
    );
  }
  return secret;
}

/**
 * The pseudonymous code for a school.
 *
 * Ten hex characters, upper-cased, prefixed so it reads as an identifier rather than a number
 * somebody might mistake for a UDISE. Ten characters of HMAC output is about 40 bits, which is
 * far more than the 2,65,278 schools need to stay collision-free while remaining short enough
 * to say aloud on a call.
 */
export function maskedCodeFor(udise: string): string {
  const digest = createHmac('sha256', maskingKey()).update(`school:${udise}`).digest('hex');
  return `SC-${digest.slice(0, 10).toUpperCase()}`;
}

/**
 * Reduce a school row to what a desk screener may see.
 *
 * Takes the two fields it needs by name rather than accepting a whole row and deleting from it.
 * Building the safe object from scratch means a field added to School later cannot leak by
 * default; the opposite approach, stripping known-bad keys, leaks every field nobody remembered
 * to add to the list.
 */
export function maskSchool(school: { udise: string; category: string }): MaskedSchool {
  return {
    maskedCode: maskedCodeFor(school.udise),
    category: school.category,
  };
}

/**
 * True when this role must only ever see the masked view during desk screening.
 *
 * Supervisors and SSSA PMU are excluded: a supervisor handling an escalation has to be able to
 * identify the school to act on it, and the audit trail records that they did. On-Ground
 * Verifiers are excluded too, because their anonymity works the other way round, by time gate
 * at reveal rather than by masking.
 */
export function mustSeeMaskedOnly(role: string): boolean {
  return role === 'ONLINE_VERIFIER' || role === 'VERIFIER';
}
