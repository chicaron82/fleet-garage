import { shiftDaysSince } from '../../lib/shiftDay';

/**
 * How long a facility issue has been open, as a "Today" / "Day N" label.
 * Reckoned in shift-days (4 AM cutover) via shiftDaysSince, so it advances at
 * the boundary like the rest of the app instead of on the 24-hour anniversary
 * of when the issue was reported — the same calendar-vs-shift-day class the
 * Lost & Found relative-date fix collapsed.
 */
export function daysOpen(reportedAt: string, now?: Date): string {
  const days = shiftDaysSince(reportedAt, now);
  return days <= 0 ? 'Today' : `Day ${days}`;
}
