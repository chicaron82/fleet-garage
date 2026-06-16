import type { LostFoundStatus } from '../types';
import { shiftDaysSince } from './shiftDay';

// One home for Lost & Found date/age reckoning. Previously `fmtRelativeDate`
// (and `fmtTime`) were copy-pasted into LostFoundCard and LostAndFoundView, and
// both the relative label and the held-day counter measured elapsed 24-hour
// spans (`Math.floor(ms / 86_400_000)`) — which reads "Today" for anything in
// the last 24h and ticks on the found-instant anniversary rather than the day
// boundary. Everything here now reckons in shift-days (4 AM cutover) so it
// agrees with the rest of the app and the customer-property holding policy.

/** Time-of-day for a stored timestamp (e.g. "11:05 AM") — the part that was
 *  always correct and is kept verbatim. */
export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
}

/** "Today 11:05 AM" / "Yesterday 11:05 AM" / "Jun 1". The day part is reckoned
 *  in shift-days, so an item found on the previous shift-day reads "Yesterday"
 *  and flips at the cutover, not on the 24-hour anniversary of the found time. */
export function fmtRelativeDate(iso: string, now?: Date): string {
  const days = shiftDaysSince(iso, now);
  if (days <= 0) return `Today ${fmtTime(iso)}`;
  if (days === 1) return `Yesterday ${fmtTime(iso)}`;
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

/** Shift-days an item has been held — the "Day N" counter, advancing at the
 *  cutover rather than the 24-hour mark. */
export function daysHeld(foundAt: string, now?: Date): number {
  return shiftDaysSince(foundAt, now);
}

export type AgeTier = 'fresh' | 'aging' | 'expired';

/** Holding-age tier driving the escalation treatment: fresh < 15 ≤ aging < 30 ≤
 *  expired. Returned items have no tier. Takes the already-computed held count so
 *  a caller showing "Day N" doesn't reckon it twice. */
export function ageTier(status: LostFoundStatus, days: number): AgeTier | null {
  if (status === 'returned' || status === 'disposed') return null;
  return days >= 30 ? 'expired' : days >= 15 ? 'aging' : 'fresh';
}
