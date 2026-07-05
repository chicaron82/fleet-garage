import { describe, it, expect } from 'vitest';
import { isStaleHold, staleHeldVehicleCount, STALE_HOLD_MS } from './holdFilters';
import type { Hold, Vehicle } from '../types';

const NOW = Date.parse('2026-07-04T12:00:00Z');

// Minimal fixtures — these functions only read status/flaggedAt (holds) and id/status
// (vehicles), so partial casts keep the intent legible.
const hold = (vehicleId: string, status: string, ageMs: number): Hold =>
  ({ vehicleId, status, flaggedAt: new Date(NOW - ageMs).toISOString() } as unknown as Hold);
const veh = (id: string, status: string): Vehicle =>
  ({ id, status } as unknown as Vehicle);

const OLD = STALE_HOLD_MS + 60_000;   // just past 48h
const FRESH = STALE_HOLD_MS - 60_000; // just under 48h

describe('isStaleHold', () => {
  it('is true only for an ACTIVE hold older than 48h', () => {
    expect(isStaleHold(hold('v1', 'ACTIVE', OLD), NOW)).toBe(true);
  });
  it('is false for an ACTIVE hold under 48h', () => {
    expect(isStaleHold(hold('v1', 'ACTIVE', FRESH), NOW)).toBe(false);
  });
  it('is false for a non-ACTIVE hold, however old', () => {
    expect(isStaleHold(hold('v1', 'RELEASED', OLD), NOW)).toBe(false);
  });
});

describe('staleHeldVehicleCount', () => {
  it('counts a HELD vehicle that carries a stale hold', () => {
    const vehicles = [veh('v1', 'HELD')];
    expect(staleHeldVehicleCount([hold('v1', 'ACTIVE', OLD)], vehicles)).toBe(1);
  });

  it('EXCLUDES a stale hold on a non-HELD vehicle (e.g. SALE_CAR)', () => {
    const vehicles = [veh('v1', 'SALE_CAR')];
    expect(staleHeldVehicleCount([hold('v1', 'ACTIVE', OLD)], vehicles)).toBe(0);
  });

  it('EXCLUDES a stale hold whose vehicle is absent (archived → filtered out upstream)', () => {
    expect(staleHeldVehicleCount([hold('ghost', 'ACTIVE', OLD)], [])).toBe(0);
  });

  it('dedupes: a HELD vehicle with two stale holds counts once', () => {
    const vehicles = [veh('v1', 'HELD')];
    const holds = [hold('v1', 'ACTIVE', OLD), hold('v1', 'ACTIVE', OLD)];
    expect(staleHeldVehicleCount(holds, vehicles)).toBe(1);
  });

  it('mixed population resolves to distinct HELD stale vehicles only', () => {
    const vehicles = [veh('v1', 'HELD'), veh('v2', 'HELD'), veh('v3', 'SALE_CAR')];
    const holds = [
      hold('v1', 'ACTIVE', OLD),   // held + stale → counts
      hold('v2', 'ACTIVE', OLD),   // held + stale → counts
      hold('v3', 'ACTIVE', OLD),   // sale_car → excluded
      hold('v1', 'ACTIVE', OLD),   // dup of v1 → no double-count
    ];
    expect(staleHeldVehicleCount(holds, vehicles)).toBe(2);
  });
});
