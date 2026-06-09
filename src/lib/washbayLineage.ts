import { shiftDateStr } from './shiftDay';

/**
 * The closing log for the prior shift-day, if one exists — what the morning
 * handoff inherits its carry-over backlog from.
 *
 * Keyed on `shiftDateStr(-1)` (cutover-aware), so it agrees with the opener
 * backfill writer that stamps the same prior shift-date, and fixes the
 * post-midnight case the old calendar `localDateStr(-1)` lookup mis-bucketed
 * (a close that ran past midnight belongs to the shift that's still in progress,
 * not the fresh calendar date).
 */
export function findPriorShiftLog<T extends { date: string }>(
  logs: T[],
  now: Date = new Date(),
): T | undefined {
  const priorDate = shiftDateStr(-1, now);
  return logs.find(l => l.date === priorDate);
}

/**
 * Whether a washbay log carries only the prior shift's carry-over (a lightweight
 * opener backfill) rather than a real close. Its gas-sheet counters are zero — and
 * a real close can never look like this, because the closing form refuses to
 * submit with zero cars on the sheet (`carsIn > 0`). Such rows have no throughput,
 * so they must stay out of the "recent log" / week-average throughput displays
 * (the carry-over lineage still reads their `carsRemaining`).
 */
export function isCarryOverOnly(log: { fullPages: number; lastPageEntries: number }): boolean {
  return log.fullPages === 0 && log.lastPageEntries === 0;
}
