import type { HandoffNote, ShiftCheckpoint, ShiftType, ShiftWithUser } from '../types';
import { localDateStr } from '../hooks/useFleetBalance';

// Morning shift runs 06:45–15:15 year-round; closing always 8h.
// Peak season only shifts the closing crew one hour later, never the morning.
export const MORNING_SHIFT_HOURS = 8;
export const CLOSING_SHIFT_HOURS = 8;
const MORNING_HANDOFF_LOCAL_TIME = '15:15:00';

export type ShiftWindow = 'morning' | 'closing' | 'mid';

export interface ShiftSnapshot {
  cleaned: number | null;
  hours: number;
  oth: number;
}

export interface ShiftPartition {
  morning: ShiftSnapshot;
  closing: ShiftSnapshot;
  mid:     ShiftSnapshot;
}

export interface ShiftRates {
  baseline: number | null;
  yourEffort: number | null;
}

// The local moment that separates morning from closing on the given handoff's date.
export function morningHandoffBoundary(handoff: HandoffNote): Date {
  const dateStr = new Date(handoff.loggedAt).toLocaleDateString('en-CA');
  return new Date(`${dateStr}T${MORNING_HANDOFF_LOCAL_TIME}`);
}

// Partition off-standard minutes by the morning/closing boundary.
// When no handoff exists, everything counts as morning (the day hasn't crossed over yet).
export function splitOffStandard(
  entries: ReadonlyArray<{ startTime: string; minutes: number }>,
  boundary: Date | null,
): { morning: number; closing: number } {
  if (!boundary) {
    const total = entries.reduce((s, e) => s + e.minutes, 0);
    return { morning: total, closing: 0 };
  }
  let m = 0;
  let c = 0;
  for (const e of entries) {
    if (new Date(e.startTime) < boundary) m += e.minutes;
    else c += e.minutes;
  }
  return { morning: m, closing: c };
}

// Build a full shift partition from today's handoff, closing log, and OTH entries.
// checkpoint, when present, sets closing's car count start at arrival (not at handoff).
export function buildShiftPartition(args: {
  handoff: HandoffNote | null | undefined;
  checkpoint: ShiftCheckpoint | null | undefined;
  fullDayCleaned: number | null;
  offStandardEntries: ReadonlyArray<{ startTime: string; minutes: number }>;
  midArrival?: ShiftCheckpoint | null;
  midDeparture?: ShiftCheckpoint | null;
}): ShiftPartition {
  const { handoff, checkpoint, fullDayCleaned, offStandardEntries, midArrival, midDeparture } = args;

  const morningCleaned = handoff
    ? handoff.fullPages * 19 + handoff.lastPageEntries
    : null;
  const morningHours = handoff?.morningHours ?? MORNING_SHIFT_HOURS;

  const checkpointCount = checkpoint
    ? checkpoint.fullPages * 19 + checkpoint.lastPageEntries
    : null;
  const closingStartCount = checkpointCount ?? morningCleaned;
  const closingCleaned = closingStartCount != null && fullDayCleaned != null
    ? Math.max(0, fullDayCleaned - closingStartCount)
    : null;

  const boundary = handoff ? morningHandoffBoundary(handoff) : null;
  const oth = splitOffStandard(offStandardEntries, boundary);

  const midArrCount = midArrival  ? midArrival.fullPages  * 19 + midArrival.lastPageEntries  : null;
  const midDepCount = midDeparture ? midDeparture.fullPages * 19 + midDeparture.lastPageEntries : null;
  const midCleaned  = midArrCount != null && midDepCount != null ? Math.max(0, midDepCount - midArrCount) : null;
  const midHours    = midArrival?.loggedAt && midDeparture?.loggedAt
    ? Math.max(0.1, (new Date(midDeparture.loggedAt).getTime() - new Date(midArrival.loggedAt).getTime()) / 3_600_000)
    : CLOSING_SHIFT_HOURS;
  const midOth = midArrival?.loggedAt && midDeparture?.loggedAt
    ? (() => {
        const lo = new Date(midArrival.loggedAt).getTime();
        const hi = new Date(midDeparture.loggedAt).getTime();
        return offStandardEntries
          .filter(e => { const t = new Date(e.startTime).getTime(); return t >= lo && t < hi; })
          .reduce((s, e) => s + e.minutes, 0);
      })()
    : offStandardEntries.reduce((s, e) => s + e.minutes, 0);

  return {
    morning: { cleaned: morningCleaned, hours: morningHours,        oth: oth.morning },
    closing: { cleaned: closingCleaned, hours: CLOSING_SHIFT_HOURS, oth: oth.closing },
    mid:     { cleaned: midCleaned,     hours: midHours,            oth: midOth      },
  };
}

// Shift baseline = cars-in-window / shift-hours.
// Your effort   = cars-in-window / (shift-hours - your OTH in that window).
// Logging more OTH raises Your Effort — intentional, encourages time logging
// (monthly bonus is tied to hitting the company standard).
export function computeShiftRates(snapshot: ShiftSnapshot): ShiftRates {
  if (snapshot.cleaned == null) return { baseline: null, yourEffort: null };
  const baseline = snapshot.hours > 0 ? snapshot.cleaned / snapshot.hours : null;
  const adjustedHours = Math.max(0.1, snapshot.hours - snapshot.oth / 60);
  const yourEffort = snapshot.cleaned / adjustedHours;
  return { baseline, yourEffort };
}

export function deriveShiftWindow(shiftType: ShiftType | null | undefined): ShiftWindow | null {
  if (shiftType === 'opening') return 'morning';
  if (shiftType === 'closing') return 'closing';
  if (shiftType === 'mid')     return 'mid';
  return null;
}

export function deriveUserShiftType(shifts: ShiftWithUser[], userId: string): ShiftType | null {
  const today = localDateStr(0);
  const todaysShifts = shifts.filter(s => s.userId === userId && s.date === today);
  if (todaysShifts.length === 0) return null;
  const withTimes = todaysShifts.find(s => s.startTime && s.endTime);
  return (withTimes ?? todaysShifts[0])?.shiftType ?? null;
}

export function pickShift(partition: ShiftPartition, window: ShiftWindow): ShiftSnapshot {
  if (window === 'morning') return partition.morning;
  if (window === 'mid')     return partition.mid;
  return partition.closing;
}
