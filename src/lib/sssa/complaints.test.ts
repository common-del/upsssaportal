import { describe, expect, it } from 'vitest';
import {
  EMPTY_COMPLAINT_FILTERS,
  INDUCEMENT_TYPE,
  filterComplaints,
  sortComplaints,
  type ComplaintRow,
} from './complaints';

function ticket(over: Partial<ComplaintRow> = {}): ComplaintRow {
  return {
    id: 't1',
    href: '/app/sssa/disputes/t1',
    source: 'PUBLIC',
    raisedBy: 'Parent',
    about: 'Janta Inter College',
    district: 'Varanasi',
    type: 'Fee charged beyond the notified rate',
    ageDays: 10,
    level: 'SCHOOL',
    overdueDays: null,
    acknowledged: null,
    ...over,
  };
}

function report(over: Partial<ComplaintRow> = {}): ComplaintRow {
  return {
    id: 'r1',
    href: '/app/sssa/disputes/integrity/r1',
    source: 'VERIFIER',
    raisedBy: 'Pushpa Devi',
    about: 'Santosh Kumar Yadav',
    district: 'Varanasi',
    type: INDUCEMENT_TYPE,
    ageDays: 5,
    level: null,
    overdueDays: null,
    acknowledged: true,
    ...over,
  };
}

describe('filterComplaints', () => {
  const rows = [
    ticket({ id: 'a', about: 'Janta Inter College', district: 'Varanasi' }),
    ticket({ id: 'b', about: 'Allahabad Public School', district: 'Prayagraj', type: 'Teacher absence', raisedBy: 'Local resident' }),
    report({ id: 'c', about: 'Santosh Kumar Yadav', district: 'Varanasi' }),
    report({ id: 'd', about: 'Nobody named', district: '—', raisedBy: 'Neelam Verma' }),
  ];

  it('returns everything when nothing is set', () => {
    expect(filterComplaints(rows, EMPTY_COMPLAINT_FILTERS)).toHaveLength(4);
  });

  it('searches the subject, the person who raised it and the type', () => {
    expect(filterComplaints(rows, { ...EMPTY_COMPLAINT_FILTERS, q: 'janta' }).map((r) => r.id)).toEqual(['a']);
    expect(filterComplaints(rows, { ...EMPTY_COMPLAINT_FILTERS, q: 'neelam' }).map((r) => r.id)).toEqual(['d']);
    expect(filterComplaints(rows, { ...EMPTY_COMPLAINT_FILTERS, q: 'teacher' }).map((r) => r.id)).toEqual(['b']);
  });

  it('ignores case and surrounding spaces in the search', () => {
    expect(filterComplaints(rows, { ...EMPTY_COMPLAINT_FILTERS, q: '  ALLAHABAD ' }).map((r) => r.id)).toEqual(['b']);
  });

  it('filters by district', () => {
    expect(filterComplaints(rows, { ...EMPTY_COMPLAINT_FILTERS, district: 'Varanasi' }).map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('filters by type across both kinds', () => {
    // Inducement is a complaint type like any other, which is what lets one table hold both.
    expect(filterComplaints(rows, { ...EMPTY_COMPLAINT_FILTERS, type: INDUCEMENT_TYPE }).map((r) => r.id)).toEqual(['c', 'd']);
  });

  it('filters by who raised it', () => {
    expect(filterComplaints(rows, { ...EMPTY_COMPLAINT_FILTERS, source: 'PUBLIC' }).map((r) => r.id)).toEqual(['a', 'b']);
    expect(filterComplaints(rows, { ...EMPTY_COMPLAINT_FILTERS, source: 'VERIFIER' }).map((r) => r.id)).toEqual(['c', 'd']);
  });

  it('combines filters', () => {
    const picked = filterComplaints(rows, {
      ...EMPTY_COMPLAINT_FILTERS,
      district: 'Varanasi',
      source: 'VERIFIER',
    }).map((r) => r.id);
    expect(picked).toEqual(['c']);
  });
});

describe('sortComplaints', () => {
  it('puts overdue complaints first, then unacknowledged reports, then the oldest', () => {
    const sorted = sortComplaints([
      ticket({ id: 'fresh', ageDays: 2 }),
      report({ id: 'waiting', acknowledged: false, ageDays: 1 }),
      ticket({ id: 'old', ageDays: 90 }),
      ticket({ id: 'overdue', overdueDays: 4, ageDays: 20 }),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(['overdue', 'waiting', 'old', 'fresh']);
  });

  it('orders two overdue complaints by how far past the deadline they are', () => {
    const sorted = sortComplaints([
      ticket({ id: 'slightly', overdueDays: 2, ageDays: 80 }),
      ticket({ id: 'badly', overdueDays: 19, ageDays: 40 }),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(['badly', 'slightly']);
  });

  it('ranks an acknowledged report with the ordinary rows, not above them', () => {
    const sorted = sortComplaints([
      ticket({ id: 'older-ticket', ageDays: 30 }),
      report({ id: 'seen', acknowledged: true, ageDays: 3 }),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(['older-ticket', 'seen']);
  });

  it('does not mutate the input', () => {
    const input = [ticket({ id: 'a', ageDays: 1 }), ticket({ id: 'b', overdueDays: 9 })];
    sortComplaints(input);
    expect(input.map((r) => r.id)).toEqual(['a', 'b']);
  });
});
