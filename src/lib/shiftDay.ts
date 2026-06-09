// The operational "shift-day" does not roll over at midnight. During peak
// season, overtime runs past midnight — a 12:36 AM off-standard entry belongs
// to the shift that's still in progress, not the fresh calendar date. Every
// notion of "today" in the app flows through here so they all agree.

/** Local hour at which the shift-day rolls over. Work before this hour is
 *  attributed to the previous calendar day's shift. Must sit after the latest
 *  anyone is still logging work and before the earliest fresh clock-in. */
export const SHIFT_DAY_CUTOVER_HOUR = 4;

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** The business shift-date (YYYY-MM-DD, local) for an instant, rolling over at
 *  SHIFT_DAY_CUTOVER_HOUR rather than midnight. `offsetDays` shifts whole days
 *  off that anchor (-1 = the prior shift-day). */
export function shiftDateStr(offsetDays = 0, now: Date = new Date()): string {
  const d = new Date(now);
  d.setHours(d.getHours() - SHIFT_DAY_CUTOVER_HOUR);
  if (offsetDays) d.setDate(d.getDate() + offsetDays);
  return toLocalDateStr(d);
}

/** The business shift-date that an existing timestamp falls within. Use this to
 *  compare a stored timestamp (depart_time, logged_at, …) against a shift-date
 *  string instead of `.startsWith()` / `toLocaleDateString()`, which compare the
 *  raw calendar date and mis-bucket the 00:00–04:00 window. */
export function businessDateOf(ts: string | Date): string {
  return shiftDateStr(0, typeof ts === 'string' ? new Date(ts) : ts);
}

/** [start, end) ISO timestamps bracketing one business shift-day — cutover to
 *  cutover — for range queries over timestamp columns. */
export function shiftDayWindow(dateStr: string): { startISO: string; endISO: string } {
  const start = new Date(dateStr + 'T00:00:00');
  start.setHours(SHIFT_DAY_CUTOVER_HOUR);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

/** Cutover-aligned start timestamp for an open-ended (`.gte`-only) window. */
export function shiftDayStartISO(dateStr: string): string {
  return shiftDayWindow(dateStr).startISO;
}

// Midday UTC for a YYYY-MM-DD string — a DST-safe anchor for counting whole
// days between two shift-dates (noon is never near a DST transition).
function dateStrToUTCNoon(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 12);
}

/** Whole shift-days from an earlier instant's shift-date to now's shift-date —
 *  the count of 04:00 cutover boundaries crossed, not 24-hour spans. 0 = same
 *  shift-day ("today"), 1 = the prior shift-day ("yesterday"). Use this for
 *  held-age / relative-date reckoning so they advance at the boundary like the
 *  rest of the app, instead of on the 24-hour anniversary of the instant. */
export function shiftDaysSince(ts: string | Date, now: Date = new Date()): number {
  const from = dateStrToUTCNoon(businessDateOf(ts));
  const to   = dateStrToUTCNoon(shiftDateStr(0, now));
  return Math.round((to - from) / 86_400_000);
}
