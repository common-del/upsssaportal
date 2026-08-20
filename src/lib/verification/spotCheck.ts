import { createHmac } from 'crypto';
import type { SpotCheckMode } from '@prisma/client';

/**
 * Choosing which children a field verifier tests.
 *
 * This is a small function with an unusually adversarial set of requirements, and it is worth
 * setting them out because they pull against each other.
 *
 *   The school must not be able to predict the selection, or it prepares those children.
 *   The verifier must not be able to choose it either, or a school can influence the verifier and
 *     the sample stops being a sample.
 *   The Audit Cell must be able to re-derive it months later, because its whole job is checking
 *     that the primary verifier tested who they said they tested.
 *   And no child's name may be stored, because a quality-assurance record is not a reason for
 *     the state to hold a register of named children's test results.
 *
 * All four are satisfied by seeding on the visit id and a server secret, and by identifying a
 * child by class and roll position rather than by name. The selection is a pure function of the
 * visit, so it is stable and re-derivable; it depends on a secret neither the school nor the
 * verifier holds, so neither can predict or steer it; and the verifier reads the roll number off
 * the class register on the day, which means the portal never learns who the child was.
 *
 * The counts come from configuration because the source documents disagree: the terms of
 * reference say "10 randomly selected students" and the role card says "10% of students". These
 * are different instruments, so both are implemented and the mode decides.
 */

export type SpotCheckConfig = {
  mode: SpotCheckMode;
  fixedCount: number;
  percentage: number;
  /** Floor for very small schools when percentage mode is used. */
  minimum: number;
};

/**
 * How many children to test.
 *
 * Capped at the enrolment, because a 10-child sample of a 6-child school is 6. The floor applies
 * only in percentage mode: in fixed-count mode the configured count already is the floor, and
 * applying a second one would silently override it.
 */
export function spotCheckSize(config: SpotCheckConfig, enrolment: number): number {
  if (enrolment <= 0) return 0;
  if (config.mode === 'FIXED_COUNT') {
    return Math.min(config.fixedCount, enrolment);
  }
  const proportional = Math.round((enrolment * config.percentage) / 100);
  return Math.min(Math.max(proportional, config.minimum), enrolment);
}

export type SpotCheckSlot = {
  classLevel: number;
  rollPosition: number;
};

export type SpotCheckSample = {
  /** The children to test, in the order they should be called. */
  slots: SpotCheckSlot[];
  /**
   * Extras, used in order when a slot turns out to be absent or the roll is shorter than
   * estimated. Present because a verifier who is one child short must not be left choosing the
   * replacement themselves, which is exactly the discretion this design removes.
   */
  substitutes: SpotCheckSlot[];
};

/**
 * A deterministic stream of numbers from the visit and the server secret.
 *
 * HMAC rather than a plain hash for the same reason the school masking uses one: the visit id is
 * not secret, so an unkeyed digest could be recomputed by anyone who learned it, including the
 * school. Counter-extended so one seed yields as many values as the sample needs.
 */
function seededSequence(seed: string, count: number): number[] {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    // Fails closed, like the masking. A predictable sample is worse than no sample, because it
    // looks like evidence while being arrangeable in advance.
    throw new Error(
      'Cannot draw a spot-check sample: AUTH_SECRET is not set, and an unkeyed draw would be predictable.',
    );
  }
  const out: number[] = [];
  let block = 0;
  while (out.length < count) {
    const digest = createHmac('sha256', secret).update(`${seed}:${block}`).digest();
    for (let i = 0; i + 4 <= digest.length && out.length < count; i += 4) {
      out.push(digest.readUInt32BE(i));
    }
    block += 1;
  }
  return out;
}

/**
 * Draw the sample.
 *
 * Spread across the classes the school teaches rather than drawn from the register as one list.
 * Ten children all from class 5 would be a sample of class 5, and the framework's reading and
 * numeracy indicators are about the school. Distributed round-robin so a school teaching classes
 * 1 to 8 with a sample of ten gets at least one child from each of eight classes and two classes
 * tested twice, rather than a clumped draw that misses three classes by chance.
 */
export function drawSpotCheckSample(
  visitId: string,
  classFrom: number,
  classTo: number,
  size: number,
  /** Estimated children per class, used only to bound the roll position. */
  perClassEstimate: number,
  substituteCount = 3,
): SpotCheckSample {
  const classes: number[] = [];
  for (let c = classFrom; c <= classTo; c++) classes.push(c);
  if (classes.length === 0 || size <= 0) return { slots: [], substitutes: [] };

  const bound = Math.max(1, perClassEstimate);
  const total = size + substituteCount;
  const random = seededSequence(visitId, total);

  const used = new Set<string>();
  const drawn: SpotCheckSlot[] = [];

  for (let i = 0; drawn.length < total && i < random.length; i++) {
    // Round-robin on the class, random on the roll position. Assigning the class randomly too
    // would reintroduce the clumping this is here to avoid.
    const classLevel = classes[drawn.length % classes.length]!;
    const rollPosition = (random[i]! % bound) + 1;
    const key = `${classLevel}:${rollPosition}`;
    // A duplicate would have the verifier test one child twice and report it as two, which
    // overstates the coverage of the sample.
    if (used.has(key)) continue;
    used.add(key);
    drawn.push({ classLevel, rollPosition });
  }

  return {
    slots: drawn.slice(0, size),
    substitutes: drawn.slice(size),
  };
}

/**
 * Roughly how many children sit in each class, so a roll position is plausible.
 *
 * A crude divide, and deliberately so. A precise per-class roll would need the school's register,
 * which the portal does not hold; a verifier handed roll position 61 for a class of 40 marks it
 * unavailable and takes a substitute, which costs a moment and is far better than the portal
 * inventing a per-class breakdown it has no basis for.
 */
export function perClassEstimate(totalStudents: number, classFrom: number, classTo: number): number {
  const classes = Math.max(1, classTo - classFrom + 1);
  return Math.max(1, Math.ceil(totalStudents / classes));
}

export type TaskScores = {
  reading: number | null;
  writing: number | null;
  numeracy: number | null;
};

/**
 * Whether a spot-check record counts as administered.
 *
 * All three tasks, or none. A record with reading filled and numeracy blank is ambiguous between
 * "the child could not do it" and "the verifier ran out of time", and the two mean opposite
 * things about the school. Marking a slot unavailable is the way to record a child who was not
 * there, which is a different fact and stored differently.
 */
export function isSpotCheckComplete(scores: TaskScores): boolean {
  return scores.reading !== null && scores.writing !== null && scores.numeracy !== null;
}

/** Sign-off has to happen on the day of the visit, per the terms of reference. */
const IST_OFFSET_MINUTES = 5 * 60 + 30;

export function isSameISTDay(a: Date, b: Date): boolean {
  const dayOf = (d: Date) =>
    Math.floor((d.getTime() + IST_OFFSET_MINUTES * 60_000) / 86_400_000);
  return dayOf(a) === dayOf(b);
}
