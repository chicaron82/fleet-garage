import { getTypeDefaults } from './shiftDefaults';
import { isFullDayShift } from '../types';
import type { ShiftType, UserRole } from '../types';

const OVERSIGHT_ROLES: UserRole[] = ['Branch Manager', 'Operations Manager', 'City Manager'];

/** Management oversight — always sees everything, regardless of shift. */
export function isOversightRole(role: UserRole): boolean {
  return OVERSIGHT_ROLES.includes(role);
}

/**
 * Grace (minutes) padding each shift window on both ends — an alert this far
 * before shift-start (commuting in) or after shift-end (wrapping up) still counts
 * as on-shift. Aaron, 2026-06-18.
 */
export const SHIFT_GRACE_MIN = 30;

interface RosterShift { userId: string; date: string; shiftType: ShiftType; }

/**
 * The absolute-time [start, end] bounds (epoch ms) of a worked shift on its date,
 * padded by `graceMin`. Built in local time — same frame `businessDateOf` works
 * in — so comparing against a notification's `getTime()` is timezone-agnostic
 * (both are absolute instants). Full-day types (day-off / pto / sick) have no
 * window → null.
 */
function shiftWindowMs(
  date: string, shiftType: ShiftType, isPeakSeason: boolean, graceMin: number,
): { start: number; end: number } | null {
  if (isFullDayShift(shiftType)) return null;
  const def = getTypeDefaults(isPeakSeason)[shiftType];
  if (!def.start || !def.end) return null;
  const g = graceMin * 60_000;
  return {
    start: new Date(`${date}T${def.start}:00`).getTime() - g,
    end:   new Date(`${date}T${def.end}:00`).getTime()   + g,
  };
}

/**
 * Notification ids that fired while the user was OFF their shift window — either
 * on a day they didn't work, OR outside the working hours (± grace) of a day they
 * did. These dim + drop from the urgent badge; never hidden.
 *
 * **Time-of-day, not just day-level** (v1 was day-only): a 2am alert after a 10pm
 * close now reads off-hours and dims — where v1's `businessDateOf` attribution
 * counted it back onto the worked day. That attribution is gone; the decision is
 * now a direct "was this instant inside any of the user's shift windows?". A split
 * day's two shifts union their windows.
 *
 * Preserved from v1: oversight roles see everything; fail-open when no worked
 * shift is loaded; a direct ping (`recipient_user_id`) is never dimmed.
 */
export function offShiftNotifications(
  notifs: { id: string; created_at: string; recipient_user_id?: string | null }[],
  shifts: RosterShift[],
  userId: string,
  role: UserRole,
  isPeakSeason: boolean,
  graceMin: number = SHIFT_GRACE_MIN,
): Set<string> {
  if (isOversightRole(role)) return new Set();
  const windows = shifts
    .filter(s => s.userId === userId)
    .map(s => shiftWindowMs(s.date, s.shiftType, isPeakSeason, graceMin))
    .filter((w): w is { start: number; end: number } => w !== null);
  if (windows.length === 0) return new Set(); // fail-open: no roster / no worked shifts
  const off = new Set<string>();
  for (const n of notifs) {
    // A notification addressed directly to you (not a role broadcast) is
    // intentional — never dim it, even off-hours.
    if (n.recipient_user_id === userId) continue;
    const t = new Date(n.created_at).getTime();
    if (!windows.some(w => t >= w.start && t <= w.end)) off.add(n.id);
  }
  return off;
}
