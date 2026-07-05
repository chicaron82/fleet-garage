import { shiftDateStr, shiftDayStartISO } from './shiftDay';

/**
 * When to file a shift_board reminder so it surfaces on the NEXT shift and clears
 * the one after. The whiteboard auto-archives shift_board notes whose `created_at`
 * is strictly before the current shift-day's 04:00 cutover — so we stamp the
 * reminder's created_at at the NEXT shift-day's cutover: it isn't "before" that
 * day's threshold (so it survives and shows through that shift), and it clears at
 * the following cutover. Set tonight → shows tomorrow's shift → gone the day after.
 *
 * Cutover-aware (via shiftDateStr): a reminder set at 01:00 — still inside the
 * prior calendar day's running shift — files under that day+1's shift, not +2.
 */
export function reminderCreatedAtISO(now: Date = new Date()): string {
  return shiftDayStartISO(shiftDateStr(1, now));
}
