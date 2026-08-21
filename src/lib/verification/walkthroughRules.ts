/**
 * The rules a walkthrough session runs on, kept pure so they are testable and so the
 * actions that apply them stay thin.
 *
 * Three of the brief's section 7 requirements live here as arithmetic:
 *
 *   The geofence. The school side streams from the school or it does not count, so every
 *   ping carries coordinates and the fence is a distance against the school's registered
 *   pin. The radius is generous on purpose: rural campuses are large and consumer GPS
 *   scatters by tens of metres, and a fence that false-alarms on a real school teaches
 *   everyone to ignore it.
 *
 *   The connectivity rule. Two consecutive failed checks drop the session to guided
 *   capture. Consecutive, not cumulative: a morning of good video after one drop is not a
 *   failing connection, and the counter says so by resetting on success.
 *
 *   The resolve preconditions. RESOLVED requires an observation against every disputed
 *   indicator, because "resolved" asserts each dispute was looked at. UNRESOLVED requires
 *   written grounds, because it sends a field team to a school.
 */

/** Metres. Not a section 6 key: the fence is not contested between the source documents,
 *  it is simply unstated, and 300 m covers a large campus plus GPS scatter. */
export const GEOFENCE_RADIUS_METRES = 300;

/** Consecutive failed checks that end the live attempt, from the brief's section 7. */
export const CONNECTIVITY_FAILURES_TO_DROP = 2;

/** The school's time box for guided capture clips once the live session is abandoned. */
export const GUIDED_CAPTURE_HOURS = 48;

const EARTH_RADIUS_METRES = 6_371_000;

/** Haversine great-circle distance. Accurate to well under a metre at fence scale. */
export function haversineMetres(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_METRES * Math.asin(Math.sqrt(s)));
}

export type FenceReading =
  | { status: 'INSIDE'; metres: number }
  | { status: 'OUTSIDE'; metres: number }
  /** The school has no registered pin, so there is nothing to measure against. Reported,
   *  never treated as inside. */
  | { status: 'UNANCHORED' };

export function fenceReading(
  registered: { lat: number | null; lng: number | null },
  current: { lat: number; lng: number },
  radiusMetres: number = GEOFENCE_RADIUS_METRES,
): FenceReading {
  if (registered.lat === null || registered.lng === null) return { status: 'UNANCHORED' };
  const metres = haversineMetres({ lat: registered.lat, lng: registered.lng }, current);
  return metres <= radiusMetres ? { status: 'INSIDE', metres } : { status: 'OUTSIDE', metres };
}

/** The consecutive-failure counter after one more check. */
export function connectivityAfter(
  consecutiveFailures: number,
  checkOk: boolean,
): { failures: number; dropToGuidedCapture: boolean } {
  const failures = checkOk ? 0 : consecutiveFailures + 1;
  return { failures, dropToGuidedCapture: failures >= CONNECTIVITY_FAILURES_TO_DROP };
}

export type ResolveCheck = { ok: boolean; reason: string | null };

export function canResolve(
  outcome: 'RESOLVED' | 'UNRESOLVED',
  disputedParameterIds: string[],
  observedParameterIds: string[],
  outcomeNote: string,
): ResolveCheck {
  if (outcome === 'RESOLVED') {
    const observed = new Set(observedParameterIds);
    const missing = disputedParameterIds.filter((id) => !observed.has(id));
    if (missing.length > 0) {
      return {
        ok: false,
        reason: `${missing.length} disputed indicator${missing.length === 1 ? ' has' : 's have'} no observation. Resolved asserts each dispute was looked at.`,
      };
    }
    return { ok: true, reason: null };
  }
  if (outcomeNote.trim().length < 20) {
    return {
      ok: false,
      reason: 'Unresolved sends a field team. Set out what could not be resolved and why.',
    };
  }
  return { ok: true, reason: null };
}
