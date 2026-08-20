import { describe, expect, it } from 'vitest';
import { nextLevelIndex } from './improvementPlan';

// The real framework has three levels per indicator, so three is the case that matters.
// The others are here because the level count is framework data and could change.
describe('nextLevelIndex', () => {
  it('offers the next level up from the bottom', () => {
    expect(nextLevelIndex(3, 0)).toBe(1);
  });

  it('offers one step, never a leap to the top', () => {
    expect(nextLevelIndex(3, 0)).not.toBe(2);
  });

  it('offers the top level to a school one below it', () => {
    expect(nextLevelIndex(3, 1)).toBe(2);
  });

  // The off-by-one that would otherwise appear on every compliant school's plan: an action
  // pointing at a level the framework does not define.
  it('offers nothing to a school already at the top', () => {
    expect(nextLevelIndex(3, 2)).toBeNull();
  });

  it('offers nothing when the selected option is not in the list', () => {
    expect(nextLevelIndex(3, -1)).toBeNull();
    expect(nextLevelIndex(3, 3)).toBeNull();
    expect(nextLevelIndex(3, 99)).toBeNull();
  });

  it('offers nothing for a single-level indicator', () => {
    expect(nextLevelIndex(1, 0)).toBeNull();
  });

  it('holds for level counts other than three', () => {
    expect(nextLevelIndex(4, 0)).toBe(1);
    expect(nextLevelIndex(4, 2)).toBe(3);
    expect(nextLevelIndex(4, 3)).toBeNull();
  });
});
