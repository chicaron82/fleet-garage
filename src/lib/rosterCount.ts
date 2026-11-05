import type { Attendance, ExtraBlock, ShiftType, UserRole } from '../types';
import { dayMinute } from './bayCrewBlocks';

const VSA_ROLES: UserRole[] = ['VSA', 'Lead VSA'];

type CountableShift = {
  userId: string;
  date: string;
  shiftType: ShiftType;
  user: { role: UserRole };
  attendance?: Attendance;
  endTime?: string;
  actualEndTime?: string;
  extraBlocks?: ExtraBlock[];
};

/**
 * ⭐ Came back for the close (docs/ticket-roster-counts-plus-block-at-close.md). Aaron, 2026-11-04: Ray out sick, he
 * opened, went home, and came back 18:00–21:00 to close with Khaiat. FG keeps that as a [+] block on his OPENING row,
 * so a count by shift type alone read *"roster shows 1"*. A [+] block is "asked back after going home", so one that
 * starts at or after the row's own end (logged end if logged) is a return trip into the evening: he is on the close.
 */
function cameBackForClose(s: CountableShift): boolean {
  const end = s.actualEndTime || s.endTime;
  return (s.extraBlocks ?? []).some(b => !!b.start && (!end || dayMinute(b.start) >= dayMinute(end)));
}

function inWindow(s: CountableShift, windowTypes: ShiftType[]): boolean {
  return windowTypes.includes(s.shiftType) || (windowTypes.includes('closing') && cameBackForClose(s));
}

// Count distinct VSA / Lead-VSA users rostered on `date` for the given shift
// window(s). `excludeAbsent` drops anyone marked 'absent' (no-show/sick).
function countVsas(shifts: CountableShift[], date: string, windowTypes: ShiftType[], excludeAbsent: boolean): number {
  const ids = new Set<string>();
  for (const s of shifts) {
    if (s.date !== date || !inWindow(s, windowTypes) || !VSA_ROLES.includes(s.user.role)) continue;
    if (excludeAbsent && s.attendance === 'absent') continue;
    ids.add(s.userId);
  }
  return ids.size;
}

/**
 * How many VSAs are ROSTERED on `date` for the given window(s) — the plain roster
 * count, shown as "roster shows N". Ignores attendance (the schedule, not who
 * actually showed). Opening pulls the opening crew, the close pulls the closers,
 * plus anyone asked back for the evening on a [+] block.
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
