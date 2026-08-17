// Movement, not just level — what the fleet-health chips did SINCE last time.
//
// Aaron, 2026-08-17: *"what do you think of showing fleet analytics. how many were registered up x
// from yesterday, missing keytags, down x from yesterday etc"*
//
// The chips (`ac50165`) answer "how many right now". A count alone can't tell him whether he's
// gaining or losing ground — 213 missing keytags reads the same on the day it's climbing as on the
// day he's grinding it down. The delta is the part that says which.
//
// ⚠️ TWO SOURCES, and they are not equally available:
//   • Registrations come from `vehicles.created_at` — real history, every day FG has existed.
//   • Cohort deltas come from `fleet_daily_snapshot` (migration 115), which starts the day it ships,
//     because nothing ever recorded WHEN a car stopped missing its keytag.
// So the registration line works immediately and the cohort arrows appear from the second snapshot
// onward. `cohortDeltas` returning nulls is the normal, honest day-one state — not an error.
import type { FleetCohortCounts, FleetCohortId } from './fleetCohorts';

/** One stored day of cohort counts — the shape read back from `fleet_daily_snapshot`. */
export interface FleetSnapshot {
  snapshotDate: string; // 'YYYY-MM-DD'
  total: number;
  missingKeytag: number;
  missingKeycount: number;
  needsBackfill: number;
}

export type FleetCohortDeltas = Record<FleetCohortId, number | null>;

const EMPTY: FleetCohortDeltas = {
  'missing-keytag': null,
  'missing-keycount': null,
  'needs-backfill': null,
};

/**
 * Today's counts minus the baseline's. `null` for every cohort when there's no baseline yet —
 * which is the whole of day one, and stays true for a branch he hasn't opened before.
 *
 * Sign convention is deliberately RAW (now − then): negative means the gap shrank. The UI decides
 * that shrinking is the good direction, because that's a presentation judgment about cohorts that
 * happen to all be gaps — a future cohort that isn't a gap shouldn't inherit the colour scheme.
 */
export function cohortDeltas(
  today: FleetCohortCounts,
  baseline: FleetSnapshot | null | undefined,
): FleetCohortDeltas {
  if (!baseline) return { ...EMPTY };
  return {
    'missing-keytag': today['missing-keytag'] - baseline.missingKeytag,
    'missing-keycount': today['missing-keycount'] - baseline.missingKeycount,
    'needs-backfill': today['needs-backfill'] - baseline.needsBackfill,
  };
}

/**
 * How the comparison should be described — and it names the ACTUAL baseline date rather than
 * assuming yesterday. The snapshot is written when Aaron opens the Fleet module, so a day off is a
 * day with no row; calling a Friday baseline "yesterday" on a Monday would be a quiet lie in a tool
 * whose whole purpose is replacing guessing with knowing. '' when there's nothing to compare to.
 */
export function describeBaseline(baselineDate: string | null | undefined, todayISO: string): string {
  if (!baselineDate) return '';
  const base = new Date(`${baselineDate}T00:00:00`);
  const today = new Date(`${todayISO}T00:00:00`);
  if (Number.isNaN(base.getTime()) || Number.isNaN(today.getTime())) return '';
  const days = Math.round((today.getTime() - base.getTime()) / 86_400_000);
  if (days <= 0) return '';
  if (days === 1) return 'since yesterday';
  return `since ${base.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`;
}

/** `+3` / `-5` / '' — the compact badge text. Zero renders as nothing: "no change" is not news,
 *  and a row of grey 0s would bury the two chips that actually moved. */
export function deltaLabel(delta: number | null): string {
  if (delta == null || delta === 0) return '';
  return delta > 0 ? `+${delta}` : `${delta}`;
}

/** Registrations added on a given local date, straight from `created_at`. No snapshot involved —
 *  this is real history and works on the day it ships. */
export function registeredOn(
  createdAtISOs: readonly (string | null | undefined)[],
  localDate: string,
): number {
  let n = 0;
  for (const iso of createdAtISOs) {
    if (!iso) continue;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) continue;
    if (toLocalDate(d) === localDate) n++;
  }
  return n;
}

/** Local YYYY-MM-DD. Deliberately local, not UTC: a car registered at 19:00 CDT belongs to that
 *  day's shift, and toISOString() would file it under tomorrow. */
export function toLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
