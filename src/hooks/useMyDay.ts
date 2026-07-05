// Assembles the live inputs the "My Day" cockpit renders. Reads the same already-
// shared contexts the deep screens use, runs the pure deriveMyDay, and exposes the
// one action the cockpit takes (log the fleet balance). Keeps MyDayView a thin
// renderer. (Deliberately does NOT pull useSidebar's rate readouts — that hook is
// heavy, firing notifications + pref-sync; the throughput glance uses the
// lightweight washbay handoff instead. See lib/myDay.ts.)
import { useAuth } from '../context/AuthContext';
import { useSchedule, toISO } from '../context/ScheduleContext';
import { useVehicleHoldContext } from '../context/VehicleHoldContext';
import { useWashbayContext } from '../context/WashbayContext';
import { useFleetBalanceContext } from '../context/FleetBalanceContext';
import { localDateStr, type FleetBalanceEntry, type FleetBalanceProjection } from './useFleetBalance';
import { businessDateOf } from '../lib/shiftDay';
import { deriveMyDay, type MyDayModel } from '../lib/myDay';
import type { HandoffNote, Attendance } from '../types';

export interface UseMyDay extends MyDayModel {
  dateLabel: string;
  staleCount: number;
  handoffToday: HandoffNote | null;
  balanceLogged: boolean;
  todayEntry: FleetBalanceEntry | undefined;
  projection: FleetBalanceProjection | null;
  logBalance: (out: number, inc: number) => Promise<boolean>;
  setShiftAttendance: (id: string, attendance: Attendance | null) => Promise<void>;
}

export function useMyDay(): UseMyDay {
  const { user } = useAuth();
  const { shifts, setShiftAttendance } = useSchedule();
  const { staleHolds } = useVehicleHoldContext();
  const { latestHandoff } = useWashbayContext();
  const { upsertEntry, getTodayEntry, getProjection } = useFleetBalanceContext();

  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
  const handoffIsToday = !!latestHandoff && businessDateOf(latestHandoff.loggedAt) === localDateStr(0);

  const model = deriveMyDay({
    shifts,
    userId: user!.id,
    userName: user!.name,
    todayISO: toISO(now),
    hour: now.getHours(),
    handoff: latestHandoff,
    handoffIsToday,
  });

  const todayEntry = getTodayEntry();

  return {
    ...model,
    dateLabel,
    // Distinct vehicles, not hold records — a vehicle can carry multiple active
    // holds, so dedupe by vehicleId. The card reads "N vehicles held too long",
    // and this keeps that honest + comparable to the HELD-vehicle sidebar badge.
    staleCount: new Set(staleHolds.map(h => h.vehicleId)).size,
    handoffToday: handoffIsToday ? latestHandoff! : null,
    balanceLogged: !!todayEntry,
    todayEntry,
    projection: getProjection(),
    logBalance: (out, inc) => upsertEntry(localDateStr(), out, inc, user!.id),
    setShiftAttendance,
  };
}
