// Which question is the throughput number answering — the BAY's day, or HIS shift?
//
// ⭐ Aaron, 2026-09-11, after an opening: *"so i logged 54 cars and my throughput for my shift was
// 57. that's pretty close. what if we had the option to choose which i can base throughput from.
// cars logged on shift, vs the math version off the gas sheet. only counting things done within my
// window."*
//
// One number has been answering two different questions:
//
//   gas-sheet   what the BAY shipped today — `sentToFleet` (pages − remaining − non-rentables
//               + deferred), a DAY figure that `buildShiftPartition` then slices to a shift.
//   cars-touched  what HE did on HIS shift — distinct vehicles he changed inside his window.
//
// ⚠️⚠️ THE TWO HAVE DIFFERENT SHAPES AND THAT IS THE WHOLE INTEGRATION. The gas-sheet basis is a
// day number that must be partitioned; cars-touched is ALREADY shift-scoped, because the window is
// in the query. So it does not go through the partition at all — it replaces the numerator after
// the fact. Routing it through `buildShiftPartition` would slice an already-sliced number.
//
// ⚠️ It is a PERSONAL record. Management does not use FG and is not collecting off-standard —
// *"its my own personal record."* Nothing here chases what anyone upstairs would want to see.
//
// Pure. The caller does the query; this decides what the rows mean.

export type ThroughputBasis = 'gas-sheet' | 'cars-touched';

/** Unambiguous on the card — it must never be guessable which question is being answered. */
export const BASIS_LABEL: Record<ThroughputBasis, string> = {
  'gas-sheet':    'Gas sheet',
  'cars-touched': 'Cars I touched',
};

export const BASIS_HINT: Record<ThroughputBasis, string> = {
  'gas-sheet':    'What the bay shipped today, split to your shift',
  'cars-touched': 'Vehicles you changed inside your shift window',
};

/** One row of the change log, narrowed to what the count needs. */
export interface TouchRow {
  vehicleId: string;
  /** Null on rows written before the actor column existed (migration 132) — never counted as his. */
  actor: string | null;
  changedAt: string;
}

export interface TouchedCount {
  /** Distinct vehicles HE changed inside the window — the number that becomes the numerator. */
  distinct: number;
  /** His change rows inside the window. Always ≥ `distinct`; the gap is repeat visits. */
  rows: number;
  /** ⚠️ His rows in the same fetch that fall OUTSIDE the window — surfaced, never silently dropped.
   *  Aaron's own asterisk: *"whatever we enter in for odo from tonight's gas sheets would have an
   *  asterisk added after (or in some cases maybe before) my shift."* */
  outsideWindow: number;
  /** Rows inside the window written by SOMEONE ELSE. Not counted; shown so a surprising number has
   *  a visible reason. */
  otherActors: number;
}

/**
 * ⭐ *"its what i touched during my shift. my last logged was 14:26."* — and the change log agreed
 * to the minute. Checked against his 2026-09-11 opening before the feature was written: sightings
 * gave 51 / 14:25, `vehicle_changes` gave **54 / 14:26**. Confirmed again on 2026-09-13: 88 rows,
 * 54 distinct, 553 ms.
 *
 * ⚠️⚠️ MUST FILTER BY ACTOR, and the trap is real rather than theoretical: on that same day a
 * SECOND actor wrote 4 changes at 18:41. Those fall outside an opening window, so a *windowed*
 * count is already safe — but a day-scoped, actor-blind count would fold another person's work into
 * his throughput, which is the exact failure this feature exists to prevent. Both filters, always.
 *
 * ⚠️ DISTINCT VEHICLES, not rows. A car he touches four times is one car through the bay — that is
 * what makes the number 54 rather than 88, and what makes it comparable to the gas-sheet figure.
 *
 * ⚠️ A null actor is never his. Rows predating migration 132 carry no actor, and counting them as
 * his would silently inflate historical shifts.
 */
export function countTouched(
  rows: readonly TouchRow[],
  actorId: string,
  windowStartISO: string,
  windowEndISO: string,
): TouchedCount {
  const start = Date.parse(windowStartISO);
  const end = Date.parse(windowEndISO);
  const seen = new Set<string>();
  let inWindow = 0, outsideWindow = 0, otherActors = 0;

  for (const r of rows) {
    const at = Date.parse(r.changedAt);
    if (Number.isNaN(at)) continue;
    const inside = at >= start && at <= end;
    if (r.actor !== actorId) { if (inside && r.actor) otherActors++; continue; }
    if (!inside) { outsideWindow++; continue; }
    inWindow++;
    seen.add(r.vehicleId);
  }
  return { distinct: seen.size, rows: inWindow, outsideWindow, otherActors };
}

/**
 * The numerator the card should show, given the choice.
 *
 * ⚠️ Returns null for `cars-touched` when the count has not loaded yet, rather than 0 — a zero here
 * reads as "you did nothing today", which is a lie the card would tell during every page load.
 * `null` is the existing "no shift data" state and already renders as a dash.
 */
export function resolveNumerator(
  basis: ThroughputBasis,
  gasSheetCleaned: number | null,
  touched: TouchedCount | null,
): number | null {
  return basis === 'cars-touched' ? (touched ? touched.distinct : null) : gasSheetCleaned;
}
