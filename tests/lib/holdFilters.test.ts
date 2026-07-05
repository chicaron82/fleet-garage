import { describe, it, expect } from 'vitest';
import { isStaleHold, findActiveTypeOverlap, staleHeldVehicleCount, STALE_HOLD_MS } from '../../src/lib/holdFilters';
import type { Hold, Vehicle } from '../../src/types';

function makeHold(overrides: Partial<Hold> = {}): Hold {
  return {
    id: 'h1',
    vehicleId: 'v1',
    holdTypes: ['DAMAGE'],
    holdType: 'DAMAGE',
    status: 'ACTIVE',
    flaggedAt: new Date(0).toISOString(),
    branchId: 'YWG',
    damageDescription: '',
    notes: '',
    flaggedById: 'u1',
    photos: [],
    ...overrides,
  } as Hold;
}

const NOW = 1_000_000_000_000;

describe('isStaleHold', () => {
  it('returns true when hold is ACTIVE and older than 48 hours', () => {
    const hold = makeHold({ flaggedAt: new Date(NOW - STALE_HOLD_MS - 1).toISOString() });
    expect(isStaleHold(hold, NOW)).toBe(true);
  });

  it('returns false when hold is ACTIVE but exactly at the 48-hour boundary', () => {
    const hold = makeHold({ flaggedAt: new Date(NOW - STALE_HOLD_MS).toISOString() });
    expect(isStaleHold(hold, NOW)).toBe(false);
  });

  it('returns false when hold is ACTIVE but under 48 hours old', () => {
    const hold = makeHold({ flaggedAt: new Date(NOW - STALE_HOLD_MS + 1000).toISOString() });
    expect(isStaleHold(hold, NOW)).toBe(false);
  });

  it('returns false when hold is RELEASED even if older than 48 hours', () => {
    const hold = makeHold({ status: 'RELEASED', flaggedAt: new Date(NOW - STALE_HOLD_MS - 1).toISOString() });
    expect(isStaleHold(hold, NOW)).toBe(false);
  });

  it('returns false when hold is REPAIRED even if older than 48 hours', () => {
    const hold = makeHold({ status: 'REPAIRED', flaggedAt: new Date(NOW - STALE_HOLD_MS - 1).toISOString() });
    expect(isStaleHold(hold, NOW)).toBe(false);
  });

  it('uses Date.now() when no now argument is provided', () => {
    const recentHold = makeHold({ flaggedAt: new Date().toISOString() });
    expect(isStaleHold(recentHold)).toBe(false);
  });
});

// The duplicate-flag advisory's core: which active holds already carry a type
// the flagger is about to flag again. Advisory only — informs, never blocks
// (the 2026-06-12 layer-2 dedup decision: suppressing a legitimate second
// flag is worse than a duplicate, which batch-resolve makes cheap to clean).
describe('findActiveTypeOverlap', () => {
  it('surfaces an active hold sharing a selected type', () => {
    const hold = makeHold({ holdTypes: ['damage'] });
    const overlaps = findActiveTypeOverlap([hold], ['damage', 'detail']);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].hold.id).toBe('h1');
    expect(overlaps[0].types).toEqual(['damage']);
  });

  it('no overlap when the active hold carries different types', () => {
    const hold = makeHold({ holdTypes: ['mechanical'] });
    expect(findActiveTypeOverlap([hold], ['damage'])).toEqual([]);
  });

  it('a type already resolved within a multi-type hold does not count — that issue is fixed', () => {
    const hold = makeHold({ holdTypes: ['damage', 'mechanical'], resolvedTypes: ['damage'] });
    expect(findActiveTypeOverlap([hold], ['damage'])).toEqual([]);
    // …but its still-open type does:
    expect(findActiveTypeOverlap([hold], ['mechanical'])).toHaveLength(1);
  });

  it('reports each overlapping hold separately with only the shared types', () => {
    const a = makeHold({ id: 'a', holdTypes: ['damage'] });
    const b = makeHold({ id: 'b', holdTypes: ['damage', 'detail'] });
    const overlaps = findActiveTypeOverlap([a, b], ['damage', 'detail']);
    expect(overlaps.map(o => o.hold.id)).toEqual(['a', 'b']);
    expect(overlaps[1].types).toEqual(['damage', 'detail']);
  });

  it('handles legacy holds with no resolvedTypes field', () => {
    const legacy = makeHold({ holdTypes: ['hail'], resolvedTypes: undefined });
    expect(findActiveTypeOverlap([legacy], ['hail'])).toHaveLength(1);
  });
});

// "Held too long" for My Day: distinct HELD (non-archived, passed by caller) vehicles
// carrying a stale hold — so sale_car / archived-dangling holds don't masquerade as
// bay holds. Takes an already-stale hold set + the branch's non-archived vehicles.
describe('staleHeldVehicleCount', () => {
  const veh = (id: string, status: string) => ({ id, status } as unknown as Vehicle);
  const on = (vehicleId: string) => makeHold({ vehicleId }); // an already-stale hold on a vehicle

  it('counts a HELD vehicle that carries a stale hold', () => {
    expect(staleHeldVehicleCount([on('v1')], [veh('v1', 'HELD')])).toBe(1);
  });
  it('excludes a stale hold on a non-HELD vehicle (e.g. SALE_CAR)', () => {
    expect(staleHeldVehicleCount([on('v1')], [veh('v1', 'SALE_CAR')])).toBe(0);
  });
  it('excludes a stale hold whose vehicle is absent (archived → filtered upstream)', () => {
    expect(staleHeldVehicleCount([on('ghost')], [])).toBe(0);
  });
  it('dedupes: a HELD vehicle with two stale holds counts once', () => {
    expect(staleHeldVehicleCount([on('v1'), on('v1')], [veh('v1', 'HELD')])).toBe(1);
  });
  it('mixed population → only distinct HELD stale vehicles', () => {
    const vehicles = [veh('v1', 'HELD'), veh('v2', 'HELD'), veh('v3', 'SALE_CAR')];
    expect(staleHeldVehicleCount([on('v1'), on('v2'), on('v3'), on('v1')], vehicles)).toBe(2);
  });
});
