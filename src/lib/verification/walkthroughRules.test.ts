import { describe, expect, it } from 'vitest';
import {
  canResolve,
  connectivityAfter,
  fenceReading,
  GEOFENCE_RADIUS_METRES,
  haversineMetres,
} from './walkthroughRules';

// Hazratganj crossing to the Lucknow Charbagh station forecourt: roughly 2.8 km on the
// ground, a distance stable enough to pin an implementation to.
const HAZRATGANJ = { lat: 26.8467, lng: 80.9462 };
const CHARBAGH = { lat: 26.8302, lng: 80.9227 };

describe('haversine distance', () => {
  it('measures a known city distance within tolerance', () => {
    const d = haversineMetres(HAZRATGANJ, CHARBAGH);
    expect(d).toBeGreaterThan(2500);
    expect(d).toBeLessThan(3300);
  });

  it('is zero at the same point and symmetric', () => {
    expect(haversineMetres(HAZRATGANJ, HAZRATGANJ)).toBe(0);
    expect(haversineMetres(HAZRATGANJ, CHARBAGH)).toBe(haversineMetres(CHARBAGH, HAZRATGANJ));
  });
});

describe('the fence', () => {
  it('reads inside within the radius', () => {
    // Roughly 110 m north of the pin.
    const near = { lat: HAZRATGANJ.lat + 0.001, lng: HAZRATGANJ.lng };
    const r = fenceReading(HAZRATGANJ, near);
    expect(r.status).toBe('INSIDE');
    if (r.status === 'INSIDE') expect(r.metres).toBeLessThan(GEOFENCE_RADIUS_METRES);
  });

  it('reads outside beyond the radius, with the distance', () => {
    const r = fenceReading(HAZRATGANJ, CHARBAGH);
    expect(r.status).toBe('OUTSIDE');
    if (r.status === 'OUTSIDE') expect(r.metres).toBeGreaterThan(2000);
  });

  // A missing pin must never pass as inside: an unenforceable fence that reports INSIDE
  // is a fence in name only, which is worse than no fence.
  it('reports an unanchored fence rather than passing it', () => {
    expect(fenceReading({ lat: null, lng: null }, HAZRATGANJ)).toEqual({ status: 'UNANCHORED' });
  });
});

describe('the connectivity rule', () => {
  it('drops to guided capture on the second consecutive failure', () => {
    const first = connectivityAfter(0, false);
    expect(first).toEqual({ failures: 1, dropToGuidedCapture: false });
    const second = connectivityAfter(first.failures, false);
    expect(second).toEqual({ failures: 2, dropToGuidedCapture: true });
  });

  // Consecutive, not cumulative: a good check heals the counter, so a session with one
  // morning drop and hours of clean video is not treated as failing.
  it('resets the counter on a successful check', () => {
    expect(connectivityAfter(1, true)).toEqual({ failures: 0, dropToGuidedCapture: false });
  });
});

describe('resolve preconditions', () => {
  const disputed = ['p1', 'p2', 'p3'];

  it('refuses RESOLVED while any disputed indicator lacks an observation', () => {
    const r = canResolve('RESOLVED', disputed, ['p1', 'p3'], '');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/no observation/);
  });

  it('allows RESOLVED once every dispute has been looked at', () => {
    expect(canResolve('RESOLVED', disputed, ['p1', 'p2', 'p3'], '').ok).toBe(true);
  });

  it('requires written grounds for UNRESOLVED', () => {
    expect(canResolve('UNRESOLVED', disputed, [], 'too vague').ok).toBe(false);
    expect(
      canResolve('UNRESOLVED', disputed, [], 'The kitchen shown does not match the claimed infrastructure level.').ok,
    ).toBe(true);
  });
});
