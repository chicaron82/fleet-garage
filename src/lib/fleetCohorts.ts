import type { FleetVehicle } from './fleet-master';
import { identityGaps } from './vehicleName';
import { isQuietSince, QUIET_AFTER_DAYS } from './sightings';

/**
 * Fleet-health cohorts — the "at a glance" slices of the live fleet the Fleet module surfaces as
 * tappable chips. Each is a gap worth knowing (recall → knowing) AND a worklist: tapping a chip
 * filters the fleet list to exactly that cohort so it can be worked down when the lot's quiet.
 */
export type FleetCohortId = 'missing-keytag' | 'missing-keycount' | 'needs-backfill' | 'gone-quiet';

export interface FleetCohort {
  id: FleetCohortId;
  label: string;
  icon: string;
  /** `now` (epoch ms) is passed in so a time-based cohort stays a pure, testable predicate. */
  match: (v: FleetVehicle, now: number) => boolean;
}

/** Oldest plausible fleet model year — mirrors `plausibleYearOr` / the register `year > 1999`
 *  submit guard. A year below this is a blank/mis-read, i.e. the row still needs its real details. */
// ⭐ THE FLOOR AND THE PREDICATE BOTH MOVED TO `vehicleName` (2026-09-07) so the Fleet chip and the
// vehicle record cannot disagree about what "needs details" means. This file used to own the rule;
// now it delegates, which is the only way two surfaces stay in step without anyone remembering to
// update both.

export const FLEET_COHORTS: readonly FleetCohort[] = [
  {
    id: 'missing-keytag',
    label: 'No keytag',
    icon: '📷',
    match: (v) => v.keytagPhotoUrl == null,
  },
  {
    id: 'missing-keycount',
    label: 'No key count',
    icon: '🔑',
    match: (v) => v.keyCount == null,
  },
  {
    // A plate holding a spot: blank make/model, or a blank/mis-read year — the row needs its
    // real identity backfilled. (Blank year is `< FLEET_YEAR_FLOOR`, which also covers the 0 sentinel.)
    id: 'needs-backfill',
    label: 'Needs details',
    icon: '🪪',
    match: (v) => identityGaps(v).length > 0,
  },
  {
    // ⭐ Aaron, 2026-09-10: *"i thought we made something to auto archive if FG hasn't seen it for
    // some time"* — nothing had been built. This is the honest half of that: a list, never an
    // archive. A quiet car may be on a long rental or at the airport; he archives the ones he KNOWS
    // are gone. Met-then-quiet only — a never-seen car describes the log's age, not the yard.
    // Same threshold as the record's amber "Seen" chip (sightings.QUIET_AFTER_DAYS), on purpose.
    id: 'gone-quiet',
    label: `Quiet ${QUIET_AFTER_DAYS}d+`,
    icon: '💤',
    match: (v, now) => isQuietSince(v.lastSeenAt, now),
  },
];

export type FleetCohortCounts = Record<FleetCohortId, number>;

/** Count every cohort across the fleet in a single pass. */
export function fleetCohortCounts(vehicles: readonly FleetVehicle[], now: number = Date.now()): FleetCohortCounts {
  const counts: FleetCohortCounts = { 'missing-keytag': 0, 'missing-keycount': 0, 'needs-backfill': 0, 'gone-quiet': 0 };
  for (const v of vehicles) {
    for (const cohort of FLEET_COHORTS) {
      if (cohort.match(v, now)) counts[cohort.id]++;
    }
  }
  return counts;
}

/** Does a vehicle belong to the selected cohort? `null` = no cohort filter → everything matches. */
export function matchesCohort(v: FleetVehicle, cohort: FleetCohortId | null, now: number = Date.now()): boolean {
  if (cohort == null) return true;
  const found = FLEET_COHORTS.find((c) => c.id === cohort);
  return found ? found.match(v, now) : true;
}
