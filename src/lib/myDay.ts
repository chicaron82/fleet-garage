// Pure derivations for the "My Day" cockpit. Kept out of the component + hook so
// the shift/team/greeting logic is testable without React or context. The hook
// (useMyDay) assembles the live inputs; the view just renders this model.
import type { ShiftWithUser, ShiftType, HandoffNote } from '../types';
import { isFullDayShift } from '../types';

export const SHIFT_LABEL: Record<ShiftType, string> = {
  opening: 'Opening', mid: 'Mid', closing: 'Closing',
  'day-off': 'Day off', pto: 'PTO', sick: 'Sick',
};

/** Time-of-day greeting from a 0–23 hour. */
export function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** DB times come back as 'HH:MM:SS' — trim the seconds to 'HH:MM' for display. */
export function fmtTime(t?: string): string {
  return t ? t.slice(0, 5) : '';
}

/** 'HH:MM – HH:MM', or null for a shift with no scheduled times (day-off/pto/sick). */
export function shiftTimeRange(start?: string, end?: string): string | null {
  if (!start || !end) return null;
  return `${fmtTime(start)} – ${fmtTime(end)}`;
}

/** Cars cleaned this shift = full pages of 19 + entries on the last page. */
export function carsCleaned(h: Pick<HandoffNote, 'fullPages' | 'lastPageEntries'>): number {
  return h.fullPages * 19 + h.lastPageEntries;
}

export interface TeamMate { id: string; firstName: string; start: string; }

/** Who else is working today (excludes me + full-day/off types), soonest start first. */
export function teammatesOnToday(shifts: ShiftWithUser[], userId: string, todayISO: string): TeamMate[] {
  return shifts
    .filter(s => s.date === todayISO && s.userId !== userId && !isFullDayShift(s.shiftType))
    .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
    .map(s => ({ id: s.id, firstName: s.user.name.split(' ')[0], start: fmtTime(s.startTime) }));
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
}

export function deriveMyDay(input: {
  shifts: ShiftWithUser[];
  userId: string;
  userName: string;
  todayISO: string;
  hour: number;
  handoff?: HandoffNote;
  handoffIsToday: boolean;
}): MyDayModel {
  const { shifts, userId, userName, todayISO, hour, handoff, handoffIsToday } = input;
  const myShift = shifts.find(s => s.userId === userId && s.date === todayISO);
  const working = !!myShift && !isFullDayShift(myShift.shiftType);
  return {
    greeting: greeting(hour),
    firstName: userName.split(' ')[0],
    myShift,
    working,
    isMid: myShift?.shiftType === 'mid',
    shiftLabel: myShift ? SHIFT_LABEL[myShift.shiftType] : null,
    shiftTime: myShift ? shiftTimeRange(myShift.startTime, myShift.endTime) : null,
    team: teammatesOnToday(shifts, userId, todayISO),
    carsCleanedThisShift: handoff && handoffIsToday ? carsCleaned(handoff) : null,
  };
}
