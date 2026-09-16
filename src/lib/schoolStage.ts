/**
 * Which grades a school teaches, and the one place that decides it.
 *
 * SQAAF's applicability is written against three stages, and 18 of the 89 indicators do not
 * apply to all of them. Getting the stage wrong therefore changes what a school is measured on.
 *
 * Until now the stage was read from `School.category`, which carries two different things. The
 * hand-seeded schools hold a level there ("Primary", "Upper Primary", "Secondary"); the bulk
 * register holds an ownership type ("GOVT", "GOVT_AIDED", "PRIVATE_AIDED", "PRIVATE"), which is
 * also stored properly in `School.management`, so the column duplicates one field and misnames
 * the other. Six copies of a `CATEGORY_TO_CODE` map, each with its own silent `?? 'PRIMARY'`,
 * read it. A secondary school whose category says GOVT was screened against primary's paper and
 * nothing said so.
 *
 * `School.stage` replaces that reading. It is nullable on purpose and the null means one thing:
 * the register has not told us. Inventing a stage would be worse than admitting the gap, because
 * an invented stage is indistinguishable from a known one and quietly decides what a school is
 * judged on.
 *
 * The fallback for a null stage is still PRIMARY, so no stored score moves. The difference is
 * that the fallback is now named, counted and visible rather than an accident of a lookup miss.
 */

export const STAGES = ['PRIMARY', 'UPPER_PRIMARY', 'SECONDARY'] as const;
export type Stage = (typeof STAGES)[number];

/** The stage applicability assumes when the register has not recorded one. Unchanged from the
 *  behaviour every call site had before, so that this refactor moves no result. */
export const STAGE_FALLBACK: Stage = 'PRIMARY';

const STAGE_LABEL: Record<Stage, string> = {
  PRIMARY: 'Primary',
  UPPER_PRIMARY: 'Upper primary',
  SECONDARY: 'Secondary',
};

export function isStage(value: string | null | undefined): value is Stage {
  return value !== null && value !== undefined && (STAGES as readonly string[]).includes(value);
}

/** What a screener reads. A school with no recorded stage says so rather than passing as
 *  primary, because "I do not know which paper this is" is information a screener needs. */
export function stageLabel(stage: string | null | undefined): string {
  return isStage(stage) ? STAGE_LABEL[stage] : 'Stage not recorded';
}

/**
 * The applicability code for a school.
 *
 * Takes the stored stage where there is one and the documented fallback where there is not.
 * This is the only place that fallback happens, so the number of schools relying on it can be
 * counted rather than guessed at.
 */
export function stageCodeFor(stage: string | null | undefined): Stage {
  return isStage(stage) ? stage : STAGE_FALLBACK;
}

/**
 * The stage a legacy `category` value states, where it states one at all.
 *
 * Matched on keywords rather than exact strings because the column holds "Secondary",
 * "SECONDARY" and "Upper Primary" across different seeds. An ownership value returns null: it
 * says nothing about the grades taught, and pretending otherwise is the bug this replaces.
 */
export function stageFromCategory(category: string | null | undefined): Stage | null {
  const c = (category ?? '').toUpperCase();
  if (!c) return null;
  if (c.includes('UPPER')) return 'UPPER_PRIMARY';
  // Higher secondary and senior secondary both sit in SQAAF's secondary stage.
  if (c.includes('SECOND') || c.includes('SENIOR') || c.includes('HIGHER')) return 'SECONDARY';
  if (c.includes('PRIMARY')) return 'PRIMARY';
  return null;
}

/** Nursery and its equivalents sit below class 1 and never decide a stage on their own. */
const PRE_PRIMARY = ['NURSERY', 'LKG', 'UKG', 'KG', 'PRE', 'BALVATIKA'];

const ROMAN: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6,
  VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12,
};

/** A class label as a number, or null where it names no class. */
export function classNumber(label: string | null | undefined): number | null {
  const raw = (label ?? '').trim().toUpperCase();
  if (!raw) return null;
  if (PRE_PRIMARY.some((p) => raw.startsWith(p))) return 0;
  const digits = raw.match(/\d+/);
  if (digits) {
    const n = Number(digits[0]);
    return n >= 0 && n <= 12 ? n : null;
  }
  return ROMAN[raw] ?? null;
}

/**
 * The stage a class range implies, decided by the highest class taught.
 *
 * A school running classes 1 to 10 is a secondary school for applicability: it has to answer
 * the secondary indicators because it teaches those grades. The lowest class says nothing about
 * which paper applies.
 */
export function stageFromClassRange(
  classesFrom: string | null | undefined,
  classesTo: string | null | undefined,
): Stage | null {
  const top = classNumber(classesTo) ?? classNumber(classesFrom);
  if (top === null || top === 0) return null;
  if (top <= 5) return 'PRIMARY';
  if (top <= 8) return 'UPPER_PRIMARY';
  return 'SECONDARY';
}

/**
 * Everything the register knows, in the order it should be trusted.
 *
 * The school's own declared class range beats a legacy category label, because a school saying
 * which grades it runs is a better source than a column that also holds ownership types.
 */
export function deriveStage(input: {
  category?: string | null;
  classesFrom?: string | null;
  classesTo?: string | null;
}): Stage | null {
  return stageFromClassRange(input.classesFrom, input.classesTo) ?? stageFromCategory(input.category);
}
