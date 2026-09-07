import type { UserRole } from '../types';
import { SCHEDULE_GROUPS } from './scheduleGroups';

/**
 * ⭐⭐⭐ THE ORDER THE SCHEDULE GRID LISTS PEOPLE IN — floor, then counter, then drivers.
 *
 * Aaron, 2026-09-06, reading Monday off the live schedule:
 *
 *   *"when i looked at tomorrow's schedule and saw only erick closing by himself i had to question
 *    it, it wasn't until i scrolled further after the blank driver block that i saw the other two
 *    VSA listed."*
 *
 * ⚠️⚠️ **THE GRID HAD NO ORDER AT ALL.** `WeekView` listed *self, then everyone else* in whatever
 * sequence `useTeamMembers` happened to hold — which is `Array.from(profiles.values())`, i.e.
 * Supabase's return order. So two VSAs sat **below thirteen empty driver rows**, and a closing shift
 * with two people on it read as one person alone. **A roster that is merely unsorted is not neutral;
 * it makes claims.**
 *
 * ⭐⭐ AND THE ORDER ALREADY EXISTED. `SCHEDULE_GROUPS` — floor / counter / drivers — is what the
 * filter bar directly above this grid is built from. The grouping was one import away and the grid
 * never asked for it. (Third time in one evening that knowledge sat in a file and did not reach the
 * moment it was needed.)
 */
export function rosterRank(role: UserRole): number {
  const i = SCHEDULE_GROUPS.findIndex(g => g.roles.includes(role));
  // ⚠️ Managers are deliberately absent from SCHEDULE_GROUPS. They still sort — after the crew,
  //    never interleaved into it — because an unranked row would land wherever Supabase put it,
  //    which is the bug this file exists to remove.
  return i === -1 ? SCHEDULE_GROUPS.length : i;
}

export interface RosterMember { id: string; name: string; role: UserRole }

/**
 * Self first, then grouped by role, then alphabetical inside each group.
 *
 * ⭐ Self stays pinned — that was already true and it is the one row he looks for by position rather
 * than by name. Everything after it is now findable by ROLE, which is how the filter bar above it
 * already taught him to read the screen.
 */
export function orderRoster<T extends RosterMember>(members: readonly T[], selfId?: string): T[] {
  return [...members].sort((a, b) => {
    if (a.id === selfId) return -1;
    if (b.id === selfId) return 1;
    const r = rosterRank(a.role) - rosterRank(b.role);
    return r !== 0 ? r : a.name.localeCompare(b.name);
  });
}
