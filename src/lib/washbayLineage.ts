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
