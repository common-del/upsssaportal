import { beforeEach, describe, expect, it } from 'vitest';
import {
  IDENTIFYING_FIELDS,
  maskSchool,
  maskedCodeFor,
  mustSeeMaskedOnly,
} from './masking';

const SCHOOL = { udise: '09460401101', category: 'Upper Primary' };

beforeEach(() => {
  process.env.AUTH_SECRET = 'test-secret-for-masking';
});

describe('the masked view carries nothing identifying', () => {
  // The test that would catch someone adding nameEn to MaskedSchool a year from now. Enumerated
  // rather than eyeballed, because the leak would be invisible in review: a school name in a
  // verifier's queue looks like helpful context, not a broken promise.
  it('exposes none of the identifying fields', () => {
    const masked = maskSchool({ ...SCHOOL, nameEn: 'Aided Inter College' } as never);
    for (const field of IDENTIFYING_FIELDS) {
      expect(Object.keys(masked), `${field} leaked into the masked view`).not.toContain(field);
    }
  });

  it('exposes exactly the two fields the workspace needs', () => {
    expect(Object.keys(maskSchool(SCHOOL)).sort()).toEqual(['category', 'maskedCode']);
  });

  // Stage is not identifying, and withholding it would leave the screener unable to tell which
  // of the 89 indicators applied to the school in front of them.
  it('keeps the school stage', () => {
    expect(maskSchool(SCHOOL).category).toBe('Upper Primary');
  });

  it('does not contain the UDISE anywhere in the code', () => {
    const masked = maskSchool(SCHOOL);
    expect(masked.maskedCode).not.toContain(SCHOOL.udise);
    // Nor any substring of it long enough to narrow the register down.
    for (let i = 0; i + 6 <= SCHOOL.udise.length; i++) {
      expect(masked.maskedCode).not.toContain(SCHOOL.udise.slice(i, i + 6));
    }
  });
});

describe('the masked code', () => {
  it('is stable for the same school, so a case can be referred to', () => {
    expect(maskedCodeFor(SCHOOL.udise)).toBe(maskedCodeFor(SCHOOL.udise));
  });

  it('differs between schools', () => {
    const codes = new Set(
      ['09460401101', '09261106301', '09260508901', '09461004604'].map(maskedCodeFor),
    );
    expect(codes.size).toBe(4);
  });

  it('does not collide across a realistic batch', () => {
    // A screener's batch is tens of schools, but the register is 2,65,278, so this checks a
    // volume where a short code would start to collide if it were too short.
    const codes = new Set(
      Array.from({ length: 5000 }, (_, i) => maskedCodeFor(`0946${String(i).padStart(7, '0')}`)),
    );
    expect(codes.size).toBe(5000);
  });

  it('reads as an identifier rather than as a number', () => {
    expect(maskedCodeFor(SCHOOL.udise)).toMatch(/^SC-[0-9A-F]{10}$/);
  });

  // The point of keying it. An unkeyed hash of a UDISE is reversible by anyone holding the
  // register, which every verifier does, so a change of key must change every code.
  it('depends on the secret, so it cannot be rebuilt without the key', () => {
    const withFirst = maskedCodeFor(SCHOOL.udise);
    process.env.AUTH_SECRET = 'a-different-secret';
    expect(maskedCodeFor(SCHOOL.udise)).not.toBe(withFirst);
  });

  it('refuses to mask at all rather than produce an unkeyed code', () => {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    expect(() => maskedCodeFor(SCHOOL.udise)).toThrow(/would not be anonymous/);
  });
});

describe('who the masking applies to', () => {
  it('applies to online verifiers', () => {
    expect(mustSeeMaskedOnly('ONLINE_VERIFIER')).toBe(true);
    expect(mustSeeMaskedOnly('VERIFIER')).toBe(true);
  });

  // A supervisor handling an escalation has to identify the school to act on it, and the audit
  // trail records that they did. A field verifier's anonymity is a time gate, not a mask.
  it('does not apply to supervisors, SSSA or field verifiers', () => {
    expect(mustSeeMaskedOnly('SUPERVISOR')).toBe(false);
    expect(mustSeeMaskedOnly('SSSA_ADMIN')).toBe(false);
    expect(mustSeeMaskedOnly('ONGROUND_VERIFIER')).toBe(false);
    expect(mustSeeMaskedOnly('AUDIT_CELL')).toBe(false);
  });
});
