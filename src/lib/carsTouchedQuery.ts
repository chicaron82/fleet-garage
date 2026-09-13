// The one query behind the cars-touched basis — shared by the live card's hook and the PDF export.
//
// ⭐ EXTRACTED 2026-09-13 because the two callers had started to diverge before either shipped: the
// hook computed its own day bounds, the export reused ones already in scope, and both re-typed the
// same row shape. Same failure the shift WINDOW had (`shiftWindowBounds`) — two copies of one
// question is how a card and its own PDF start disagreeing.
//
// ⚠️ ALWAYS TIME-BOUNDED. `vehicle_changes` gateway-times-out on an unbounded page-through (found
// the hard way, 2026-09-13). Bounded by `changed_at` it rides `vehicle_changes_at_idx` — 88 rows in
// 553 ms for a real opening shift. There is no safe way to ask this table for "everything".
//
// ⚠️ Fetches the whole BUSINESS DAY, then `countTouched` narrows to the shift — so work he did
// outside his window is counted as outside rather than never seen. That is his asterisk:
// *"whatever we enter in for odo from tonight's gas sheets would have an asterisk added after (or in
// some cases maybe before) my shift."*
import { supabase } from './supabase';
import { computeShiftRates, type ShiftSnapshot } from './shift-metrics';
import {
  countTouched, resolveNumerator,
  type ThroughputBasis, type TouchedCount, type TouchRow,
} from './throughputBasis';

interface ChangeRow { vehicle_id: string; actor: string | null; changed_at: string }

/** Null when the query fails — the caller shows "still counting" rather than a wrong zero. */
export async function fetchCarsTouched(args: {
  userId: string;
  /** Business-day bounds, ISO. The caller owns these; this never invents a day. */
  dayStartISO: string;
  dayEndISO: string;
  /** The shift's own clock edges, from `shiftWindowBounds` — never a second derivation. */
  windowStartMs: number;
  windowEndMs: number;
}): Promise<TouchedCount | null> {
  const { userId, dayStartISO, dayEndISO, windowStartMs, windowEndMs } = args;
  const { data, error } = await supabase.from('vehicle_changes')
    .select('vehicle_id, actor, changed_at')
    .gte('changed_at', dayStartISO)
    .lte('changed_at', dayEndISO);
  if (error || !data) return null;
  const rows: TouchRow[] = (data as ChangeRow[])
    .map(r => ({ vehicleId: r.vehicle_id, actor: r.actor, changedAt: r.changed_at }));
  return countTouched(
    rows, userId,
    new Date(windowStartMs).toISOString(),
    new Date(windowEndMs).toISOString(),
  );
}

/**
 * Apply the chosen basis to an already-resolved snapshot, fetching the count only when it is needed.
 *
 * ⭐ The gas-sheet path costs NOTHING — no query, no await that matters — so a user who never
 * switches basis pays nothing for the feature existing.
 *
 * ⚠️ DENOMINATOR UNTOUCHED, and that is Aaron's decision #3 on the ticket: hours stay dependent on
 * off-standard by the existing rules. Only the NUMERATOR changes, so the same snapshot is re-rated
 * rather than re-partitioned — routing an already-shift-scoped count through `buildShiftPartition`
 * would slice it twice.
 *
 * Returns the gas-sheet rates unchanged when the window cannot be resolved or the query fails: a
 * report that quietly reverts to the number FG has always shown is safe; one that prints a blank or
 * a zero is not.
 */
export async function ratesForBasis(args: {
  basis: ThroughputBasis;
  snapshot: ShiftSnapshot;
  gas: { baseline: number | null; yourEffort: number | null };
  userId: string;
  windowStartMs: number | null;
  windowEndMs: number | null;
  dayStartISO: string;
  dayEndISO: string;
}): Promise<{ baseline: number | null; yourEffort: number | null; carsTouched: number | null }> {
  const { basis, snapshot, gas, userId, windowStartMs, windowEndMs, dayStartISO, dayEndISO } = args;
  const fallback = { ...gas, carsTouched: null };
  if (basis !== 'cars-touched' || windowStartMs == null || windowEndMs == null) return fallback;

  const touched = await fetchCarsTouched({ userId, dayStartISO, dayEndISO, windowStartMs, windowEndMs });
  const carsTouched = resolveNumerator('cars-touched', snapshot.cleaned, touched);
  if (carsTouched == null) return fallback;
  return { ...computeShiftRates({ ...snapshot, cleaned: carsTouched }), carsTouched };
}
