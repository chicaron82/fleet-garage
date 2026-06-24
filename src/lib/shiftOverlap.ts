// Pure time-overlap math for the schedule's "My Shift" filter: given the logged-in
// user's window on a day and a coworker's window on the same day, how many minutes
// do they actually share the floor? Day-off / PTO / sick carry no window (null
// times) and so never overlap.

interface Window {
  startTime?: string | null;
  endTime?: string | null;
}

function toMinutes(t: string): number {
  const [h, m] = t.split(':');
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

/**
 * Minutes two same-day shift windows overlap. Returns 0 if either side has no
 * window (a full-day type — day-off/PTO/sick — has null times) or they don't touch.
 */
export function overlapMinutes(a: Window, b: Window): number {
  if (!a.startTime || !a.endTime || !b.startTime || !b.endTime) return 0;
  const start = Math.max(toMinutes(a.startTime), toMinutes(b.startTime));
  const end = Math.min(toMinutes(a.endTime), toMinutes(b.endTime));
  return Math.max(0, end - start);
}

/** Compact duration for the inline overlap badge: 390 → "6h30m", 120 → "2h", 45 → "45m". */
export function fmtOverlap(mins: number): string {
  if (mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}
