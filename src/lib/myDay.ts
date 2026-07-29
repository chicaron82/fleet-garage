// Pure derivations for the "My Day" cockpit. Kept out of the component + hook so
// the shift/team/greeting logic is testable without React or context. The hook
// (useMyDay) assembles the live inputs; the view just renders this model.
import type { ShiftWithUser, HandoffNote, Attendance, ShiftType } from '../types';
import { isFullDayShift } from '../types';
import { SHIFT_TYPE_LABEL, fmtTime24, shiftTimeRange } from './shiftTypeMeta';
import { deriveScheduleInsights, type ScheduleInsight } from './scheduleInsights';

/** Time-of-day greeting from a 0–23 hour. */
export function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Cars cleaned this shift = full pages of 19 + entries on the last page. */
export function carsCleaned(h: Pick<HandoffNote, 'fullPages' | 'lastPageEntries'>): number {
  return h.fullPages * 19 + h.lastPageEntries;
}

export interface TeamMate { id: string; firstName: string; start: string; end: string; attendance?: Attendance; }

/** The attendance state a coworker pill cycles to on tap:
 *  scheduled (undefined) → present → absent → scheduled. */
export function nextAttendance(current: Attendance | undefined): Attendance | undefined {
  if (!current) return 'present';
  if (current === 'present') return 'absent';
  return undefined;
}

/** Who else is working today (excludes me + full-day/off types), soonest start first. */
export function teammatesOnToday(shifts: ShiftWithUser[], userId: string, todayISO: string): TeamMate[] {
  return shifts
    .filter(s => s.date === todayISO && s.userId !== userId && !isFullDayShift(s.shiftType))
    .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
    .map(s => ({ id: s.id, firstName: s.user.name.split(' ')[0], start: fmtTime24(s.startTime), end: fmtTime24(s.endTime), attendance: s.attendance }));
}

export interface MyDayModel {
  greeting: string;
  firstName: string;
  myShift: ShiftWithUser | undefined;
  /** Scheduled a working shift today (not day-off/pto/sick). */
  working: boolean;
  isMid: boolean;
  shiftLabel: string | null;
  shiftTime: string | null;
  team: TeamMate[];
  /** Cars cleaned this shift, or null when no handoff was logged today. */
  carsCleanedThisShift: number | null;
  /** Today's schedule heads-ups (clopen, solo floor). Empty when the day is clean. */
  insights: ScheduleInsight[];
}

export function deriveMyDay(input: {
  shifts: ShiftWithUser[];
  userId: string;
  userName: string;
  todayISO: string;
  hour: number;
  handoff?: HandoffNote;
  handoffIsToday: boolean;
  /** My shift types either side of today — clopen fires on the closing day (tomorrow
   *  opening) and the opening day (yesterday closing). */
  myYesterdayShiftType?: ShiftType;
  myTomorrowShiftType?: ShiftType;
}): MyDayModel {
  const { shifts, userId, userName, todayISO, hour, handoff, handoffIsToday, myYesterdayShiftType, myTomorrowShiftType } = input;
  const myShift = shifts.find(s => s.userId === userId && s.date === todayISO);
  const working = !!myShift && !isFullDayShift(myShift.shiftType);
  return {
    greeting: greeting(hour),
    firstName: userName.split(' ')[0],
    myShift,
    working,
    isMid: myShift?.shiftType === 'mid',
    shiftLabel: myShift ? SHIFT_TYPE_LABEL[myShift.shiftType] : null,
    shiftTime: myShift ? shiftTimeRange(myShift.startTime, myShift.endTime) : null,
    team: teammatesOnToday(shifts, userId, todayISO),
    carsCleanedThisShift: handoff && handoffIsToday ? carsCleaned(handoff) : null,
    insights: deriveScheduleInsights({ todayShifts: shifts, myYesterdayShiftType, myTomorrowShiftType, userId }),
  };
}
