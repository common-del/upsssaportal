import type { ExternalSource } from '@prisma/client';

/**
 * One interface over the three government systems, with stubs behind it.
 *
 * Two constraints shape this, both from the brief and both worth restating because they
 * pull in opposite directions.
 *
 * The terms of reference assert the cross-match runs "through API integration". The brief
 * says not to assume live APIs and to write each adapter so it can be backed by an API call
 * or by a periodic bulk file reconciliation, chosen by config. The brief is right to hedge:
 * an integration that turns out to be a monthly CSV drop changes what the portal can
 * promise about freshness, and a design that only works one way has to be rebuilt rather
 * than reconfigured. So `mode` is a property of the adapter, and every reading carries the
 * time it was taken, because a bulk file is stale by construction and a verifier looking at
 * a mismatch needs to know whether they are comparing today's claim to last month's record.
 *
 * The second constraint is subtler. SQAAF grades every indicator on a three-level rubric,
 * while these systems hold counts and yes/no flags. "42 classrooms" is not a level. Turning
 * one into the other needs a threshold rule per indicator, and no such rules have been
 * supplied. Rather than invent them, a reading returns the raw value and, separately, a
 * level only where a rule exists. Where it does not, the auto-check records NOT_CHECKABLE
 * with a reason. An invented threshold would produce confident mismatches against schools
 * on a rule nobody agreed.
 */

export type ExternalMode = 'API' | 'BULK_FILE';

export type ExternalReading =
  | {
      available: true;
      /** Verbatim from the source, so it can be shown to a verifier without re-querying. */
      rawValue: string;
      /**
       * The SQAAF level this value implies, 1 to 3, when a threshold rule exists for the
       * field. Null means the value was read but cannot be compared to a level claim.
       */
      impliedLevel: number | null;
      readAt: Date;
    }
  | {
      available: false;
      /** Shown to the verifier so an absent check reads as absent, not as a pass. */
      reason: string;
    };

export interface ExternalSourceAdapter {
  readonly source: ExternalSource;
  readonly mode: ExternalMode;
  /** False while the adapter is a stub, so the portal never presents seeded values as real. */
  readonly isLive: boolean;
  read(udise: string, fieldKey: string): Promise<ExternalReading>;
}

/**
 * Deterministic stand-in values, keyed on the school and the field.
 *
 * Deterministic rather than random for the same reason the rest of this portal's demo data
 * is: a value that moves between page loads makes every downstream figure unstable and
 * looks like a bug. Two schools get different values, and the same school gets the same
 * value every time.
 */
function stubHash(udise: string, fieldKey: string): number {
  let h = 0;
  const s = `${udise}:${fieldKey}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1_000_003;
  return h;
}

/**
 * Threshold rules, which exist for exactly the fields where the meaning is unambiguous.
 *
 * A yes/no facility field maps cleanly: absent is level 1, present is level 3, and there is
 * no sensible level 2 for "does a library exist". Counts do not map at all without a norm
 * per school size, so they are deliberately absent from this table and their indicators
 * come back NOT_CHECKABLE until SSSA supplies the norms.
 */
const YES_NO_FIELDS = new Set([
  'hand_pump_fun_yn',
  'handwash_near_toilet',
  'playground_available',
  'library_availability',
  'electricity_availability',
  'boundary_wall',
  'medical_checkups',
  'availability_ramps',
  'ict_lab_yn',
  'spl_educator_yn',
  'separate_room_for_hm',
  'counsellor_posted',
]);

function stubReading(udise: string, fieldKey: string, mode: ExternalMode): ExternalReading {
  const h = stubHash(udise, fieldKey);

  // One field in twelve is missing on purpose. A source that always answers would hide the
  // NOT_CHECKABLE path, which is the one the desk queue actually has to cope with.
  if (h % 12 === 0) {
    return { available: false, reason: 'No value held for this school in the source extract.' };
  }

  // A bulk reconciliation is stale by design, so the stub says so rather than stamping now.
  const readAt =
    mode === 'BULK_FILE'
      ? new Date(Date.now() - (7 + (h % 21)) * 86_400_000)
      : new Date();

  if (YES_NO_FIELDS.has(fieldKey)) {
    const yes = h % 4 !== 0;
    return { available: true, rawValue: yes ? 'Yes' : 'No', impliedLevel: yes ? 3 : 1, readAt };
  }

  // A count, with no threshold rule to turn it into a level.
  return { available: true, rawValue: String(10 + (h % 90)), impliedLevel: null, readAt };
}

class StubAdapter implements ExternalSourceAdapter {
  readonly isLive = false;
  constructor(
    readonly source: ExternalSource,
    readonly mode: ExternalMode,
  ) {}

  async read(udise: string, fieldKey: string): Promise<ExternalReading> {
    return stubReading(udise, fieldKey, this.mode);
  }
}

/**
 * Mode per source, from the environment rather than a constant, so switching one source to
 * bulk reconciliation does not need a code change. Defaults to API because that is what the
 * terms of reference claim; the defaults are the assertion, the env var is the correction.
 */
function modeFor(source: ExternalSource): ExternalMode {
  const key = `EXTERNAL_MODE_${source}`;
  return process.env[key] === 'BULK_FILE' ? 'BULK_FILE' : 'API';
}

const ADAPTERS: Record<ExternalSource, ExternalSourceAdapter> = {
  UDISE_PLUS: new StubAdapter('UDISE_PLUS', modeFor('UDISE_PLUS')),
  PRERNA: new StubAdapter('PRERNA', modeFor('PRERNA')),
  MANAV_SAMPADA: new StubAdapter('MANAV_SAMPADA', modeFor('MANAV_SAMPADA')),
};

export function adapterFor(source: ExternalSource): ExternalSourceAdapter {
  return ADAPTERS[source];
}

/** Every source is a stub today. Surfaced so a screen can say so rather than implying the
 *  cross-match is live. */
export function anyAdapterIsLive(): boolean {
  return Object.values(ADAPTERS).some((a) => a.isLive);
}
