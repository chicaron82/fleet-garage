import { describe, it, expect } from 'vitest';
import { isStaleHold, STALE_HOLD_MS } from '../../src/lib/holdFilters';
import type { Hold } from '../../src/types';

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
