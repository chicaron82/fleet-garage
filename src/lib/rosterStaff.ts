import type { Profile, UserRole, BranchId } from '../types';

/**
 * A board-only staffer — a profile that exists purely so their schedule can be
 * entered (floor VSAs, drivers who never log into FG). Carries a generated UUID
 * (no auth.users row — see migration 082) and a deliberately fake `ROSTER-…`
 * employee id, so a roster ghost is instantly distinguishable from a real
 * employee in any list or export. Pure: the id is injected so it's testable.
 */
export function buildRosterStaff(
  input: { name: string; role: UserRole; branchId: BranchId },
  id: string = crypto.randomUUID(),
): Profile {
  return {
    id,
    name: input.name.trim(),
    role: input.role,
    branchId: input.branchId,
    employeeId: `ROSTER-${id.slice(0, 8).toUpperCase()}`,
    rosterOnly: true,
  };
}
