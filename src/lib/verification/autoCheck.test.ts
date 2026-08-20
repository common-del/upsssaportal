import { describe, expect, it } from 'vitest';
import { decideOutcome } from './autoCheck';
import type { ExternalReading } from './adapters';
import { INDICATOR_SOURCES, mappingFor, mappingSummary } from './indicatorSources';

const READ_AT = new Date('2026-08-20T06:00:00.000Z');

const available = (rawValue: string, impliedLevel: number | null): ExternalReading => ({
  available: true,
  rawValue,
  impliedLevel,
  readAt: READ_AT,
});

const missing = (reason = 'No value held.'): ExternalReading => ({
  available: false,
  reason,
});

describe('decideOutcome', () => {
  // The invariant this whole file exists for. If this test ever goes red, schools are being
  // recorded as confirmed on indicators no government system can see.
  it('never returns MATCH when the source held no value', () => {
    for (const claimed of [null, 1, 2, 3]) {
      expect(decideOutcome(missing(), claimed).outcome).toBe('NOT_CHECKABLE');
    }
  });

  it('stores no external value or read time for a missing reading', () => {
    const r = decideOutcome(missing(), 3);
    expect(r.externalValue).toBeNull();
    expect(r.sourceReadAt).toBeNull();
  });

  it('matches when the implied level equals the claim', () => {
    const r = decideOutcome(available('Yes', 3), 3);
    expect(r.outcome).toBe('MATCH');
    expect(r.externalValue).toBe('Yes');
    expect(r.sourceReadAt).toEqual(READ_AT);
  });

  it('mismatches when the implied level differs from the claim', () => {
    expect(decideOutcome(available('No', 1), 3).outcome).toBe('MISMATCH');
    expect(decideOutcome(available('Yes', 3), 1).outcome).toBe('MISMATCH');
  });

  // A raw count with no agreed threshold rule must not become a mismatch. Inventing a norm
  // would produce confident findings against schools on a rule nobody approved.
  it('does not judge a value it cannot convert to a level', () => {
    const r = decideOutcome(available('42', null), 3);
    expect(r.outcome).toBe('NOT_CHECKABLE');
    // The value is still kept, so a verifier can weigh it by hand.
    expect(r.externalValue).toBe('42');
    expect(r.sourceReadAt).toEqual(READ_AT);
  });

  it('does not judge when the school answered nothing', () => {
    expect(decideOutcome(available('Yes', 3), null).outcome).toBe('NOT_CHECKABLE');
  });
});

describe('indicator source mapping', () => {
  it('covers every indicator in the real framework', () => {
    // 89 indicators in the SCERT checklist. Two were missed on the first pass because their
    // titles contain an apostrophe, so this asserts the count rather than trusting a read.
    expect(mappingSummary().total).toBe(89);
  });

  it('gives every AUTO indicator both a source and a field key', () => {
    for (const [code, m] of Object.entries(INDICATOR_SOURCES)) {
      if (m.checkMethod !== 'AUTO') continue;
      expect(m.externalSource, `${code} has no source`).not.toBeNull();
      expect(m.externalFieldKey, `${code} has no field key`).not.toBeNull();
    }
  });

  it('gives every MANUAL indicator neither a source nor a field key', () => {
    for (const [code, m] of Object.entries(INDICATOR_SOURCES)) {
      if (m.checkMethod !== 'MANUAL') continue;
      expect(m.externalSource, `${code} is MANUAL but names a source`).toBeNull();
      expect(m.externalFieldKey, `${code} is MANUAL but names a field`).toBeNull();
    }
  });

  // Unclassified indicators must cost a screener's time rather than pass unchecked, so the
  // fallback is MANUAL and not AUTO.
  it('falls back to MANUAL for an unknown code', () => {
    const m = mappingFor('99.99.99');
    expect(m.checkMethod).toBe('MANUAL');
    expect(m.externalSource).toBeNull();
  });
});
