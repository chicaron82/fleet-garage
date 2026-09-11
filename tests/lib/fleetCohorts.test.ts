import { describe, it, expect } from 'vitest';
import { fleetCohortCounts, matchesCohort, FLEET_COHORTS, autoArchiveCandidates, lastContactAt, lastContact } from '../../src/lib/fleetCohorts';
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
      'gone-quiet': 0,       // none carry a sighting
    });
  });

  it('an empty fleet is all zeroes', () => {
    expect(fleetCohortCounts([])).toEqual({ 'missing-keytag': 0, 'missing-keycount': 0, 'needs-backfill': 0, 'gone-quiet': 0 });
  });
});

describe('fleetCohorts — registry', () => {
  it('exposes exactly the four cohorts, each with a label + icon', () => {
    expect(FLEET_COHORTS.map((c) => c.id)).toEqual(['missing-keytag', 'missing-keycount', 'needs-backfill', 'gone-quiet']);
    for (const c of FLEET_COHORTS) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.icon.length).toBeGreaterThan(0);
    }
  });
});

// ⭐ Aaron, 2026-09-10: he remembered an auto-archive for cars FG stops seeing; none existed. This is a
// LIST he works by hand — a quiet car can be on a long rental — and it only counts cars FG has MET.
describe('fleetCohorts — gone-quiet', () => {
  const now = new Date(2026, 8, 10, 22, 0, 0).getTime();
  const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

  it('matches a car met and then not seen for over three weeks', () => {
    expect(matchesCohort(v({ lastSeenAt: daysAgo(24) }), 'gone-quiet', now)).toBe(true);
    expect(matchesCohort(v({ lastSeenAt: daysAgo(10) }), 'gone-quiet', now)).toBe(false);
  });

  it('⚠️ a never-seen car is NOT quiet — that describes the log\'s age, not the yard', () => {
    expect(matchesCohort(v({ lastSeenAt: null }), 'gone-quiet', now)).toBe(false);
    expect(matchesCohort(v(), 'gone-quiet', now)).toBe(false);
  });

  it('is counted with the others', () => {
    const fleet = [v({ id: 'a', lastSeenAt: daysAgo(30) }), v({ id: 'b', lastSeenAt: daysAgo(2) }), v({ id: 'c' })];
    expect(fleetCohortCounts(fleet, now)['gone-quiet']).toBe(1);
  });
});

// ⭐ The two he actually meant: a Durango and a Sienna out on exception since April, never sighted.
describe('fleetCohorts — exception cars that never came back', () => {
  const now = new Date(2026, 8, 10, 23, 0, 0).getTime();
  const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

  it('lists a never-seen EXCEPTION car whose hold is 21+ days old', () => {
    expect(matchesCohort(v({ status: 'on-exception', holdActivityAt: daysAgo(130) }), 'gone-quiet', now)).toBe(true);
    expect(matchesCohort(v({ status: 'on-exception', holdActivityAt: daysAgo(5) }), 'gone-quiet', now)).toBe(false);
  });

  it('⚠️ but NOT a never-seen pre-existing car — its hold says nothing about whether it is around', () => {
    expect(matchesCohort(v({ status: 'pre-existing', holdActivityAt: daysAgo(130) }), 'gone-quiet', now)).toBe(false);
  });

  it('lastContact takes the newest trace, and names it', () => {
    expect(lastContact(v({ lastSeenAt: daysAgo(3), odometerAt: daysAgo(9) }))).toEqual({ at: daysAgo(3), via: 'seen' });
    expect(lastContact(v({ status: 'on-exception', holdActivityAt: daysAgo(90), odometerAt: daysAgo(6) }))?.via).toBe('odometer');
    expect(lastContactAt(v({ status: 'on-exception', holdActivityAt: daysAgo(90) }))).toBe(daysAgo(90));
    expect(lastContactAt(v({ holdActivityAt: daysAgo(90) }))).toBeNull();   // not exception → hold is no contact
    expect(lastContactAt(v())).toBeNull();
  });

  it('auto-archives exception cars with no contact for 60+ days — and nothing else', () => {
    const fleet = [
      v({ id: 'durango', status: 'on-exception', holdActivityAt: daysAgo(132) }),                          // gone
      v({ id: 'back', status: 'on-exception', holdActivityAt: daysAgo(132), lastSeenAt: daysAgo(4) }),      // seen lately
      v({ id: 'fresh', status: 'on-exception', holdActivityAt: daysAgo(40) }),                              // not 60 yet
      v({ id: 'rented', status: 'pre-existing', holdActivityAt: daysAgo(200) }),                            // not exception
    ];
    expect(autoArchiveCandidates(fleet, now).map(c => c.id)).toEqual(['durango']);
  });

  // ⚠️⚠️ THE CAR THE FIRST DRAFT WOULD HAVE ARCHIVED: LUR310, exception since July with no sighting —
  // but written on the Sep 8 closing sheet and on the dirty ring the night this was built. And LJF720,
  // whose gas-sheet odometer landed Sep 5. Any trace is contact.
  it('a closing-sheet line or a gas-sheet odometer keeps an exception car OFF the archive', () => {
    const lur310 = v({ id: 'LUR310', status: 'on-exception', holdActivityAt: daysAgo(68), lastSheetAt: '2026-09-08' });
    const ljf720 = v({ id: 'LJF720', status: 'on-exception', holdActivityAt: daysAgo(90), odometerAt: daysAgo(5) });
    expect(autoArchiveCandidates([lur310, ljf720], now)).toEqual([]);
    expect(matchesCohort(lur310, 'gone-quiet', now)).toBe(false);
  });
});
