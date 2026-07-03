import type { ShiftWithUser } from '../types';
import type { UserResolver } from './user-resolver';

// Re-resolve each shift's display user from its userId against the CURRENT
// profiles map. Pure, so it can back a render-time useMemo (no setState-in-effect)
// and be unit-tested directly.
//
// This is what fixes the load-order race: ScheduleContext.loadShifts maps rows
// through getProfile at fetch time, so a schedule that loads before the profiles
// map populates keeps an 'Unknown' name that never re-resolves. Deriving through
// this the moment `getProfile` sees the loaded profiles resolves the names with
// no refetch. Unchanged rows keep their identity so downstream memoization holds.
export function resolveShiftNames(
  shifts: ShiftWithUser[],
  getProfile: UserResolver['getProfile'],
): ShiftWithUser[] {
  return shifts.map(s => {
    const u = getProfile(s.userId);
    if (!u || (s.user.name === u.name && s.user.role === u.role)) return s;
    return { ...s, branchId: u.branchId ?? s.branchId, user: { name: u.name, role: u.role } };
  });
}
