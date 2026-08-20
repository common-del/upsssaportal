import { describe, expect, it } from 'vitest';
import {
  assignmentFor,
  isExcluded,
  isRevealed,
  minutesUntilReveal,
  revealMomentFor,
} from './reveal';

const SCHOOL = {
  udise: '09460401101',
  nameEn: 'Aided Inter College, Bhiyawan',
  blockName: 'Bhiyawan',
  addressEn: 'Bhiyawan, Ambedkar Nagar',
};

/** 07:00 IST on 21 August 2026 is 01:30 UTC on the same day. */
const NOTIFIED = new Date('2026-08-21T00:00:00.000Z');
const REVEAL_AT = new Date('2026-08-21T01:30:00.000Z');

function visit(overrides: Partial<Parameters<typeof assignmentFor>[0]> = {}) {
  return {
    id: 'visit_1',
    districtCode: 'D005',
    districtName: 'Ambedkar Nagar',
    travelWindowStart: new Date('2026-08-19T00:00:00.000Z'),
    travelWindowEnd: new Date('2026-08-23T00:00:00.000Z'),
    notifiedDate: NOTIFIED,
    revealAt: REVEAL_AT,
    conflictDeclaredAt: null,
    recusedAt: null,
    ...overrides,
  };
}

describe('the sealed payload carries no school identity', () => {
  // The test the whole mechanism rests on. An unannounced inspection is worth nothing if the
  // verifier can read the school out of a network response the night before.
  it('contains no school field of any kind before the reveal moment', () => {
    const a = assignmentFor(visit(), SCHOOL, new Date('2026-08-20T18:00:00.000Z'));
    expect(a.state).toBe('SEALED');
    const serialised = JSON.stringify(a);
    expect(serialised).not.toContain(SCHOOL.udise);
    expect(serialised).not.toContain(SCHOOL.nameEn);
    expect(serialised).not.toContain(SCHOOL.blockName);
    expect(serialised).not.toContain('Ambedkar Nagar, ');
    for (const key of ['schoolUdise', 'schoolName', 'blockName', 'addressEn']) {
      expect(Object.keys(a)).not.toContain(key);
    }
  });

  // What the verifier legitimately needs in advance: where to be and when.
  it('still gives the district, the travel window and the countdown target', () => {
    const a = assignmentFor(visit(), SCHOOL, new Date('2026-08-20T18:00:00.000Z'));
    expect(a.districtName).toBe('Ambedkar Nagar');
    expect(a.travelWindowStart).toBe('2026-08-19T00:00:00.000Z');
    expect(a.revealAt).toBe(REVEAL_AT.toISOString());
  });

  it('stays sealed one minute before the moment', () => {
    const a = assignmentFor(visit(), SCHOOL, new Date('2026-08-21T01:29:00.000Z'));
    expect(a.state).toBe('SEALED');
  });

  // A blank name renders as an empty field and reads as a bug. Sealed is the honest shape.
  it('stays sealed when the clock has passed but no school was supplied', () => {
    const a = assignmentFor(visit(), null, new Date('2026-08-22T00:00:00.000Z'));
    expect(a.state).toBe('SEALED');
  });
});

describe('the reveal opens on time and not before', () => {
  it('reveals exactly at the moment, not a minute after', () => {
    const a = assignmentFor(visit(), SCHOOL, REVEAL_AT);
    expect(a.state).toBe('REVEALED');
    if (a.state === 'REVEALED') expect(a.schoolName).toBe(SCHOOL.nameEn);
  });

  it('reveals after the moment', () => {
    const a = assignmentFor(visit(), SCHOOL, new Date('2026-08-21T04:00:00.000Z'));
    expect(a.state).toBe('REVEALED');
  });

  it('is inclusive on the boundary', () => {
    expect(isRevealed(REVEAL_AT, REVEAL_AT)).toBe(true);
    expect(isRevealed(REVEAL_AT, new Date(REVEAL_AT.getTime() - 1))).toBe(false);
  });

  it('carries the conflict declaration state once revealed', () => {
    const declared = new Date('2026-08-21T02:00:00.000Z');
    const a = assignmentFor(
      visit({ conflictDeclaredAt: declared }),
      SCHOOL,
      new Date('2026-08-21T03:00:00.000Z'),
    );
    expect(a.state).toBe('REVEALED');
    if (a.state === 'REVEALED') expect(a.conflictDeclaredAt).toBe(declared.toISOString());
  });
});

describe('the reveal moment is computed in Indian time', () => {
  // The bug this exists to prevent. Treating the configured hour as UTC would unlock every
  // school at 12:30 IST, five and a half hours into the working day, or worse, the evening
  // before for a low hour.
  it('puts 07:00 IST at 01:30 UTC', () => {
    expect(revealMomentFor(NOTIFIED, 7).toISOString()).toBe('2026-08-21T01:30:00.000Z');
  });

  it('honours a different configured hour', () => {
    expect(revealMomentFor(NOTIFIED, 6).toISOString()).toBe('2026-08-21T00:30:00.000Z');
    expect(revealMomentFor(NOTIFIED, 9).toISOString()).toBe('2026-08-21T03:30:00.000Z');
  });

  // A notified date stored late in the UTC day is already the next day in IST. Taking the UTC
  // date parts would reveal a day early.
  it('does not slip a day for a date stored near midnight UTC', () => {
    const lateUtc = new Date('2026-08-20T20:00:00.000Z'); // 21 August, 01:30 IST
    expect(revealMomentFor(lateUtc, 7).toISOString()).toBe('2026-08-21T01:30:00.000Z');
  });

  it('counts down in whole minutes and never below zero', () => {
    expect(minutesUntilReveal(REVEAL_AT, new Date('2026-08-21T01:00:00.000Z'))).toBe(30);
    expect(minutesUntilReveal(REVEAL_AT, new Date('2026-08-21T02:00:00.000Z'))).toBe(0);
  });
});

describe('standing conflict of interest, checked at roster build', () => {
  const school = { udise: '09460401101', districtCode: 'D005', blockCode: 'B047' };

  it('excludes on the school itself', () => {
    expect(isExcluded([{ districtCode: null, blockCode: null, schoolUdise: '09460401101' }], school)).toBe(true);
  });

  // The ToR bars a verifier from a school or cluster in a district where they hold a position,
  // so block and district are exclusions in their own right, not just the specific school.
  it('excludes on the block and on the district', () => {
    expect(isExcluded([{ districtCode: null, blockCode: 'B047', schoolUdise: null }], school)).toBe(true);
    expect(isExcluded([{ districtCode: 'D005', blockCode: null, schoolUdise: null }], school)).toBe(true);
  });

  it('does not exclude on a different district, block or school', () => {
    expect(isExcluded([{ districtCode: 'D001', blockCode: null, schoolUdise: null }], school)).toBe(false);
    expect(isExcluded([{ districtCode: null, blockCode: 'B001', schoolUdise: null }], school)).toBe(false);
    expect(isExcluded([{ districtCode: null, blockCode: null, schoolUdise: '09999999999' }], school)).toBe(false);
  });

  it('allows a verifier with no exclusions', () => {
    expect(isExcluded([], school)).toBe(false);
  });
});
