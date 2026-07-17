// Pure, today-scoped schedule insights for the My Day cockpit. The shifts data already
// knows a clopen turnaround or a solo floor is coming — nothing surfaced it. This derives
// those flags so My Day (and, later, the Schedule screen) read from ONE source. Kept out
// of the component/context so it's testable without React.
//
// Phase 1 is deliberately the two insights that CANNOT false-positive: clopen is a shift
// TYPE across two days, solo-floor is a headcount. The window-based insights (coverage
// gaps, single-driver windows) wait on a branch-hours definition FG doesn't have yet —
// without an open/close boundary, "a gap between X and Y" is undefined.
import type { ShiftWithUser, ShiftType, UserRole } from '../types';
import { isFullDayShift } from '../types';
import { SCHEDULE_GROUPS } from './scheduleGroups';

export type ScheduleInsightKind = 'clopen' | 'solo-floor' | 'event';

export interface ScheduleInsight {
  kind: ScheduleInsightKind;
  icon: string;
  /** Short chip title, e.g. "Clopen". */
  label: string;
  /** One-line explanation for the card. */
  detail: string;
}

const FLOOR_ROLES: readonly UserRole[] = SCHEDULE_GROUPS.find(g => g.id === 'floor')?.roles ?? [];

const isFloor = (role: UserRole): boolean => FLOOR_ROLES.includes(role);
/** A scheduled shift the person actually works (not day-off / pto / sick). */
const isWorking = (s: ShiftWithUser): boolean => !isFullDayShift(s.shiftType);

/**
 * Today's insights for one user's My Day. Pure: the caller supplies today's resolved
 * roster (carries each person's role) and that user's OWN shift TYPE yesterday — the only
 * cross-day fact clopen needs. Returns [] when the day is clean, so the view shows no card.
 */
export function deriveScheduleInsights(input: {
  todayShifts: ShiftWithUser[];
  myYesterdayShiftType: ShiftType | undefined;
  myTomorrowShiftType: ShiftType | undefined;
  userId: string;
}): ScheduleInsight[] {
  const { todayShifts, myYesterdayShiftType, myTomorrowShiftType, userId } = input;
  const insights: ScheduleInsight[] = [];
  const myToday = todayShifts.find(s => s.userId === userId);

  // 🔁 Clopen — today is either END of a close→open back-to-back (shift TYPE is the signal,
  // no hour threshold). Fire on the CLOSING day (forward: the prep warning, a day before the
  // short turnaround) AND on the OPENING day (backward: the morning-of). Both, so today's
  // card is never blind to a clopen it's part of — a closing-day silence was the bug.
  if (myToday?.shiftType === 'closing' && myTomorrowShiftType === 'opening') {
    insights.push({
      kind: 'clopen',
      icon: '🔁',
      label: 'Clopen',
      detail: 'You close today and open tomorrow — short turnaround, plan your rest.',
    });
  } else if (myToday?.shiftType === 'opening' && myYesterdayShiftType === 'closing') {
    insights.push({
      kind: 'clopen',
      icon: '🔁',
      label: 'Clopen',
      detail: 'You opened today after closing last night — short turnaround.',
    });
  }

  // ⚠️ Solo floor — you're the only VSA / Lead VSA working the floor today. Only fires
  // when YOU are floor + working; another floor member on any working shift clears it.
  //
  // Deliberately SCHEDULE-based, NOT attendance-adjusted — do NOT "improve" this to count
  // only present/arrived staff. FG attendance marks are observation-boundary-biased: the
  // sole operator only verifies people who arrive during HIS window, so everyone on a later
  // shift stays `scheduled` (UNOBSERVED, not absent — he left before he could check).
  // Counting present-only would read every unverified coworker as a no-show and flag
  // solo-floor nearly every day. The only reliable negative is an explicit `absent` mark —
  // and by the time he's marked it, he already knows he's solo, so attendance adds ~zero
  // signal. (2026-07-14 — see the FG attendance-observation-boundary memory.)
  if (myToday && isWorking(myToday) && isFloor(myToday.user.role)) {
    const anotherFloorMember = todayShifts.some(
      s => s.userId !== userId && isWorking(s) && isFloor(s.user.role),
    );
    if (!anotherFloorMember) {
      insights.push({
        kind: 'solo-floor',
        icon: '⚠️',
        label: 'Solo floor',
        detail: 'No other VSA or Lead VSA on the floor today.',
      });
    }
  }

  return insights;
}
