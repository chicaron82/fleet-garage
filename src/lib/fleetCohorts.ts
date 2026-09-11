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
    //
    // ⚠️⚠️ PLUS EXCEPTION CARS FG NEVER SAW (same night, an hour later). The two he actually meant — a
    // Durango and a Sienna out on exception since April — have NO sighting at all, because they left
    // before sightings existed, so "met-then-quiet" could not see them. An exception car is EXPECTED
    // BACK, so its hold is real contact and silence after it means something. Every OTHER never-seen
    // car stays out: counting all holds would balloon the chip from 56 to 171 with pre-existing cars
    // that are simply out on rent and haven't come through since Aug 16.
    //
    // ⭐ "Quiet" is now measured from `lastContact` — ANY trace (sighting, gas-sheet odometer, trip,
    // closing sheet, and for exception cars the hold), so a car on last night's inventory is not
    // quiet just because nobody scanned it.
    id: 'gone-quiet',
    label: `Quiet ${QUIET_AFTER_DAYS}d+`,
    icon: '💤',
    match: (v, now) => isQuietSince(lastContactAt(v), now),
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

export type ContactVia = 'seen' | 'odometer' | 'trip' | 'sheet' | 'exception';

export const CONTACT_LABEL: Record<ContactVia, string> = {
  seen: 'seen', odometer: 'gas sheet / odometer', trip: 'trip', sheet: 'closing sheet', exception: 'went out on exception',
};

/**
 * The newest trace FG has of a car, and what it was. Physical traces count for every car: a
 * sighting, an odometer reading (gas sheets land here), a trip, a closing-inventory line. The HOLD
 * counts only for an EXCEPTION car — it's expected back, so its hold is real contact — while a
 * pre-existing car's April hold says nothing about whether it's still around (the 56 → 171 flood).
 * Null when FG has no trace at all.
 */
export function lastContact(v: FleetVehicle): { at: string; via: ContactVia } | null {
  const cands: { at: string | null | undefined; via: ContactVia }[] = [
    { at: v.lastSeenAt, via: 'seen' },
    { at: v.odometerAt, via: 'odometer' },
    { at: v.lastTripAt, via: 'trip' },
    { at: v.lastSheetAt, via: 'sheet' },
    { at: v.status === 'on-exception' ? (v.holdActivityAt ?? v.holdFlaggedAt) : null, via: 'exception' },
  ];
  let best: { at: string; via: ContactVia } | null = null;
  for (const c of cands) {
    if (!c.at || Number.isNaN(Date.parse(c.at))) continue;
    if (!best || Date.parse(c.at) > Date.parse(best.at)) best = { at: c.at, via: c.via };
  }
  return best;
}

export function lastContactAt(v: FleetVehicle): string | null {
  return lastContact(v)?.at ?? null;
}

/** No contact for this long and an exception car is archived automatically (Aaron, 2026-09-10). */
export const AUTO_ARCHIVE_AFTER_DAYS = 60;

/**
 * Exception cars FG has had no contact with — no trace of any kind (see `lastContact`) — for
 * `AUTO_ARCHIVE_AFTER_DAYS`. The Fleet view archives these on open and tells him which.
 *
 * ⭐ His call, with its safety net named: *"its reversible, if by chance it shows up on a scan, then
 * we can just restore it at that point in time."* EXCEPTION ONLY: an exception car is expected back,
 * so 60 days of nothing means it went somewhere FG will never see (sold, transferred, written off).
 * A pre-existing or clear car that goes quiet is usually just out on rent; it only reaches the chip.
 */
export function autoArchiveCandidates(vehicles: readonly FleetVehicle[], now: number = Date.now()): FleetVehicle[] {
  return vehicles.filter(v => {
    if (v.status !== 'on-exception') return false;
    const last = lastContactAt(v);
    return last !== null && now - Date.parse(last) > AUTO_ARCHIVE_AFTER_DAYS * 86_400_000;
  });
}

/** Does a vehicle belong to the selected cohort? `null` = no cohort filter → everything matches. */
export function matchesCohort(v: FleetVehicle, cohort: FleetCohortId | null, now: number = Date.now()): boolean {
  if (cohort == null) return true;
  const found = FLEET_COHORTS.find((c) => c.id === cohort);
  return found ? found.match(v, now) : true;
}
