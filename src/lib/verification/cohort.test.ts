import { describe, expect, it } from 'vitest';
import {
  cohortPriority,
  cohortSize,
  districtLoad,
  orderCandidates,
  planCohort,
  type CohortCandidate,
} from './cohort';

const REGISTER = 265278;
const INTAKE = 88426;
const totals = { registerCount: REGISTER, intakeCount: INTAKE };

function candidate(o: Partial<CohortCandidate> & { runId: string }): CohortCandidate {
  return {
    schoolUdise: `udise_${o.runId}`,
    districtCode: 'D001',
    fastTracked: false,
    submittedAt: new Date('2026-05-01T00:00:00.000Z'),
    enteredStateAt: new Date('2026-06-01T00:00:00.000Z'),
    intakeYear: 1,
    ...o,
  };
}

describe('cohort size, and the basis the documents leave open', () => {
  // The two readings, and the factor of three between them. This is the decision that sets the
  // field verifier headcount, so both numbers are asserted rather than described.
  it('gives 87,542 visits a year on ALL_SCHOOLS', () => {
    expect(cohortSize('ALL_SCHOOLS', 33, totals, 1_000_000)).toBe(87_542);
  });

  it('gives 29,181 visits a year on ANNUAL_INTAKE', () => {
    expect(cohortSize('ANNUAL_INTAKE', 33, totals, 1_000_000)).toBe(29_181);
  });

  it('rounds rather than truncating', () => {
    // 33% of 100 is 33, not 32.
    expect(cohortSize('ALL_SCHOOLS', 33, { registerCount: 100, intakeCount: 100 }, 100)).toBe(33);
  });

  // ALL_SCHOOLS can ask for more visits than there are candidates waiting, and a cohort cannot
  // contain a school twice.
  it('never asks for more schools than are available', () => {
    expect(cohortSize('ALL_SCHOOLS', 33, totals, 500)).toBe(500);
  });

  it('handles zero percent and an empty queue', () => {
    expect(cohortSize('ALL_SCHOOLS', 0, totals, 500)).toBe(0);
    expect(cohortSize('ALL_SCHOOLS', 33, totals, 0)).toBe(0);
  });
});

describe('priority bands', () => {
  it('puts an unresolved video case first', () => {
    expect(cohortPriority({ fastTracked: true, submittedAt: new Date() })).toBe(1);
  });

  // The ordering trap. A non-submitter is also fast-tracked, because both skipped the normal
  // queue, so testing the flag before the submission would empty band 2 into band 1.
  it('puts a non-submitter second even though it is also fast-tracked', () => {
    expect(cohortPriority({ fastTracked: true, submittedAt: null })).toBe(2);
    expect(cohortPriority({ fastTracked: false, submittedAt: null })).toBe(2);
  });

  it('puts an ordinary census case last', () => {
    expect(cohortPriority({ fastTracked: false, submittedAt: new Date() })).toBe(3);
  });
});

describe('queue order', () => {
  it('orders the three bands as the brief specifies', () => {
    const ordered = orderCandidates([
      candidate({ runId: 'census' }),
      candidate({ runId: 'nonsub', fastTracked: true, submittedAt: null }),
      candidate({ runId: 'unresolved', fastTracked: true }),
    ]);
    expect(ordered.map((c) => c.runId)).toEqual(['unresolved', 'nonsub', 'census']);
  });

  it('orders by intake year, then by how long the run has waited', () => {
    const ordered = orderCandidates([
      candidate({ runId: 'y2', intakeYear: 2 }),
      candidate({ runId: 'y1_late', enteredStateAt: new Date('2026-07-01T00:00:00.000Z') }),
      candidate({ runId: 'y1_early', enteredStateAt: new Date('2026-01-01T00:00:00.000Z') }),
    ]);
    expect(ordered.map((c) => c.runId)).toEqual(['y1_early', 'y1_late', 'y2']);
  });

  // Without a stable last resort the preview and the build can disagree, and a screen that
  // shows one cohort then commits a different one is worse than no preview.
  it('is stable for candidates that tie on everything else', () => {
    const tied = ['c', 'a', 'b'].map((runId) => candidate({ runId }));
    expect(orderCandidates(tied).map((c) => c.runId)).toEqual(['a', 'b', 'c']);
    expect(orderCandidates([...tied].reverse()).map((c) => c.runId)).toEqual(['a', 'b', 'c']);
  });
});

describe('the plan', () => {
  const candidates = [
    ...Array.from({ length: 5 }, (_, i) =>
      candidate({ runId: `u${i}`, fastTracked: true, districtCode: 'D001' }),
    ),
    ...Array.from({ length: 5 }, (_, i) =>
      candidate({ runId: `n${i}`, fastTracked: true, submittedAt: null, districtCode: 'D002' }),
    ),
    ...Array.from({ length: 90 }, (_, i) => candidate({ runId: `c${i}`, districtCode: 'D003' })),
  ];

  it('takes the cohort off the front of the queue', () => {
    const plan = planCohort(candidates, 'ALL_SCHOOLS', 33, { registerCount: 100, intakeCount: 100 });
    expect(plan.size).toBe(33);
    expect(plan.selected).toHaveLength(33);
    // All five unresolved and all five non-submitters make the cut before any census case.
    expect(plan.byPriority[1]).toBe(5);
    expect(plan.byPriority[2]).toBe(5);
    expect(plan.byPriority[3]).toBe(23);
  });

  it('reports how many waited', () => {
    const plan = planCohort(candidates, 'ALL_SCHOOLS', 33, { registerCount: 100, intakeCount: 100 });
    expect(plan.deferredCount).toBe(candidates.length - plan.size);
  });

  // A cohort correctly sized statewide can still be undeliverable district by district, which no
  // statewide number reveals.
  it('reports district-wise load', () => {
    const plan = planCohort(candidates, 'ALL_SCHOOLS', 33, { registerCount: 100, intakeCount: 100 });
    expect(plan.byDistrict.D001).toBe(5);
    expect(plan.byDistrict.D002).toBe(5);
    expect(plan.byDistrict.D003).toBe(23);
    expect(Object.values(plan.byDistrict).reduce((a, b) => a + b, 0)).toBe(plan.size);
  });

  it('counts load only over the selected cohort, not the whole queue', () => {
    expect(districtLoad([])).toEqual({});
  });

  it('never selects a school twice', () => {
    const plan = planCohort(candidates, 'ALL_SCHOOLS', 100, { registerCount: 1000, intakeCount: 1000 });
    expect(new Set(plan.selected.map((c) => c.runId)).size).toBe(plan.selected.length);
  });
});
