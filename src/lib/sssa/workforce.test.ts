import { describe, expect, it } from 'vitest';
import {
  coversDistrict,
  filterWorkforce,
  sortWorkforce,
  statusOf,
  EMPTY_FILTERS,
  type WorkforceRow,
} from './workforce';

function row(over: Partial<WorkforceRow> = {}): WorkforceRow {
  return {
    profileId: 'p1',
    name: 'Pushpa Devi',
    username: 'field2',
    cell: 'FIELD',
    workforceSource: 'EMPANELLED',
    certification: 'CERTIFIED',
    deEmpanelledAt: null,
    openCount: 10,
    completedCount: 100,
    avgTurnaroundDays: 5,
    qualityFlags: 0,
    districts: [],
    removalRecommended: false,
    ...over,
  };
}

describe('statusOf', () => {
  it('puts removal ahead of certification', () => {
    // A de-empanelled verifier is still certified on paper. The removal is the fact that matters.
    expect(statusOf({ certification: 'CERTIFIED', deEmpanelledAt: '2026-09-02T00:00:00Z' })).toBe(
      'DE_EMPANELLED',
    );
  });

  it('separates certified from everything else', () => {
    expect(statusOf({ certification: 'CERTIFIED', deEmpanelledAt: null })).toBe('CERTIFIED');
    expect(statusOf({ certification: 'NOT_STARTED', deEmpanelledAt: null })).toBe('NOT_CERTIFIED');
    expect(statusOf({ certification: 'IN_PROGRESS', deEmpanelledAt: null })).toBe('NOT_CERTIFIED');
  });
});

describe('coversDistrict', () => {
  it('treats an empty roster as statewide', () => {
    expect(coversDistrict([], 'Sonbhadra')).toBe(true);
  });

  it('matches a rostered district', () => {
    expect(coversDistrict(['Gorakhpur', 'Deoria'], 'Deoria')).toBe(true);
  });

  it('excludes a district nobody rostered them to', () => {
    expect(coversDistrict(['Gorakhpur', 'Deoria'], 'Sonbhadra')).toBe(false);
  });
});

describe('filterWorkforce', () => {
  const rows = [
    row({ profileId: 'a', name: 'Pushpa Devi', username: 'field2', cell: 'FIELD', districts: [] }),
    row({
      profileId: 'b',
      name: 'Aarti Mishra',
      username: 'online1',
      cell: 'ONLINE',
      districts: ['Lucknow', 'Unnao'],
    }),
    row({
      profileId: 'c',
      name: 'Sunita Rawat',
      username: 'field9',
      cell: 'FIELD',
      districts: ['Azamgarh'],
      deEmpanelledAt: '2026-09-02T00:00:00Z',
    }),
    row({
      profileId: 'd',
      name: 'Imran Siddiqui',
      username: 'online7',
      cell: 'ONLINE',
      certification: 'NOT_STARTED',
      districts: ['Varanasi'],
    }),
  ];

  it('returns everything when nothing is set', () => {
    expect(filterWorkforce(rows, EMPTY_FILTERS)).toHaveLength(4);
  });

  it('searches the name and the username', () => {
    expect(filterWorkforce(rows, { ...EMPTY_FILTERS, q: 'pushpa' }).map((r) => r.profileId)).toEqual(['a']);
    expect(filterWorkforce(rows, { ...EMPTY_FILTERS, q: 'online1' }).map((r) => r.profileId)).toEqual(['b']);
  });

  it('ignores case and surrounding spaces in the search', () => {
    expect(filterWorkforce(rows, { ...EMPTY_FILTERS, q: '  AARTI ' }).map((r) => r.profileId)).toEqual(['b']);
  });

  it('filters by cell', () => {
    expect(filterWorkforce(rows, { ...EMPTY_FILTERS, cell: 'FIELD' }).map((r) => r.profileId)).toEqual([
      'a',
      'c',
    ]);
  });

  it('filters by status, with removal beating certification', () => {
    expect(filterWorkforce(rows, { ...EMPTY_FILTERS, status: 'DE_EMPANELLED' }).map((r) => r.profileId)).toEqual(['c']);
    expect(filterWorkforce(rows, { ...EMPTY_FILTERS, status: 'NOT_CERTIFIED' }).map((r) => r.profileId)).toEqual(['d']);
    expect(filterWorkforce(rows, { ...EMPTY_FILTERS, status: 'CERTIFIED' }).map((r) => r.profileId)).toEqual([
      'a',
      'b',
    ]);
  });

  it('keeps statewide verifiers in a district filter', () => {
    // The question the filter answers is who can work there, not who is listed there. A district
    // with nobody rostered would otherwise come back empty while statewide staff could cover it.
    const picked = filterWorkforce(rows, { ...EMPTY_FILTERS, district: 'Lucknow' }).map((r) => r.profileId);
    expect(picked).toContain('a');
    expect(picked).toContain('b');
    expect(picked).not.toContain('c');
  });

  it('combines filters', () => {
    const picked = filterWorkforce(rows, {
      ...EMPTY_FILTERS,
      cell: 'ONLINE',
      status: 'CERTIFIED',
    }).map((r) => r.profileId);
    expect(picked).toEqual(['b']);
  });
});

describe('sortWorkforce', () => {
  it('sinks removed and uncertified verifiers, then orders by open caseload', () => {
    const sorted = sortWorkforce([
      row({ profileId: 'removed', deEmpanelledAt: '2026-09-02T00:00:00Z', openCount: 500 }),
      row({ profileId: 'light', openCount: 3 }),
      row({ profileId: 'pending', certification: 'NOT_STARTED', openCount: 400 }),
      row({ profileId: 'heavy', openCount: 90 }),
    ]);
    expect(sorted.map((r) => r.profileId)).toEqual(['heavy', 'light', 'pending', 'removed']);
  });

  it('does not mutate the input', () => {
    const input = [row({ profileId: 'a', openCount: 1 }), row({ profileId: 'b', openCount: 9 })];
    sortWorkforce(input);
    expect(input.map((r) => r.profileId)).toEqual(['a', 'b']);
  });
});
