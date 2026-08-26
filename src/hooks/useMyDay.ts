// Assembles the live inputs the "My Day" cockpit renders. Reads the same already-
// shared contexts the deep screens use, runs the pure deriveMyDay, and exposes the
// one action the cockpit takes (log the fleet balance). Keeps MyDayView a thin
// renderer. (Deliberately does NOT pull useSidebar's rate readouts — that hook is
// heavy, firing notifications + pref-sync; the throughput glance uses the
// lightweight washbay handoff instead. See lib/myDay.ts.)
import { useAuth } from '../context/AuthContext';
import { useSchedule } from '../context/ScheduleContext';
import { toISO } from '../lib/schedule-helpers';
import { useVehicleHoldContext } from '../context/VehicleHoldContext';
import { useWashbayContext } from '../context/WashbayContext';
import { useFleetBalanceContext } from '../context/FleetBalanceContext';
import { localDateStr, type FleetBalanceEntry, type FleetBalanceProjection } from './useFleetBalance';
import { businessDateOf } from '../lib/shiftDay';
import { deriveMyDay, carsCleaned, type MyDayModel } from '../lib/myDay';
import { eventInsights } from '../lib/eventInsights';
import { usePersonalEvents } from './usePersonalEvents';
import { useScheduleAnomalies } from './useScheduleAnomalies';
import { staleHeldVehicleCount } from '../lib/holdFilters';
import { useMyAdjacentShiftTypes } from './useMyAdjacentShiftTypes';
import type { HandoffNote, Attendance, User } from '../types';

export interface UseMyDay extends MyDayModel {
  dateLabel: string;
  staleCount: number;
  handoffToday: HandoffNote | null;
  /** The afternoon (or, on a mid shift, the mid-arrival) check-in was logged today. */
  checkInDoneToday: boolean;
  /** Cars counted at that check-in, or null when none logged today. */
  checkInCarsToday: number | null;
  balanceLogged: boolean;
  /** Today's business date — the key the My Day surfaces scope per-day state to. */
  todayISO: string;
  todayEntry: FleetBalanceEntry | undefined;
  projection: FleetBalanceProjection | null;
  logBalance: (out: number, inc: number) => Promise<boolean>;
  setShiftAttendance: (id: string, attendance: Attendance | null) => Promise<void>;
  user: User;
}

export function useMyDay(): UseMyDay {
  const { user } = useAuth();
  // todayShifts (NOT the navigable `shifts`): My Day must reflect today even if the
  // Schedule screen was last swiped to another week (bug 2026-07-10).
  const { todayShifts, setShiftAttendance } = useSchedule();
  const { staleHolds, vehicles } = useVehicleHoldContext();
  const { latestHandoff, getTodayCheckpoint, getMidArrival } = useWashbayContext();
  const { upsertEntry, getTodayEntry, getProjection } = useFleetBalanceContext();

  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
  const handoffIsToday = !!latestHandoff && businessDateOf(latestHandoff.loggedAt) === localDateStr(0);

  const adjacentShiftTypes = useMyAdjacentShiftTypes(user?.id);

  const model = deriveMyDay({
    shifts: todayShifts,
    userId: user!.id,
    userName: user!.name,
    todayISO: toISO(now),
    hour: now.getHours(),
    handoff: latestHandoff,
    handoffIsToday,
    myYesterdayShiftType: adjacentShiftTypes.yesterday,
    myTomorrowShiftType: adjacentShiftTypes.tomorrow,
    myTomorrowStart: adjacentShiftTypes.tomorrowStart,
  });

  const todayEntry = getTodayEntry();

  // The check-in the My Day button refers to: mid shifts log a mid-arrival, everyone
  // else the closing (afternoon) arrival. Mirrors the button's own mid/afternoon copy.
  const checkInToday = model.isMid ? getMidArrival() : getTodayCheckpoint();

  // Dated personal notes (the staff BBQ) ride the SAME "Heads up today" card as clopen /
  // solo-floor — it already means "things about today you should know". Events lead: a 12:30
  // BBQ is a clock he has to meet, where a clopen is context for the day's shape.
  const todayEvents = usePersonalEvents(user?.id, toISO(now));
  // Forward-looking: a day in the next few that breaks his own pattern (works a normally-off
  // Sunday / off on a normally-worked Friday). Rides the same card — it's still "what you need
  // to know", just about the days right ahead rather than today.
  const anomalies = useScheduleAnomalies(user?.id, now);

  return {
    ...model,
    todayISO: toISO(now),
    insights: [...eventInsights(todayEvents, toISO(now)), ...anomalies, ...model.insights],
    dateLabel,
    checkInDoneToday: !!checkInToday,
    checkInCarsToday: checkInToday ? carsCleaned(checkInToday) : null,
    // "Held too long" = distinct HELD vehicles (the sidebar badge's population) that
    // carry a stale hold — so sale_car holds and dangling holds on archived units
    // don't masquerade as bay holds, and it never exceeds the badge.
    staleCount: staleHeldVehicleCount(staleHolds, vehicles),
    handoffToday: handoffIsToday ? latestHandoff! : null,
    balanceLogged: !!todayEntry,
    todayEntry,
    projection: getProjection(),
    logBalance: (out, inc) => upsertEntry(localDateStr(), out, inc, user!.id),
    setShiftAttendance,
    user: user!,
  };
}
