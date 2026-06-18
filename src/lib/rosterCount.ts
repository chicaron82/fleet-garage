import type { ShiftType, UserRole } from '../types';

const VSA_ROLES: UserRole[] = ['VSA', 'Lead VSA'];

/**
 * How many VSAs are rostered on `date` for the given shift window(s) — the
 * sensible default for a washbay log's team size (cars ÷ team-hours). Counts
 * distinct VSA / Lead-VSA users; non-VSA roles and other shift types are ignored,
 * so the opening handoff pulls the opening crew and the close pulls the closers.
 */
export function rosteredVsaCount(
  shifts: { userId: string; date: string; shiftType: ShiftType; user: { role: UserRole } }[],
  date: string,
  windowTypes: ShiftType[],
): number {
  const ids = new Set<string>();
  for (const s of shifts) {
    if (s.date === date && windowTypes.includes(s.shiftType) && VSA_ROLES.includes(s.user.role)) {
      ids.add(s.userId);
    }
  }
  return ids.size;
}
