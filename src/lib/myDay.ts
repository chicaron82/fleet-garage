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

export interface TeamMate { id: string; displayName: string; start: string; end: string; attendance?: Attendance; }

/** The attendance state a coworker pill cycles to on tap:
 *  scheduled (undefined) → present → absent → scheduled. */
export function nextAttendance(current: Attendance | undefined): Attendance | undefined {
  if (!current) return 'present';
  if (current === 'present') return 'absent';
  return undefined;
}

/** Who else is working today (excludes me + full-day/off types), soonest start first.
 *  Chips show the first name; when two teammates share one (e.g. utility "Larry C"
 *  vs driver "Larry J"), the colliding ones fall back to their full roster name so
 *  same-first-name people are distinguishable at a glance. */
export function teammatesOnToday(shifts: ShiftWithUser[], userId: string, todayISO: string): TeamMate[] {
  const onToday = shifts
    .filter(s => s.date === todayISO && s.userId !== userId && !isFullDayShift(s.shiftType))
    .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
  const firstNameCounts = new Map<string, number>();
  for (const s of onToday) {
    const fn = s.user.name.split(' ')[0];
    firstNameCounts.set(fn, (firstNameCounts.get(fn) ?? 0) + 1);
  }
  return onToday.map(s => {
    const fn = s.user.name.split(' ')[0];
    return {
      id: s.id,
      displayName: (firstNameCounts.get(fn) ?? 0) > 1 ? s.user.name : fn,
      start: fmtTime24(s.startTime),
      end: fmtTime24(s.endTime),
      attendance: s.attendance,
    };
  });
}

export interface MyDayModel {
  greeting: string;
  firstName: string;
  myShift: ShiftWithUser | undefined;
  /** At work today. TRUE for a rostered working shift, and ALSO for a full-day type
   *  (day-off / pto / sick) once actual hours are logged — see `overtime`. */
  working: boolean;
  /** Called in on a day the roster had him off: a full-day type with actual hours logged.
   *  This is the state `ot.ts` already prices at 1.5x for every net hour. */
  overtime: boolean;
  /** The roster's own word for the day, shown UNDER the headline when `overtime` — the day-off
   *  is what makes every hour time-and-a-half, so it must not be erased by the label. */
  shiftSubLabel: string | null;
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
  /** Tomorrow's start time — for the "open tomorrow" wake heads-up copy. */
  myTomorrowStart?: string;
}): MyDayModel {
  const { shifts, userId, userName, todayISO, hour, handoff, handoffIsToday, myYesterdayShiftType, myTomorrowShiftType, myTomorrowStart } = input;
  const myShift = shifts.find(s => s.userId === userId && s.date === todayISO);

  // ⭐ `shift_type` is the PLAN; `actualStartTime` is what happened. My Day used to read only the
  // plan, so a day-off he was called in on rendered as an empty cockpit while he stood in the bay —
  // and `ot.ts` had been pricing that same day as all-overtime the whole time. Two layers of one
  // app disagreeing about one day. Logged hours settle it (Aaron, 2026-08-22, from the lot).
  //
  // Note the direction: hours logged PROVE he is here; no hours prove nothing at all. So this only
  // ever ADDS the working state, never removes one — the observation-boundary rule FG is built on.
  const overtime = !!myShift && isFullDayShift(myShift.shiftType) && !!myShift.actualStartTime;
  const working = !!myShift && (!isFullDayShift(myShift.shiftType) || overtime);
  return {
    greeting: greeting(hour),
    firstName: userName.split(' ')[0],
    myShift,
    working,
    overtime,
    isMid: myShift?.shiftType === 'mid',
    // On an overtime day the headline answers "what am I doing today" — Overtime — and the roster's
    // own label drops to the sub-line rather than vanishing.
    shiftLabel: overtime ? 'Overtime' : myShift ? SHIFT_TYPE_LABEL[myShift.shiftType] : null,
    shiftSubLabel: overtime && myShift ? `Scheduled ${SHIFT_TYPE_LABEL[myShift.shiftType].toLowerCase()}` : null,
    // A full-day type has no scheduled times, so the range has to come from the hours actually logged.
    shiftTime: overtime && myShift
      ? shiftTimeRange(myShift.actualStartTime, myShift.actualEndTime)
      : myShift ? shiftTimeRange(myShift.startTime, myShift.endTime) : null,
    team: teammatesOnToday(shifts, userId, todayISO),
    carsCleanedThisShift: handoff && handoffIsToday ? carsCleaned(handoff) : null,
    insights: deriveScheduleInsights({ todayShifts: shifts, myYesterdayShiftType, myTomorrowShiftType, myTomorrowStart, userId }),
  };
}
