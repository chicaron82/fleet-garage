import { describe, it, expect } from 'vitest';
import { getTripDurationMinutes, isTripFlagged } from '../../src/lib/trip-utils';
import type { TripRun } from '../../src/data/trips';

function trip(departTime: string, arriveTime: string): TripRun {
  return {
    id: 't1',
    vehicleUnit: 'U1',
    vehiclePlate: 'ABC123',
    tripType: 'clean',
    departLocation: 'Lot',
    arriveLocation: 'Airport',
    departTime,
    arriveTime,
    gasLevel: 'F',
    odometer: 1000,
    driverId: 'u1',
    branchId: 'YWG',
  };
}

// ── getTripDurationMinutes ────────────────────────────────────────────────────

describe('getTripDurationMinutes', () => {
  it('returns the arrive − depart gap in whole minutes', () => {
    expect(getTripDurationMinutes(trip('2026-05-22T14:00:00Z', '2026-05-22T14:25:00Z'))).toBe(25);
  });

  it('rounds to the nearest minute', () => {
    // 25m 40s → 26
    expect(getTripDurationMinutes(trip('2026-05-22T14:00:00Z', '2026-05-22T14:25:40Z'))).toBe(26);
  });

  it('is zero for a same-instant trip', () => {
    expect(getTripDurationMinutes(trip('2026-05-22T14:00:00Z', '2026-05-22T14:00:00Z'))).toBe(0);
  });
});

// ── isTripFlagged (threshold 30m) ─────────────────────────────────────────────

describe('isTripFlagged', () => {
  it('does not flag a trip at exactly the 30-minute threshold', () => {
    expect(isTripFlagged(trip('2026-05-22T14:00:00Z', '2026-05-22T14:30:00Z'))).toBe(false);
  });

  it('flags a trip over the threshold', () => {
    expect(isTripFlagged(trip('2026-05-22T14:00:00Z', '2026-05-22T14:31:00Z'))).toBe(true);
  });

  it('does not flag a short trip', () => {
    expect(isTripFlagged(trip('2026-05-22T14:00:00Z', '2026-05-22T14:10:00Z'))).toBe(false);
  });
});
