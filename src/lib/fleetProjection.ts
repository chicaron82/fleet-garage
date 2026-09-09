// What the fleet-balance card estimates for a day, from the days before it.
//
// ⭐ EXTRACTED FROM `useFleetBalance` so the rule is testable and REPLAYABLE. That is not tidiness:
// the whole reason this ticket exists is that the estimate was only ever recoverable by re-running
// the code, and code changes. A pure function of (target date, prior entries) can be replayed over
// any history, which is how the window below was chosen and how the backfill was produced.
//
// ⚠️⚠️ THE OLD RULE TOOK AN ALL-TIME MEAN WHILE ITS LABEL SAID "10-Tuesday avg". Anyone reading
// the card would assume it adapted; `n` was simply how many Tuesdays existed. The fleet grew
// (mean OUT 69.8 → 94.4 across the period) and **every quiet Tuesday from April dragged today's
// number down, permanently** — so it did not merely miss, it missed LOW, by −10.7 cars on average
// across 78 replayed days, and was getting worse, not better.
//
// Measured on that replay, varying only the slice:
//
//   window      OUT mae   OUT bias
//   all-time      21.2      −10.7   ← what shipped for months
//   last 8        20.1       −7.5
//   last 6        18.8       −5.6
//   last 4        17.7       −3.6   ← the knee
//   last 3        17.8       −2.5   (more bias shaved, accuracy starts costing)
//
// ⚠️ Stated so the number is not oversold: 17.7 is still large, and no window rescues 2026-08-21
// (135 actual vs 71 estimated) or 2026-08-31 (52 vs 108). Per Aaron the balance is a SNAPSHOT that
// drifts from the moment it is written — the model can only be as good as a Tuesday is like other
// Tuesdays.

/** How many same-kind days the average looks back over. The knee of the error curve, measured. */
export const PROJECTION_WINDOW = 4;

export interface BalanceEntry { date: string; outCount: number; inCount: number }

export interface FleetProjection {
  avgOut: number;
  avgIn: number;
  /** Shown on the card. Says what it actually did — see the note above about the label that lied. */
  label: string;
  /** Stored with the entry, so accuracy stays measurable after any future change to this file. */
  basis: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** JS `getDay()` semantics — Sunday 0 … Saturday 6 — read off a plain YYYY-MM-DD. */
export function dayOfWeek(date: string): number {
  return new Date(date + 'T00:00:00').getDay();
}

const mean = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) / xs.length);

/**
 * Estimate `target` from `history`.
 *
 * ⚠️ `history` MUST be ascending and must not contain `target` itself — every window here takes a
 * tail slice, so order is load-bearing rather than cosmetic. Returns null when there is too little
 * history to say anything, which is a real answer and not a zero.
 */
export function projectFleetBalance(target: string, history: readonly BalanceEntry[]): FleetProjection | null {
  const d = dayOfWeek(target);
  const build = (rows: readonly BalanceEntry[], label: string, basis: string): FleetProjection => ({
    avgOut: mean(rows.map(r => r.outCount)),
    avgIn:  mean(rows.map(r => r.inCount)),
    label, basis,
  });

  // Weekends: the nearest days, not the nearest Saturdays — there simply are not enough Saturdays,
  // and a weekend leans on the week that just happened. Already a window; left as one.
  if (d === 0 || d === 6) {
    const prior = history.slice(-7);
    if (prior.length < 2) return null;
    return build(prior, `Based on the last ${prior.length} days`, `prior-7 n=${prior.length}`);
  }

  // ⭐ THE FIX: the last N same-weekdays, not every one ever recorded.
  const sameDay = history.filter(e => dayOfWeek(e.date) === d).slice(-PROJECTION_WINDOW);
  if (sameDay.length >= 2) {
    const name = DAY_NAMES[d];
    return build(sameDay, `Based on the last ${sameDay.length} ${name}s`,
                 `same-weekday ${name} n=${sameDay.length}`);
  }

  // Fallback for a weekday with almost no history of its own. ⚠️ This carried the SAME unbounded
  // flaw and is capped too — it fires early in a history, which is exactly when a stale mean does
  // the most damage per data point.
  const weekdays = history.filter(e => { const w = dayOfWeek(e.date); return w >= 1 && w <= 5; })
                          .slice(-PROJECTION_WINDOW);
  if (weekdays.length < 2) return null;
  return build(weekdays, `Based on the last ${weekdays.length} weekdays`,
               `weekday-fallback n=${weekdays.length}`);
}
