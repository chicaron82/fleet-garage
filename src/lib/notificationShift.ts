import { businessDateOf } from './shiftDay';
import { isFullDayShift } from '../types';
import type { ShiftType, UserRole } from '../types';

const OVERSIGHT_ROLES: UserRole[] = ['Branch Manager', 'Operations Manager', 'City Manager'];

/** Management oversight — always sees everything, regardless of shift. */
export function isOversightRole(role: UserRole): boolean {
  return OVERSIGHT_ROLES.includes(role);
}

/**
 * The business dates (YYYY-MM-DD) the user was rostered to actually work —
 * day-off / PTO / sick are excluded (they're not working those days).
 */
export function workingShiftDates(
  shifts: { userId: string; date: string; shiftType: ShiftType }[],
  userId: string,
): Set<string> {
  const dates = new Set<string>();
  for (const s of shifts) {
    if (s.userId === userId && !isFullDayShift(s.shiftType)) dates.add(s.date);
  }
  return dates;
}

/**
 * The ids of notifications that fired while the user was off-shift — i.e. on a
 * business day they weren't rostered to work. These are de-prioritized in the
 * feed (dimmed, not counted in the urgent badge), never hidden.
 *
 * `businessDateOf` maps the notification's timestamp to its business day, so a
 * 2am alert after a closing shift attributes back to that working day rather than
 * the calendar next-day. Oversight roles get an empty set (they see all). Fail-
 * open: with no roster loaded for the user (size 0), nothing is off-shift.
 */
export function offShiftNotifications(
  notifs: { id: string; created_at: string; recipient_user_id?: string | null }[],
  workingDates: Set<string>,
  role: UserRole,
  userId: string,
): Set<string> {
  if (isOversightRole(role) || workingDates.size === 0) return new Set();
  const off = new Set<string>();
  for (const n of notifs) {
    // A notification addressed directly to you (not a role broadcast) is
    // intentional — never dim it, even on a day off.
    if (n.recipient_user_id === userId) continue;
    if (!workingDates.has(businessDateOf(n.created_at))) off.add(n.id);
  }
  return off;
}
