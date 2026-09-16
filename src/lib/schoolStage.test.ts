import { describe, expect, it } from 'vitest';
import {
  classNumber,
  deriveStage,
  stageCodeFor,
  stageFromCategory,
  stageFromClassRange,
  stageLabel,
} from './schoolStage';

describe('an ownership type is not a stage', () => {
  // The whole bug. School.category holds a level for hand-seeded schools and an ownership type
  // for the bulk register, and the old lookup treated a miss as primary without saying so.
  it.each(['GOVT', 'GOVT_AIDED', 'PRIVATE_AIDED', 'PRIVATE'])('reads no stage from %s', (value) => {
    expect(stageFromCategory(value)).toBeNull();
  });

  it('still reads the level where the column holds one', () => {
    expect(stageFromCategory('Primary')).toBe('PRIMARY');
    expect(stageFromCategory('Upper Primary')).toBe('UPPER_PRIMARY');
    expect(stageFromCategory('Secondary')).toBe('SECONDARY');
    expect(stageFromCategory('SECONDARY')).toBe('SECONDARY');
  });

  // Both sit in SQAAF's secondary stage rather than a fourth one.
  it('folds higher and senior secondary into secondary', () => {
    expect(stageFromCategory('Higher Secondary')).toBe('SECONDARY');
    expect(stageFromCategory('Senior Secondary')).toBe('SECONDARY');
  });
});

describe('the class range decides the stage', () => {
  // A school running 1 to 10 has to answer the secondary indicators, because it teaches those
  // grades. The lowest class says nothing about which paper applies.
  it('takes the highest class taught, not the lowest', () => {
    expect(stageFromClassRange('1', '10')).toBe('SECONDARY');
    expect(stageFromClassRange('1', '8')).toBe('UPPER_PRIMARY');
    expect(stageFromClassRange('1', '5')).toBe('PRIMARY');
  });

  it('reads roman numerals and pre-primary labels', () => {
    expect(classNumber('VIII')).toBe(8);
    expect(classNumber('XII')).toBe(12);
    expect(classNumber('Nursery')).toBe(0);
    expect(classNumber('LKG')).toBe(0);
    expect(stageFromClassRange('Nursery', 'V')).toBe('PRIMARY');
  });

  // A pre-primary-only school teaches no SQAAF stage, so it must not be guessed into one.
  it('reads no stage from a range that names no class', () => {
    expect(stageFromClassRange('Nursery', 'UKG')).toBeNull();
    expect(stageFromClassRange(null, null)).toBeNull();
    expect(stageFromClassRange('', '  ')).toBeNull();
  });

  it('ignores a class number outside 0 to 12 rather than trusting it', () => {
    expect(classNumber('99')).toBeNull();
  });
});

describe('what the register knows, in the order it should be trusted', () => {
  // The school's own declared range beats a column that also holds ownership types.
  it('prefers the class range over a legacy category label', () => {
    expect(deriveStage({ category: 'Primary', classesFrom: '1', classesTo: '10' })).toBe('SECONDARY');
  });

  it('falls back to the category where no range is recorded', () => {
    expect(deriveStage({ category: 'Upper Primary' })).toBe('UPPER_PRIMARY');
  });

  // The case that matters at volume: 32,357 bulk schools with an ownership category and no
  // class range. Null, not a guess.
  it('reads nothing at all from an ownership type with no range', () => {
    expect(deriveStage({ category: 'GOVT' })).toBeNull();
  });
});

describe('a missing stage is admitted, not papered over', () => {
  // The fallback is unchanged from the behaviour every call site had before, so this moves no
  // stored score. What changes is that it happens in one named place.
  it('still applies primary when nothing is recorded', () => {
    expect(stageCodeFor(null)).toBe('PRIMARY');
    expect(stageCodeFor('GOVT')).toBe('PRIMARY');
  });

  it('uses the recorded stage when there is one', () => {
    expect(stageCodeFor('SECONDARY')).toBe('SECONDARY');
  });

  // A screener told "Primary" about a school nobody has classified is worse off than one told
  // the truth, because they cannot tell they are reading the wrong paper.
  it('never labels an unclassified school as primary', () => {
    expect(stageLabel(null)).toBe('Stage not recorded');
    expect(stageLabel('GOVT')).toBe('Stage not recorded');
    expect(stageLabel('UPPER_PRIMARY')).toBe('Upper primary');
  });
});
