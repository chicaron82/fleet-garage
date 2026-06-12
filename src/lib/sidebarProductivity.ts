import { shiftDateStr } from './shiftDay';
import { businessDateOf } from './shiftDay';
import { isCarryOverOnly } from './washbayLineage';
import { morningHandoffBoundary } from './shift-metrics';
import type { HandoffNote, ShiftType } from '../types';

// The sidebar's productivity derivations, extracted from useSidebar (which had
// become a cross-domain aggregator doing washbay math inside components/layout).
// Everything here is pure — the hook owns I/O and passes data in. This math is
// the file the date-semantics fixes kept landing on; now it's testable.

/** Washbay log in domain shape (camelCase, from WashbayContext). */
export interface PrimaryLog {
  date: string;
  fullPages: number;
  lastPageEntries: number;
  carsRemaining: number;
  overtimeHours: number;
}

/** Opener backfill row in raw DB shape (snake_case, fetched directly). */
export interface BackfillLog {
  date: string;
  full_pages: number;
  last_page_entries: number;
  cars_remaining: number;
  overtime_hours: number;
}

export type ActiveLog = PrimaryLog | BackfillLog;

export function isBackfillLog(log: ActiveLog): log is BackfillLog {
  return 'full_pages' in log;
}

/**
 * The log driving the sidebar readout: the most recent REAL close (carry-over
 * -only backfills have no throughput) vs the latest opener backfill — whichever
 * is newer wins.
 */
export function resolveActiveLog(
  washbayLogs: PrimaryLog[],
  latestBackfill: BackfillLog | null,
): ActiveLog | null {
  const recentPrimary = washbayLogs.find(l => !isCarryOverOnly(l)) ?? null;
  if (!recentPrimary && !latestBackfill) return null;
  if (!recentPrimary) return latestBackfill;
  if (!latestBackfill) return recentPrimary;
  return recentPrimary.date >= latestBackfill.date ? recentPrimary : latestBackfill;
}

export interface ShiftCheckpointLike {
  date: string;
  checkpointType: string;
  fullPages: number;
  lastPageEntries: number;
}

export interface OffStandardEntryLike {
  minutes: number;
  startTime: string;
}

export interface VsaProductivityInputs {
  activeLog: ActiveLog | null;
  offStandardEntries: OffStandardEntryLike[];
  todayHandoff: HandoffNote | null;
  shiftCheckpoints: ShiftCheckpointLike[];
  userShiftType: ShiftType | null;
  isPeakSeason: boolean;
  washbayLogs: PrimaryLog[];
  now?: Date;
}

export interface VsaProductivity {
  recentLogDate: string | undefined;
  recentLabel: string;
  dailyRate: number | null;
  morningRate: number | null;
  closingRate: number | null;
  hasSplit: boolean;
  resolvedRate: number | null;
  resolvedShiftIcon: string | null;
  weekAvgRate: number | null;
  delta: number | null;
  deltaLabel: string | null;
}

/**
 * The whole VSA sidebar readout: daily/morning/closing rates (OTH-adjusted),
 * the shift-resolved headline rate, and the rolling week average. Logic moved
 * verbatim from useSidebar — window basis is the scheduled hours (15, 16 in
 * peak) plus overtime; the morning/closing split anchors on the closing-arrival
 * checkpoint when present, falling back to the handoff's morning count.
 */
