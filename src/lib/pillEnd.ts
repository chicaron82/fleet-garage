// Tap the header pill to END the session (docs/ticket-pill-tap-ends-session.md). Aaron, 2026-11-09: *"What if instead
// of tapping it to take me to where I need to stop/end it, just end it on tap since that's really what I need to do"*,
// and *"Would also be the same for movement log when making trips to the airport"*.
// Pure: what one tap does to a running trip or off-standard timer, read from its own row. Anything the card would have
// asked about opens the card instead, as the pill did before.
import { TRIP_DURATION_THRESHOLDS } from './vsa-trip';
import { OTH_MIN_ENTRY_MINUTES } from './activeSessions';

/** How long the pill holds an end for Undo before anything is written. */
export const PILL_UNDO_MS = 5000;

export type PillPlan =
  | { kind: 'open' }
  /** `chip`: the pill's own short text while it holds (as narrow as the pill, for the 412 header: the word "not
   *  logged" comes after, as the end lands); `label`: the same, said in full for a screen reader. */
  | { kind: 'end'; logs: boolean; minutes: number; chip: string; label: string };

const OPEN: PillPlan = { kind: 'open' };

/**
 * A trip ends as **Back at Washbay**: 57 of his 57 completed trips in the 45 days to 2026-11-09 ended that way. Under the
 * short threshold the card asks "Log it, or delete it?" (usually a mis-tap), and with no authorization it cannot end;
 * both open the card.
 */
export function tripPillPlan(row: { depart_time: string; auth_type: string | null }, nowMs: number): PillPlan {
  const exact = (nowMs - Date.parse(row.depart_time)) / 60000;
  if (!(exact >= TRIP_DURATION_THRESHOLDS.short) || !row.auth_type) return OPEN;
  const minutes = Math.round(exact);
  return { kind: 'end', logs: true, minutes, chip: `✓ ${minutes}m`, label: `Trip ended, back at Washbay, ${minutes} minutes` };
}

/**
 * An off-standard timer ends as its End does: logged at 5 minutes and up, thrown away under (and the chip says so).
 * EDV opens the card: its End needs the plate and the interior / exterior, or the hold it links.
 */
export function othPillPlan(row: { start_time: string; preset_reason: string | null }, nowMs: number): PillPlan {
  if (row.preset_reason === 'edv') return OPEN;
  const minutes = Math.round((nowMs - Date.parse(row.start_time)) / 60000);
  if (!Number.isFinite(minutes)) return OPEN;
  const logs = minutes >= OTH_MIN_ENTRY_MINUTES;
  return logs
    ? { kind: 'end', logs, minutes, chip: `✓ ${minutes}m`, label: `Off-standard ended, ${minutes} minutes` }
    : { kind: 'end', logs, minutes, chip: `✕ ${minutes}m`, label: `Under ${OTH_MIN_ENTRY_MINUTES} minutes, so it is not logged` };
}
