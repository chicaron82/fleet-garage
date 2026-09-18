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

// ⭐⭐ SHAPE FROM THE WEEKDAY, LEVEL FROM THIS WEEK (2026-09-17, `ticket-fleet-projection-anchor.md`).
//
// The same-weekday average carries real signal about the DAY — it beats a flat trailing mean on MAE,
// which is why it stays. But four same-weekdays reach FOUR WEEKS back, so it also carries that
// month's volume LEVEL, and the level moves (mean OUT 69.8 → 94.4 across the period). It was
// answering *"what is a Friday like?"* with last month's idea of how big a day is — a persistent
// −5.0 on OUT.
//
// So the weekday average is blended with the last few DAYS: the weekday half says what kind of day
// it is, the recent half says how big days are right now.
//
// ⭐ HOW THE SHAPE WAS CHOSEN (candidate sweep, every candidate scored on the same 81 days — scoring
// each over only the days IT can answer hands the fussiest model the easiest slice):
//
//   predictor                      OUT mae  OUT bias   IN mae  IN bias
//   same-weekday n≤4 (was)            17.5      −5.0     15.2     −3.3
//   trailing-7 only                   17.9      −1.6     15.7     −0.8
//   trailing-5 only                   17.4      −1.1     15.2     −0.5
//   50/50 weekday + trailing-5        15.8      −3.2     14.2     −2.3   ← chosen
//
// Swept w ∈ {0.3…0.7} × anchor ∈ {5,7,10}: w=0.5/anchor=5 ranked FIRST both over all history and
// over just since 2026-08-01, and the optimum is FLAT across w = 0.4–0.6 rather than a spike — both
// facts argue against a lucky fit.
//
// ⭐⭐ WHAT THIS FUNCTION ACTUALLY MEASURES, replayed after it was written (the numbers above are a
// prototype's; these are THIS code's, which is the only pair worth quoting):
//
//   window                  OUT mae         IN mae        OUT bias      IN bias
//   all history (n=87)    18.5 → 16.9    15.3 → 14.4    −3.6 → −2.0  −2.5 → −1.5   (−7.4% sum)
//   since 2026-08-01 (28) 20.3 → 19.5    19.0 → 16.7    −1.1 → −1.0  −4.6 → −2.9   (−7.8% sum)
//
// ⚠️ Not oversold: 16.9 is still large on a ~95-car day, and no window rescues 2026-08-21 (135
// actual vs 71 estimated) or 2026-08-31 (52 vs 108). This buys ~7%, not clairvoyance.
//
// ⚠️ WEEKENDS ARE DELIBERATELY UNTOUCHED. The weekend tier is already `prior-7` — there is no
// weekday component to re-anchor, and blending prior-7 with prior-5 is a trailing average wearing a
// costume.

/** How many recent DAYS the level anchor averages. Measured: beat 7 and 10 in both windows. */
export const RECENT_ANCHOR = 5;
/** Weight on the same-weekday half. 0.5 measured best; the optimum is flat across 0.4–0.6. */
export const WEEKDAY_WEIGHT = 0.5;

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

// ⚠️ UNROUNDED. The blend below rounds ONCE, at the end — rounding each half first would throw
// away up to half a car per side before they are even combined.
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

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
    avgOut: Math.round(mean(rows.map(r => r.outCount))),
    avgIn:  Math.round(mean(rows.map(r => r.inCount))),
    label, basis,
  });

  // Weekends: the nearest days, not the nearest Saturdays — there simply are not enough Saturdays,
  // and a weekend leans on the week that just happened. Already a window; left as one.
  if (d === 0 || d === 6) {
    const prior = history.slice(-7);
    if (prior.length < 2) return null;
    return build(prior, `Based on the last ${prior.length} days`, `prior-7 n=${prior.length}`);
  }

  // ⭐ The last N same-weekdays (not every one ever recorded), re-anchored to the last few days.
  const sameDay = history.filter(e => dayOfWeek(e.date) === d).slice(-PROJECTION_WINDOW);
  if (sameDay.length >= 2) {
    const name = DAY_NAMES[d];
    // `sameDay` is a subset of `history`, so history.length >= 2 here and the anchor always exists.
    const recent = history.slice(-RECENT_ANCHOR);
    const mix = (pick: (e: BalanceEntry) => number) =>
      Math.round(mean(sameDay.map(pick)) * WEEKDAY_WEIGHT + mean(recent.map(pick)) * (1 - WEEKDAY_WEIGHT));
    return {
      avgOut: mix(e => e.outCount),
      avgIn:  mix(e => e.inCount),
      // The label says what it DID. The cautionary tale in this file's header is a label that
      // claimed a window it did not have, so a blend must read as a blend.
      label: `Half the last ${sameDay.length} ${name}s, half the last ${recent.length} days`,
      // ⚠️ A DISTINGUISHABLE basis is the only defence against reading accuracy off the stored
      // column and averaging two different models together — which is exactly how this ticket
      // started. Every change to this file must write a basis the next reader can separate.
      basis: `blend${WEEKDAY_WEIGHT} same-weekday ${name} n=${sameDay.length} + prior-${RECENT_ANCHOR} n=${recent.length}`,
    };
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
