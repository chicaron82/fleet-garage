import type { HandoffNote, WashbayLog } from '../types';
import { businessDateOf } from './shiftDay';

/**
 * Was airport "flipping returns" already attested for shift-day `date` before the
 * closing lead opens their log — via the morning handoff or an earlier washbay log?
 * Drives the carry-over pre-check on the closing flipping box, so the lead just
 * confirms it rather than re-entering it (excludes the live OTH signal, which is a
 * hook). Handoff timestamps map through businessDateOf, so a post-midnight handoff
 * stays on the shift-day it belongs to instead of leaking onto the next one.
 */
export function priorFlippingAttested(
  handoffNotes: HandoffNote[],
  todayLog: WashbayLog | undefined,
  date: string,
): boolean {
  return handoffNotes.some(h => businessDateOf(h.loggedAt) === date && h.airportFlipping)
    || (todayLog?.airportFlipping ?? false);
}
