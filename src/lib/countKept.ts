// Is Erin St's count being kept right now? The read-only page's answer (docs/ticket-lot-view-count-not-kept.md).
//
// ⭐ Aaron, 2026-11-05: *"how bougie would it be for it to detect activity? turning on automatically at my first clean
// (if not already on) and if i haven't had any cleaning done in 2h, it flips off"*. So nothing is switched: the count is
// KEPT while anything has happened in the last 2 h, and the page says so plainly when it isn't. Any tap counts, not just
// a Clean: every count tap stamps cleans_at or dirties_at ("used" too), and every bay-log start and exit is his hand.
//
// It never reads `shifts`: the read-only link gets forwarded, and it must not tell anyone his hours.
//
// ⭐ ON BREAK (2026-11-05, migration 166, docs/ticket-lot-bay-on-break.md): *"since i'm off the floor the count would be
// inaccurate. a heads up on the read-only side?"*. A break holds only while nothing has happened since it began, so any
// tap ends it with nothing to clear; his Back clears it outright. Pressing On break is his hand too, so it starts the
// 2 h clock: a break he never comes back from turns into "not being kept" 2 h later.
import type { LotBay } from './lotBay';
import type { BayLogRow } from './lotBayLog';

/** His number: 2 h without a tap and the count is no longer being kept. */
export const COUNT_KEPT_MS = 2 * 60 * 60_000;

/** The latest thing that happened to the count or in the bay, or null if nothing ever has. */
export function lastActivity(bay: Pick<LotBay, 'cleansAt' | 'dirtiesAt'> | null, rows: Pick<BayLogRow, 'started_at' | 'exited_at'>[]): string | null {
  let best: string | null = null, bestMs = -Infinity;
  const consider = (at: string | null | undefined) => {
    if (!at) return;
    const ms = Date.parse(at);
    if (Number.isFinite(ms) && ms > bestMs) { best = at; bestMs = ms; }
  };
  consider(bay?.cleansAt);
  consider(bay?.dirtiesAt);
  for (const r of rows) { consider(r.started_at); consider(r.exited_at); }
  return best;
}

/** Kept = something happened within the last 2 h. Never touched at all = not kept. */
export function isCountKept(last: string | null, nowMs: number): boolean {
  if (!last) return false;
  return nowMs - Date.parse(last) <= COUNT_KEPT_MS;
}

/** He's on break: one was started, and nothing has happened since. */
export function isOnBreak(breakAt: string | null | undefined, last: string | null): boolean {
  if (!breakAt) return false;
  return !last || Date.parse(breakAt) >= Date.parse(last);
}

/** The last time he touched it at all, a break included: what the 2 h clock runs from. */
export function lastHand(last: string | null, breakAt: string | null | undefined): string | null {
  if (!breakAt) return last;
  if (!last) return breakAt;
  return Date.parse(breakAt) > Date.parse(last) ? breakAt : last;
}
