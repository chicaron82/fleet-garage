import type { FleetVehicle } from './fleet-master';

/**
 * Fleet-health cohorts — the "at a glance" slices of the live fleet the Fleet module surfaces as
 * tappable chips. Each is a gap worth knowing (recall → knowing) AND a worklist: tapping a chip
 * filters the fleet list to exactly that cohort so it can be worked down when the lot's quiet.
 */
export type FleetCohortId = 'missing-keytag' | 'missing-keycount' | 'needs-backfill';

export interface FleetCohort {
  id: FleetCohortId;
  label: string;
  icon: string;
  match: (v: FleetVehicle) => boolean;
}

/** Oldest plausible fleet model year — mirrors `plausibleYearOr` / the register `year > 1999`
 *  submit guard. A year below this is a blank/mis-read, i.e. the row still needs its real details. */
const FLEET_YEAR_FLOOR = 2000;

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
    match: (v) => v.make.trim() === '' || v.model.trim() === '' || v.year < FLEET_YEAR_FLOOR,
  },
];

export type FleetCohortCounts = Record<FleetCohortId, number>;

/** Count every cohort across the fleet in a single pass. */
export function fleetCohortCounts(vehicles: readonly FleetVehicle[]): FleetCohortCounts {
  const counts: FleetCohortCounts = { 'missing-keytag': 0, 'missing-keycount': 0, 'needs-backfill': 0 };
  for (const v of vehicles) {
    for (const cohort of FLEET_COHORTS) {
      if (cohort.match(v)) counts[cohort.id]++;
    }
  }
  return counts;
}

/** Does a vehicle belong to the selected cohort? `null` = no cohort filter → everything matches. */
export function matchesCohort(v: FleetVehicle, cohort: FleetCohortId | null): boolean {
  if (cohort == null) return true;
  const found = FLEET_COHORTS.find((c) => c.id === cohort);
  return found ? found.match(v) : true;
}
