import { shiftDateStr } from './shiftDay';
import type { LotStatus } from '../types';

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

/**
 * The payload for an opener backfill — a lightweight prior-shift close recording
 * only how many dirties were left in the queue (`carsRemaining`) so the morning
 * washbay rate inherits a baseline. Written stamped to `shiftDateStr(-1)`. Every
 * gas-sheet counter is zero, so `isCarryOverOnly` keeps it out of throughput
 * displays while the lineage still reads its `carsRemaining`. Shared by the
 * handoff form's "no closing log" recovery and the My-Day opening-lot card, so
 * both write the identical shape.
 */
export function buildBackfillClose(carsRemaining: number) {
  return {
    fullPages: 0,
    lastPageEntries: 0,
    carsRemaining,
    cleanNotPickedUp: 0,
    nonRentablesFuelled: 0,
    deferredCompletions: 0,
    nonRentablesNote: null,
    carryOver: 0,
    teamSize: 1,
    shiftHours: 8,
    overtimeHours: 0,
    lotStatus: (carsRemaining > 0 ? 'manageable' : 'zeroed') as LotStatus,
    airportFlipping: false,
  };
}
