import { describe, expect, it } from 'vitest';
import type { CycleState } from '@prisma/client';
import {
  ALLOWED_TRANSITIONS,
  canTransition,
  isTerminal,
  reachableStates,
} from './stateMachine';

const ALL_STATES = Object.keys(ALLOWED_TRANSITIONS) as CycleState[];

describe('cycle state machine shape', () => {
  it('covers all thirteen states', () => {
    expect(ALL_STATES).toHaveLength(13);
  });

  // A state nothing can reach is a state a school can never be in, which means a branch of
  // the flow that was specified and then never wired up.
  it('leaves no state unreachable from the start', () => {
    const reachable = reachableStates();
    const stranded = ALL_STATES.filter((s) => !reachable.has(s));
    expect(stranded, `unreachable: ${stranded.join(', ')}`).toEqual([]);
  });

  // The mirror of the above: a state with no exit that is not meant to be an ending traps
  // every school that enters it, with no way out but a manual database edit.
  it('has exactly one terminal state, PUBLISHED', () => {
    expect(ALL_STATES.filter(isTerminal)).toEqual(['PUBLISHED']);
  });

  it('can reach PUBLISHED from every non-terminal state', () => {
    for (const start of ALL_STATES) {
      const seen = new Set<CycleState>([start]);
      const queue: CycleState[] = [start];
      let found = start === 'PUBLISHED';
      while (queue.length > 0 && !found) {
        const s = queue.shift()!;
        for (const next of ALLOWED_TRANSITIONS[s]) {
          if (next === 'PUBLISHED') { found = true; break; }
          if (!seen.has(next)) { seen.add(next); queue.push(next); }
        }
      }
      expect(found, `${start} cannot reach PUBLISHED`).toBe(true);
    }
  });

  it('names only real states as destinations', () => {
    for (const [from, tos] of Object.entries(ALLOWED_TRANSITIONS)) {
      for (const to of tos) {
        expect(ALL_STATES, `${from} points at ${to}`).toContain(to);
      }
    }
  });
});

describe('the transitions the brief specifies', () => {
  it('lets a school submit, on time or during the extension', () => {
    expect(canTransition('SELF_ASSESSMENT_OPEN', 'SUBMITTED')).toBe(true);
    expect(canTransition('NOT_SUBMITTED', 'SUBMITTED')).toBe(true);
  });

  it('sends a non-submitter to the field cohort and nowhere else', () => {
    expect(ALLOWED_TRANSITIONS.NON_SUBMITTER).toEqual(['FIELD_COHORT']);
  });

  // A school that never submitted has nothing to cross-match and no evidence to screen, so
  // routing it through those stages would put empty cases in the desk queue.
  it('does not route a non-submitter through auto check or desk screening', () => {
    expect(canTransition('NON_SUBMITTER', 'AUTO_CHECK')).toBe(false);
    expect(canTransition('NON_SUBMITTER', 'DESK_SCREENING')).toBe(false);
  });

  it('branches on risk after desk screening', () => {
    expect(canTransition('DESK_SCREENING', 'VIDEO_WALKTHROUGH')).toBe(true);
    expect(canTransition('DESK_SCREENING', 'CENSUS_QUEUE')).toBe(true);
  });

  it('resolves a walkthrough to the queue and fails one to the cohort', () => {
    expect(canTransition('VIDEO_WALKTHROUGH', 'CENSUS_QUEUE')).toBe(true);
    expect(canTransition('VIDEO_WALKTHROUGH', 'FIELD_COHORT')).toBe(true);
  });

  // The exit that is easy to leave out. Only a third of schools get a visit, so a school in
  // the queue that is not drawn has to be publishable on the desk check alone.
  it('publishes a school that passed screening without a field visit', () => {
    expect(canTransition('CENSUS_QUEUE', 'PUBLISHED')).toBe(true);
  });

  it('publishes a clean field visit and reviews a dirty one', () => {
    expect(canTransition('FIELD_VISIT', 'PUBLISHED')).toBe(true);
    expect(canTransition('FIELD_VISIT', 'DISCREPANCY_REVIEW')).toBe(true);
  });

  // The response window is an addition to the source documents and sits behind a flag, so
  // the flow has to be complete with it switched off.
  it('works with the school response window disabled', () => {
    expect(canTransition('DISCREPANCY_REVIEW', 'PUBLISHED')).toBe(true);
  });

  it('lets a supervisor refer a case back for another visit', () => {
    expect(canTransition('SCHOOL_RESPONSE_WINDOW', 'FIELD_COHORT')).toBe(true);
  });
});

describe('the transitions that must stay illegal', () => {
  // The one that matters most. Every path to PUBLISHED has to pass through something that
  // actually verified the school.
  it('never publishes straight from an unverified state', () => {
    for (const from of ['SELF_ASSESSMENT_OPEN', 'NOT_SUBMITTED', 'NON_SUBMITTER', 'SUBMITTED', 'AUTO_CHECK'] as CycleState[]) {
      expect(canTransition(from, 'PUBLISHED'), `${from} must not publish directly`).toBe(false);
    }
  });

  it('never moves out of PUBLISHED', () => {
    for (const to of ALL_STATES) {
      if (to === 'PUBLISHED') continue;
      expect(canTransition('PUBLISHED', to), `PUBLISHED must not move to ${to}`).toBe(false);
    }
  });

  it('does not skip desk screening after the auto check', () => {
    expect(canTransition('AUTO_CHECK', 'CENSUS_QUEUE')).toBe(false);
    expect(canTransition('AUTO_CHECK', 'VIDEO_WALKTHROUGH')).toBe(false);
    expect(canTransition('AUTO_CHECK', 'FIELD_COHORT')).toBe(false);
  });

  it('does not visit a school that was never put in a cohort', () => {
    expect(canTransition('CENSUS_QUEUE', 'FIELD_VISIT')).toBe(false);
    expect(canTransition('DESK_SCREENING', 'FIELD_VISIT')).toBe(false);
  });

  it('does not reopen a submission', () => {
    expect(canTransition('SUBMITTED', 'SELF_ASSESSMENT_OPEN')).toBe(false);
    expect(canTransition('SUBMITTED', 'NOT_SUBMITTED')).toBe(false);
  });

  // Sweeps run repeatedly and must not fail on a run they have already moved.
  it('treats a move to the current state as allowed', () => {
    for (const s of ALL_STATES) expect(canTransition(s, s)).toBe(true);
  });
});
