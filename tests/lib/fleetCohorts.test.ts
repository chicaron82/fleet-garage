import { describe, it, expect } from 'vitest';
import { fleetCohortCounts, matchesCohort, FLEET_COHORTS } from '../../src/lib/fleetCohorts';
import type { FleetVehicle } from '../../src/lib/fleet-master';

// Minimal healthy vehicle; override the field a case cares about.
function v(over: Partial<FleetVehicle> = {}): FleetVehicle {
  return {
    id: 'v1', unitNumber: '5428735', licensePlate: 'ABC123',
    make: 'Toyota', model: 'RAV4', year: 2024, color: 'White',
    status: 'clear', holdCount: 0, holdSummary: [], branchId: 'YWG',
    isTesla: false, isHybrid: false, hasMobileCable: null, hasJ1772Adapter: null,
    rentalClass: 'Q4', keyCount: 2, keytagPhotoUrl: 'https://x/tag.jpg',
    createdAt: '2026-08-01T12:00:00Z',
    ...over,
  };
}

describe('fleetCohorts — matchesCohort', () => {
  it('null cohort matches everything (no filter)', () => {
    expect(matchesCohort(v(), null)).toBe(true);
    expect(matchesCohort(v({ keytagPhotoUrl: null }), null)).toBe(true);
  });

  it('missing-keytag matches only a null keytag photo', () => {
    expect(matchesCohort(v({ keytagPhotoUrl: null }), 'missing-keytag')).toBe(true);
    expect(matchesCohort(v({ keytagPhotoUrl: 'https://x/tag.jpg' }), 'missing-keytag')).toBe(false);
  });

  it('missing-keycount matches only a null key count (0 keys is a REAL count, not missing)', () => {
    expect(matchesCohort(v({ keyCount: null }), 'missing-keycount')).toBe(true);
    expect(matchesCohort(v({ keyCount: 0 }), 'missing-keycount')).toBe(false);
    expect(matchesCohort(v({ keyCount: 2 }), 'missing-keycount')).toBe(false);
  });

  it('needs-backfill matches a blank make, blank model, or a blank/mis-read year', () => {
    expect(matchesCohort(v({ make: '' }), 'needs-backfill')).toBe(true);
    expect(matchesCohort(v({ model: '  ' }), 'needs-backfill')).toBe(true); // whitespace-only
    expect(matchesCohort(v({ year: 0 }), 'needs-backfill')).toBe(true);     // blank sentinel
    expect(matchesCohort(v({ year: 10 }), 'needs-backfill')).toBe(true);    // handwritten mis-read
    expect(matchesCohort(v({ year: 1999 }), 'needs-backfill')).toBe(true);  // below the floor
    expect(matchesCohort(v(), 'needs-backfill')).toBe(false);               // a complete row
    expect(matchesCohort(v({ year: 2025 }), 'needs-backfill')).toBe(false);
  });
});

describe('fleetCohorts — fleetCohortCounts', () => {
  it('counts each cohort in one pass, and a vehicle can be in more than one', () => {
    const fleet: FleetVehicle[] = [
      v(),                                                     // healthy — in none
      v({ id: '2', keytagPhotoUrl: null }),                    // missing keytag
      v({ id: '3', keyCount: null }),                          // missing key count
      v({ id: '4', make: '', model: '', year: 0, keytagPhotoUrl: null, keyCount: null }), // all three
    ];
    expect(fleetCohortCounts(fleet)).toEqual({
      'missing-keytag': 2,   // #2 and #4
      'missing-keycount': 2, // #3 and #4
      'needs-backfill': 1,   // #4
    });
  });

  it('an empty fleet is all zeroes', () => {
    expect(fleetCohortCounts([])).toEqual({ 'missing-keytag': 0, 'missing-keycount': 0, 'needs-backfill': 0 });
  });
});

describe('fleetCohorts — registry', () => {
  it('exposes exactly the three cohorts, each with a label + icon', () => {
    expect(FLEET_COHORTS.map((c) => c.id)).toEqual(['missing-keytag', 'missing-keycount', 'needs-backfill']);
    for (const c of FLEET_COHORTS) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.icon.length).toBeGreaterThan(0);
    }
  });
});
