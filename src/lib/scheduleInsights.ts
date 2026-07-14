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

export type ScheduleInsightKind = 'clopen' | 'solo-floor';

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
  userId: string;
}): ScheduleInsight[] {
  const { todayShifts, myYesterdayShiftType, userId } = input;
  const insights: ScheduleInsight[] = [];
  const myToday = todayShifts.find(s => s.userId === userId);

  // 🔁 Clopen — close day N, open day N+1. The shift TYPE is the signal (no hour
  // threshold): a 'closing' yesterday followed by an 'opening' today, same person.
  if (myToday?.shiftType === 'opening' && myYesterdayShiftType === 'closing') {
    insights.push({
      kind: 'clopen',
      icon: '🔁',
      label: 'Clopen',
      detail: 'Opening today right after closing yesterday — short turnaround.',
    });
  }

  // ⚠️ Solo floor — you're the only VSA / Lead VSA working the floor today. Only fires
  // when YOU are floor + working; another floor member on any working shift clears it.
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
