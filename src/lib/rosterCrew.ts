// My Day's "On shift now" × the crew line (lot_crew, migration 154): the box on a VSA's or a driver's pill. Pure.
// (docs/ticket-myday-crew-checkbox-and-grid.md)
//
// ⭐ His idea, 2026-10-18: *"just adding a check box to the VSA and driver names. so tapping the still does what it
// normally does, present or sick. but when marking as present the checkbox ticks as well. they're doing what they're
// normally doing. if pulled from cleaning or driving then uncheck"*. And *"stay empty until marked present"*.
//
// The crew line already reads attendance: a no-show is OUT there by itself (api/_lib/lotCrew.ts crewOf). A crew MARK
// wins over that, so any attendance tap on someone who carries a mark clears it, and their state follows the tap again.
import { isFullDayShift, type Attendance, type Shift } from '../types';
import type { CrewState } from './lotCrew';
import type { RoleGroup } from './rosterGrouping';

/** The two groups that carry a box, and what ticked / unticked mean for each. */
const USUAL: Partial<Record<RoleGroup, CrewState>> = { vsa: 'cleaning', driver: 'airport' };
const PULLED: Partial<Record<RoleGroup, CrewState>> = { vsa: 'moving', driver: 'other' };

export const hasBox = (g: RoleGroup): boolean => g in USUAL;

/** 'off' = not marked present yet (empty, faint); 'on' = present and on the usual job; 'pulled' = present, pulled;
 *  'unknown' = present, but the crew line hasn't answered yet (a cold open): never shown as 'on' before it is known. */
export type BoxState = 'off' | 'on' | 'pulled' | 'unknown';

/** The person's crew line entry as My Day needs it: their state today and whether HE set it. */
export interface CrewEntry { state: CrewState; marked: boolean }

export function boxOf(group: RoleGroup, attendance: Attendance | undefined, crew: CrewEntry | undefined, known = true): BoxState {
  if (attendance !== 'present') return 'off';
  // ⚠️ His test, 2026-10-18 17:00: back on My Day, a pulled VSA showed "present/cleaning for a brief second before
  // correcting itself". Attendance arrives with the schedule; the crew line is its own fetch. Until it answers, say so.
  if (!known) return 'unknown';
  return crew?.marked && crew.state === PULLED[group] ? 'pulled' : 'on';
}

/** What a box tap writes: on → pulled; pulled → back to the default. Nothing for a box that is off. */
export function crewWriteForBox(group: RoleGroup, box: BoxState): CrewState | 'clear' | null {
  // 'off' and 'unknown' write nothing: a box that isn't sure can't be toggled into a guess.
  if (box === 'on') return PULLED[group] ?? null;
  if (box === 'pulled') return 'clear';
  return null;
}

/** What a NAME tap writes to the crew line: clear their mark, if they carry one, so the new attendance shows through. */
export function crewWriteForAttendance(group: RoleGroup, crew: CrewEntry | undefined): 'clear' | null {
  return hasBox(group) && crew?.marked ? 'clear' : null;
}

/** Lot Lookout → My Day (2026-10-18, his "triple yes"): a crew chip there marks the person on My Day too. Out is a
 *  no-show; every other choice (a job, or back to the default) means they are here. */
export function attendanceForCrew(next: CrewState | 'clear'): Attendance {
  return next === 'out' ? 'absent' : 'present';
}

/** Today's working shift rows for these people whose attendance is not already `to`: the writes My Day needs. */
export function shiftsToMark(today: readonly Pick<Shift, 'id' | 'userId' | 'shiftType' | 'attendance'>[], users: readonly string[], to: Attendance): string[] {
  return today.filter(s => users.includes(s.userId) && !isFullDayShift(s.shiftType) && s.attendance !== to).map(s => s.id);
}
