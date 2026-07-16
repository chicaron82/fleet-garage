// Pure schedule helpers, extracted from ScheduleContext (near-cap extraction,
// docs/ticket-near-cap-file-extractions.md): date keys, week windows, shift
// labels, the row→shift mapper factory, and the manager-edit predicate. Pure
// logic → a lib; the provider keeps the state + IO.
import { rowToShiftBase } from './rowToShift';
import { canManageSchedule } from '../types';
import type { BranchId, Profile, ShiftWithUser, ShiftType, UserRole } from '../types';

/** Local-date ISO key (`YYYY-MM-DD`) — NOT toISOString(), which would UTC-shift the day. */
export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The Monday-start week containing `date` (Sunday belongs to the week it ends). */
export function getWeekBounds(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const dow = d.getDay(); // 0=Sun
  const toMon = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + toMon);
  const start = new Date(d);
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  return { start, end };
}

export function formatShiftLabel(shiftType: ShiftType, date: string): string {
  const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-CA', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
  const typeLabel = shiftType === 'day-off' ? 'Day Off'
    : shiftType === 'pto'  ? 'PTO'
    : shiftType === 'sick' ? 'Sick Day'
    : `${shiftType.charAt(0).toUpperCase() + shiftType.slice(1)} shift`;
  return `${typeLabel} on ${dayLabel}`;
}

export function isManagerEditingOtherUser(role: UserRole, actingId: string, targetUserId: string): boolean {
  return canManageSchedule(role) && actingId !== targetUserId;
}

export function buildRowToShift(resolveUser: (id: string) => Profile | null) {
  return function rowToShift(row: Record<string, unknown>): ShiftWithUser {
    const u = resolveUser(row.user_id as string);
    return {
      ...rowToShiftBase(row),
      branchId: (u?.branchId ?? 'YWG') as BranchId,
      user: { name: u?.name ?? 'Unknown', role: (u?.role ?? 'VSA') as UserRole },
    };
  };
}
