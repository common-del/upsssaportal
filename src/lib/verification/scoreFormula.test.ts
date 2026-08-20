import { describe, expect, it } from 'vitest';
import {
  applyCorrections,
  domainWeightedPercent,
  gradeBandFor,
  type ScorableParameter,
} from './scoreFormula';

const rubric = new Map<string, number>();
const param = (id: string, domainId: string): ScorableParameter => {
  for (const [key, points] of [
    ['LEVEL_1', 0],
    ['LEVEL_2', 1],
    ['LEVEL_3', 2],
  ] as const) {
    rubric.set(`${id}:${key}`, points);
  }
  return { id, domainId, optionKeys: ['LEVEL_1', 'LEVEL_2', 'LEVEL_3'] };
};

const P = [param('p1', 'd1'), param('p2', 'd1'), param('p3', 'd2')];
const WEIGHTS = new Map([
  ['d1', 60],
  ['d2', 40],
]);

describe('the domain-weighted formula', () => {
  it('weights domains by their configured share', () => {
    // d1: 3 of 4 points = 75%. d2: 2 of 2 = 100%. 0.75*60 + 1.0*40 over 100 = 85%.
    const responses = new Map([
      ['p1', 'LEVEL_3'],
      ['p2', 'LEVEL_2'],
      ['p3', 'LEVEL_3'],
    ]);
    expect(domainWeightedPercent(P, rubric, WEIGHTS, responses)).toBe(85);
  });

  it('scores an unanswered indicator as zero achieved, not as absent', () => {
    const responses = new Map([['p3', 'LEVEL_3']]);
    // d1 achieves 0 of 4 but still weighs 60: a school that skipped a domain claimed
    // nothing there, which is not the same as the domain not applying.
    expect(domainWeightedPercent(P, rubric, WEIGHTS, responses)).toBe(40);
  });

  // "Not measured" and "scored nothing" are different facts: a domain with no applicable
  // indicators drops out of the weighting instead of dragging the average down.
  it('drops a domain with no applicable indicators from the weighting', () => {
    const onlyD1 = P.filter((p) => p.domainId === 'd1');
    const responses = new Map([
      ['p1', 'LEVEL_3'],
      ['p2', 'LEVEL_3'],
    ]);
    expect(domainWeightedPercent(onlyD1, rubric, WEIGHTS, responses)).toBe(100);
  });

  it('returns null when nothing is scorable at all', () => {
    expect(domainWeightedPercent([], rubric, WEIGHTS, new Map())).toBeNull();
  });

  it('rounds to one decimal', () => {
    // d1 only: 1 of 4 points = 25%; d2: 1 of 2 = 50%. 0.25*60+0.5*40 = 35.
    const responses = new Map([
      ['p1', 'LEVEL_2'],
      ['p3', 'LEVEL_2'],
    ]);
    expect(domainWeightedPercent(P, rubric, WEIGHTS, responses)).toBe(35);
  });
});

describe('grade bands', () => {
  const bands = [
    { key: 'UDAY', minPercent: 0, maxPercent: 55 },
    { key: 'UNNAT', minPercent: 55, maxPercent: 80 },
    { key: 'UTKARSH', minPercent: 80, maxPercent: 100 },
  ];

  it('places a boundary score in the band that starts there', () => {
    expect(gradeBandFor(55, bands)).toBe('UNNAT');
    expect(gradeBandFor(80, bands)).toBe('UTKARSH');
  });

  it('keeps 100 inside the top band', () => {
    expect(gradeBandFor(100, bands)).toBe('UTKARSH');
  });

  it('returns null for a null score', () => {
    expect(gradeBandFor(null, bands)).toBeNull();
  });
});

describe('applying upheld corrections', () => {
  const orderToKey = new Map([
    ['p1:1', 'LEVEL_1'],
    ['p1:2', 'LEVEL_2'],
    ['p1:3', 'LEVEL_3'],
    ['p2:1', 'LEVEL_1'],
  ]);

  it('replaces the claim with the ruled level', () => {
    const claims = new Map([
      ['p1', 'LEVEL_3'],
      ['p2', 'LEVEL_1'],
    ]);
    const { responses, unmapped } = applyCorrections(claims, [{ parameterId: 'p1', level: 1 }], orderToKey);
    expect(responses.get('p1')).toBe('LEVEL_1');
    expect(responses.get('p2')).toBe('LEVEL_1');
    expect(unmapped).toEqual([]);
  });

  it('does not touch the original claim map', () => {
    const claims = new Map([['p1', 'LEVEL_3']]);
    applyCorrections(claims, [{ parameterId: 'p1', level: 1 }], orderToKey);
    expect(claims.get('p1')).toBe('LEVEL_3');
  });

  // A ruling that cannot be mapped must be reported, not guessed at or dropped silently:
  // the caller decides whether to refuse publication or publish with a logged gap.
  it('reports a correction whose level has no option', () => {
    const claims = new Map([['p2', 'LEVEL_1']]);
    const { responses, unmapped } = applyCorrections(claims, [{ parameterId: 'p2', level: 9 }], orderToKey);
    expect(unmapped).toEqual(['p2']);
    expect(responses.get('p2')).toBe('LEVEL_1');
  });

  it('can set a level on an indicator the school never answered', () => {
    // A non-submitter's field findings arrive as corrections against an empty claim map.
    const { responses } = applyCorrections(new Map(), [{ parameterId: 'p1', level: 2 }], orderToKey);
    expect(responses.get('p1')).toBe('LEVEL_2');
  });
});
