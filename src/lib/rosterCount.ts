import type { Attendance, ShiftType, UserRole } from '../types';

const VSA_ROLES: UserRole[] = ['VSA', 'Lead VSA'];

type CountableShift = {
  userId: string;
  date: string;
  shiftType: ShiftType;
  user: { role: UserRole };
  attendance?: Attendance;
};

// Count distinct VSA / Lead-VSA users rostered on `date` for the given shift
// window(s). `excludeAbsent` drops anyone marked 'absent' (no-show/sick).
function countVsas(shifts: CountableShift[], date: string, windowTypes: ShiftType[], excludeAbsent: boolean): number {
  const ids = new Set<string>();
  for (const s of shifts) {
    if (s.date !== date || !windowTypes.includes(s.shiftType) || !VSA_ROLES.includes(s.user.role)) continue;
    if (excludeAbsent && s.attendance === 'absent') continue;
    ids.add(s.userId);
  }
  return ids.size;
}

/**
 * How many VSAs are ROSTERED on `date` for the given window(s) — the plain roster
 * count, shown as "roster shows N". Ignores attendance (the schedule, not who
 * actually showed). Opening pulls the opening crew, the close pulls the closers.
 */
export function rosteredVsaCount(shifts: CountableShift[], date: string, windowTypes: ShiftType[]): number {
  return countVsas(shifts, date, windowTypes, false);
}

/**
 * How many rostered VSAs are actually PRESENT — the roster minus anyone marked
 * 'absent' (no-show/sick) on the My-Day pills. The sensible DEFAULT for a washbay
 * log's team size (cars ÷ team-hours), so the throughput rate divides by who
 * actually showed, not who was scheduled. Unmarked (scheduled) still counts, so
 * before any attendance is marked this equals the full roster.
 */
export function presentVsaCount(shifts: CountableShift[], date: string, windowTypes: ShiftType[]): number {
  return countVsas(shifts, date, windowTypes, true);
}
