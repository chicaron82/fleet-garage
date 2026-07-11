import { useState, useMemo } from 'react';
import { isFullDayShift } from '../../types';
import { isMockPersona } from '../../lib/accountClassification';
import { overlapMinutes } from '../../lib/shiftOverlap';
import type { ShiftWithUser, User } from '../../types';

const NO_OVERLAPS: ReadonlyMap<string, number> = new Map();

interface Args {
  shifts: ShiftWithUser[];
  teamMembers: User[];
  user: User | null;
  today: string;
  viewMode: string;
  isCurrentPeriod: boolean;
  showMock: boolean;
  activeBranch: string;
}

/**
 * "My Shift" filter — answers "who's on the floor with me right now, and for how
 * long." Anchored on *today* (the disable case is literally "no shift entered for
 * the viewed date"), and only offered on the current week so "who's with me today"
 * stays coherent with what's on screen. When active it ignores the group tabs and
 * drives the visible set off shift overlap instead; toggling off restores them
 * (the group state is never mutated). The per-coworker overlap minutes feed the
 * inline badges in WeekView.
 */
export function useMyShiftFilter({ shifts, teamMembers, user, today, viewMode, isCurrentPeriod, showMock, activeBranch }: Args) {
  const [on, setOn] = useState(false);

  const myTodayShift = useMemo(
    () => shifts.find(s => s.userId === user?.id && s.date === today) ?? null,
    [shifts, user?.id, today],
  );

  const available = viewMode === 'week' && isCurrentPeriod
    && !!myTodayShift && !isFullDayShift(myTodayShift.shiftType)
    && !!myTodayShift.startTime && !!myTodayShift.endTime;

  const overlaps = useMemo(() => {
    if (!available || !myTodayShift) return NO_OVERLAPS;
    const todayByUser = new Map(shifts.filter(s => s.date === today).map(s => [s.userId, s]));
    const map = new Map<string, number>();
    for (const u of teamMembers) {
      if (u.id === user?.id) continue;
      if (!showMock && isMockPersona(u)) continue;
      if (activeBranch !== 'ALL' && u.branchId !== activeBranch) continue;
      const theirs = todayByUser.get(u.id);
      if (!theirs) continue;
      const mins = overlapMinutes(myTodayShift, theirs);
      if (mins > 0) map.set(u.id, mins);
    }
    return map;
  }, [available, myTodayShift, shifts, today, teamMembers, user?.id, showMock, activeBranch]);

  const active = on && available;
  return {
    show: viewMode === 'week',
    available,
    active,
    toggle: () => setOn(v => !v),
    overlaps: active ? overlaps : NO_OVERLAPS,
    /** When active, the exact set to show (self + everyone overlapping today); else null → use the group filter. */
    visibleIds: active
      ? new Set<string>([user?.id, ...overlaps.keys()].filter((x): x is string => !!x))
      : null,
  };
}
