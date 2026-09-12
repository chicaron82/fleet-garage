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

export interface RosterMember { id: string; name: string; role: UserRole; utility?: boolean }

/**
 * Self first, then grouped by role, then UTILITY, then alphabetical inside each group.
 *
 * ⭐ Self stays pinned — that was already true and it is the one row he looks for by position rather
 * than by name. Everything after it is now findable by ROLE, which is how the filter bar above it
 * already taught him to read the screen.
 *
 * ⭐⭐ UTILITY SORTS TO THE TOP OF ITS GROUP, AND THE REASON IS THE SHADING (Aaron, 2026-09-12, after
 * a close):
 *
 *   *"having larry (utility) shaded i accidentally stopped reading and missed the second driver
 *    starting in the morning… can we have larry displayed first on the drivers so that his shaded
 *    schedule looks like the boundary that separates the VSA and drivers?"*
 *
 * ⚠️⚠️ A SHADED ROW IN THE MIDDLE OF A LIST READS AS THE END OF THE LIST. Larry C sorted
 * alphabetically — between Krish and Larry J — so his slate band landed mid-block and his eye took it
 * for a terminator. He stopped reading and missed a driver who was on at 07:00. Same failure family
 * as the bug this file was created for: **the grid's visual order made a claim the data never made.**
 *
 * ⭐ The fix is not to remove the shading but to MOVE it. At the top of the drivers it stops being a
 * full stop and becomes a seam — the divider between the floor block and the driver block, which is
 * exactly how he was already reading it.
 *
 * ⚠️ It has real-world stakes, not just tidiness: that missed row was a body. He cleared three
 * employee parking spots for the morning on a lot with no room, and the morning actually has four
 * people on it.
 */
export function orderRoster<T extends RosterMember>(members: readonly T[], selfId?: string): T[] {
  return [...members].sort((a, b) => {
    if (a.id === selfId) return -1;
    if (b.id === selfId) return 1;
    const r = rosterRank(a.role) - rosterRank(b.role);
    if (r !== 0) return r;
    // Utility ahead of the rest of its own group — the shaded row becomes the group's header edge.
    if (!!a.utility !== !!b.utility) return a.utility ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * ⭐⭐⭐ IS THE DRIVER BLOCK BLANK BECAUSE NOBODY IS ON, OR BECAUSE FG HAS NOT BEEN GIVEN IT?
 *
 * Aaron, 2026-09-06: *"the driver's get there's weekly. and i won't see it until i go to work on
 * tuesday."* The VSAs come as a **four-week block**; the drivers come **a week at a time**, and it
 * reaches him at the branch. So **every forward week has an empty driver block by design** — it will
 * look like this every Sunday night he opens the app, permanently.
 *
 * ⚠️ FG already has the rule this breaks, written down for attendance: **unmarked ≠ absent.** An
 * unobserved person is not a no-show. The same blankness in the schedule grid reads as *"not
 * working"*, when what it means is *"not posted yet"*. **A row that says nothing is not saying
 * nothing — it is saying the wrong thing**, and it is the same blankness that buried two VSAs.
 */
export function driverBlockUnloaded<T extends RosterMember>(
  members: readonly T[], hasAnyShift: (m: T) => boolean,
): boolean {
  const drivers = members.filter(m => m.role === 'Driver');
  return drivers.length > 0 && !drivers.some(hasAnyShift);
}