export function deriveVsaProductivity({
  activeLog, offStandardEntries, todayHandoff, shiftCheckpoints,
  userShiftType, isPeakSeason, washbayLogs, now = new Date(),
}: VsaProductivityInputs): VsaProductivity {
  const recentLogDate = activeLog?.date;

  const carsIn = activeLog
    ? (isBackfillLog(activeLog)
        ? activeLog.full_pages * 19 + activeLog.last_page_entries
        : activeLog.fullPages * 19 + activeLog.lastPageEntries)
    : null;
  const carsCleaned = carsIn != null && activeLog
    ? carsIn - (isBackfillLog(activeLog) ? activeLog.cars_remaining : activeLog.carsRemaining)
    : null;
  const offStandardMinutes = offStandardEntries.reduce((s, e) => s + e.minutes, 0);
  const teamOpHours = isPeakSeason
    ? 16
    : 15 + (activeLog ? (isBackfillLog(activeLog) ? activeLog.overtime_hours : activeLog.overtimeHours) : 0);
  const teamThroughput = carsCleaned != null ? carsCleaned / teamOpHours : null;
  const adjustedOpHours = Math.max(0.1, teamOpHours - (offStandardMinutes / 60));
  const dailyRate = carsCleaned != null
    ? (offStandardMinutes > 0
        ? Math.round((carsCleaned / adjustedOpHours) * 10) / 10
        : Math.round(teamThroughput! * 10) / 10)
    : null;

  const morningCleaned = todayHandoff ? todayHandoff.fullPages * 19 + todayHandoff.lastPageEntries : null;
  const morningOpHours = todayHandoff ? todayHandoff.morningHours ?? 8.0 : null;
  const activeCheckpoint = shiftCheckpoints.find(c => c.date === recentLogDate && c.checkpointType === 'closing_arrival') ?? null;
  const checkpointCount = activeCheckpoint ? activeCheckpoint.fullPages * 19 + activeCheckpoint.lastPageEntries : null;
  const closingStartCount = checkpointCount ?? morningCleaned;
  const closingCleaned = closingStartCount != null && carsCleaned != null ? Math.max(0, carsCleaned - closingStartCount) : null;
  const closingOpHours: number | null = morningOpHours != null ? 8.0 : null;

  const handoffTimestamp = todayHandoff ? morningHandoffBoundary(todayHandoff) : null;
  const morningOTH = handoffTimestamp
    ? offStandardEntries.filter(e => new Date(e.startTime) < handoffTimestamp).reduce((s, e) => s + e.minutes, 0)
    : offStandardMinutes;
  const closingOTH = handoffTimestamp
    ? offStandardEntries.filter(e => new Date(e.startTime) >= handoffTimestamp).reduce((s, e) => s + e.minutes, 0)
    : 0;

  const morningAdjustedHours = morningOpHours != null ? Math.max(0.1, morningOpHours - morningOTH / 60) : null;
  const closingAdjustedHours = closingOpHours != null ? Math.max(0.1, closingOpHours - closingOTH / 60) : null;
  const morningRate = morningCleaned != null && morningAdjustedHours != null ? Math.round((morningCleaned / morningAdjustedHours) * 10) / 10 : null;
  const closingRate = closingCleaned != null && closingAdjustedHours != null ? Math.round((closingCleaned / closingAdjustedHours) * 10) / 10 : null;

  const hasSplit = morningRate != null && closingRate != null;
  const resolvedRate = hasSplit && userShiftType
    ? userShiftType === 'opening' ? morningRate : userShiftType === 'closing' ? closingRate : dailyRate
    : dailyRate;
  const resolvedShiftIcon = hasSplit && userShiftType === 'opening' ? '☀️'
    : hasSplit && userShiftType === 'closing' ? '🌙' : null;

  const recentLabel = recentLogDate === shiftDateStr(0, now)  ? 'Earlier today'
                    : recentLogDate === shiftDateStr(-1, now) ? 'Yesterday'
                    : recentLogDate ?? 'Last shift';

  const weekLogs = washbayLogs
    .filter(l => l.date >= shiftDateStr(-7, now) && l.date < shiftDateStr(0, now))
    .filter(l => !isCarryOverOnly(l));
  const weekAvgRate = weekLogs.length >= 3
    ? Math.round(weekLogs.reduce((s, l) => {
        const ci = l.fullPages * 19 + l.lastPageEntries;
        return s + (ci - l.carsRemaining) / (isPeakSeason ? 16 : 15 + l.overtimeHours);
      }, 0) / weekLogs.length * 10) / 10
    : null;

  const delta = resolvedRate != null && weekAvgRate != null ? Math.round((resolvedRate - weekAvgRate) * 10) / 10 : null;
  const deltaLabel = delta != null ? (delta >= 0 ? `+${delta}` : `${delta}`) : null;

  return {
    recentLogDate, recentLabel,
    dailyRate, morningRate, closingRate, hasSplit,
    resolvedRate, resolvedShiftIcon,
    weekAvgRate, delta, deltaLabel,
  };
}

/** Driver week readout: trips today (by business date) + rolling week average. */
export function deriveDriverWeek(
  trips: { depart_time: string }[],
  now: Date = new Date(),
): { tripsToday: number; weekAvgTrips: number | null } {
  const today = shiftDateStr(0, now);
  const tripsToday = trips.filter(t => businessDateOf(t.depart_time) === today).length;
  const byDay = trips.reduce((acc, t) => {
    const date = businessDateOf(t.depart_time);
    acc[date] = (acc[date] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const weekAvgTrips = Object.keys(byDay).length >= 3
    ? Math.round(Object.values(byDay).reduce((s, n) => s + n, 0) / Object.keys(byDay).length * 10) / 10
    : null;
  return { tripsToday, weekAvgTrips };
}
