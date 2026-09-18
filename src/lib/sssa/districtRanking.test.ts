import { describe, expect, it } from 'vitest';
import {
  MIN_SCHOOLS_FOR_DISTRICT_RANK,
  rankDistricts,
  standingFrom,
  type DistrictTotals,
} from './districtRanking';

const noScore = () => null;
const noBand = () => null;

function d(name: string, schools: number, finished: number): DistrictTotals {
  return { code: name.slice(0, 3).toUpperCase(), name, schools, finished };
}

describe('the four counts', () => {
  it('adds up to the register', () => {
    const s = standingFrom({ totalSchools: 32_579, draft: 3_912, submitted: 26_563, verified: 24_716 });
    expect(s.notStarted + s.draft + s.awaitingVerification + s.verified).toBe(32_579);
  });

  it('counts everything sent as finished, checked or not', () => {
    const s = standingFrom({ totalSchools: 100, draft: 10, submitted: 80, verified: 60 });
    expect(s.finishedSelfAssessment).toBe(80);
    expect(s.awaitingVerification).toBe(20);
    expect(s.notStarted).toBe(10);
  });

  // A school that never submitted can still reach a verified Result through a field visit, so
  // verified can exceed submitted. Without the clamp the page prints a negative count, which
  // reads as a rendering bug and hides the real one.
  it('does not go negative when more are verified than were submitted', () => {
    const s = standingFrom({ totalSchools: 100, draft: 0, submitted: 40, verified: 45 });
    expect(s.awaitingVerification).toBe(0);
    expect(s.verified).toBe(45);
  });

  it('does not go negative when draft and submitted exceed the register', () => {
    const s = standingFrom({ totalSchools: 50, draft: 30, submitted: 40, verified: 10 });
    expect(s.notStarted).toBe(0);
  });

  // The register this runs on holds 32,440 schools whose results were backfilled out of
  // responses, with no submission row of their own. Deriving notStarted from draft and submitted
  // alone counted every one of them twice, once as verified and once as never having begun, and
  // the four counts came to twice the register.
  it('counts a verified school once when it has no submission row', () => {
    const s = standingFrom({ totalSchools: 32_579, draft: 0, submitted: 0, verified: 32_440 });
    expect(s.verified).toBe(32_440);
    expect(s.notStarted).toBe(139);
    expect(s.notStarted + s.draft + s.awaitingVerification + s.verified).toBe(32_579);
  });

  // A school cannot be verified without having been assessed, so it has finished whatever the
  // submission table says. Reading that table alone made the banner report nought finished
  // beside a card reporting 32,440 verified.
  it('treats a verified school as having finished its self assessment', () => {
    const s = standingFrom({ totalSchools: 32_579, draft: 0, submitted: 0, verified: 32_440 });
    expect(s.finishedSelfAssessment).toBe(32_440);
  });

  it('reads as nothing started on an empty cycle', () => {
    const s = standingFrom({ totalSchools: 32_579, draft: 0, submitted: 0, verified: 0 });
    expect(s.notStarted).toBe(32_579);
    expect(s.finishedSelfAssessment).toBe(0);
  });
});

describe('the district ranking', () => {
  it('orders on the share finished, not on the number finished', () => {
    const rows = rankDistricts(
      [d('Varanasi', 438, 431), d('Kanpur Nagar', 627, 592), d('Gorakhpur', 206, 201)],
      noScore,
      noBand,
    );
    expect(rows.map((r) => r.name)).toEqual(['Varanasi', 'Gorakhpur', 'Kanpur Nagar']);
  });

  it('reports the share to one decimal', () => {
    const [row] = rankDistricts([d('Varanasi', 438, 431)], noScore, noBand);
    expect(row.finishedPct).toBe(98.4);
  });

  // The rule that keeps a two school district off the top of the state.
  it('leaves out a district too small to rank', () => {
    const rows = rankDistricts(
      [d('Tiny', MIN_SCHOOLS_FOR_DISTRICT_RANK - 1, 4), d('Lucknow', 562, 544)],
      noScore,
      noBand,
    );
    expect(rows.map((r) => r.name)).toEqual(['Lucknow']);
  });

  it('keeps a district exactly on the minimum', () => {
    const rows = rankDistricts([d('Just', MIN_SCHOOLS_FOR_DISTRICT_RANK, 5)], noScore, noBand);
    expect(rows).toHaveLength(1);
  });

  // Finishing 431 of 438 is a bigger piece of work than finishing 20 of 20, and a ranking that
  // put the small one first would send the Authority to the wrong place.
  it('breaks a tie by putting the larger district first', () => {
    const rows = rankDistricts([d('Small', 20, 20), d('Large', 438, 438)], noScore, noBand);
    expect(rows.map((r) => r.name)).toEqual(['Large', 'Small']);
  });

  it('breaks a remaining tie by name, so the order is stable between requests', () => {
    const rows = rankDistricts([d('Zebra', 100, 90), d('Alpha', 100, 90)], noScore, noBand);
    expect(rows.map((r) => r.name)).toEqual(['Alpha', 'Zebra']);
  });

  it('carries the score and band where a district has verified schools', () => {
    const rows = rankDistricts(
      [d('Gorakhpur', 206, 201)],
      () => 76.7,
      (s) => (s >= 80 ? 'Utkarsh' : s >= 55 ? 'Unnat' : 'Uday'),
    );
    expect(rows[0].averageScore).toBe(76.7);
    expect(rows[0].band).toBe('Unnat');
  });

  // A district can have finished its self assessments and have nothing verified yet, which is
  // the normal state mid cycle. It still belongs in the ranking, with no score.
  it('ranks a district with nothing verified, and gives it no band', () => {
    const rows = rankDistricts([d('Shrawasti', 189, 106)], noScore, noBand);
    expect(rows[0].finishedPct).toBe(56.1);
    expect(rows[0].averageScore).toBeNull();
    expect(rows[0].band).toBeNull();
  });

  it('returns nothing when no district is big enough', () => {
    expect(rankDistricts([d('Tiny', 2, 2)], noScore, noBand)).toEqual([]);
  });
});
