import type { ShiftType, ShiftWithUser } from '../types';
import { localDateStr } from '../hooks/useFleetBalance';

// Structural minimal inputs — the live card passes full HandoffNote/ShiftCheckpoint
// objects (which satisfy these), and the report fetcher passes mapped DB rows.
// Keeping the partition logic in one place is what keeps the live card and the
// PDF/text report from drifting apart on the personal-rate math.
export interface HandoffSnapshotInput {
  fullPages: number;
  lastPageEntries: number;
  loggedAt: string;
  morningHours?: number;
}
export interface CheckpointSnapshotInput {
  fullPages: number;
  lastPageEntries: number;
  loggedAt?: string;
}

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
export function morningHandoffBoundary(handoff: { loggedAt: string }): Date {
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
  handoff: HandoffSnapshotInput | null | undefined;
  checkpoint: CheckpointSnapshotInput | null | undefined;
  fullDayCleaned: number | null;
  offStandardEntries: ReadonlyArray<{ startTime: string; minutes: number }>;
  midArrival?: CheckpointSnapshotInput | null;
  midDeparture?: CheckpointSnapshotInput | null;
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
  const midHours    = CLOSING_SHIFT_HOURS; // fixed 8h window — start time varies, duration does not
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

// The standard unpaid lunch, subtracted from a clock window to get productive
// hours — consistent with how morningHours is defined (06:45–15:15 = 8.5h clock,
// 8.0h productive). Aaron treats a rare second break as a manual one-off.
export const UNPAID_BREAK_HOURS = 0.5;

// When a shift logs actual hours worked (called in early / stayed late), the
// throughput window AND the off-standard scope both derive from those real
// start/end times — keeping cars, hours, and OTH on the same window. Falls back
// to the snapshot's default (fixed 8h / morningHours) when actual hours aren't
// logged. The car COUNTS are pinned to the timestamped gas sheet by the user,
// so all we take from the schedule is the clock window; the app's checkpoint
// loggedAt is deliberately not trusted here (it's data-entry time, not shift time).
export function applyActualWindow(
  snapshot: ShiftSnapshot,
  args: {
    date: string;                       // shift business-date YYYY-MM-DD
    actualStart?: string | null;        // 'HH:MM' or 'HH:MM:SS', local
    actualEnd?: string | null;
    offStandardEntries: ReadonlyArray<{ startTime: string; minutes: number }>;
    breakHours?: number;
  },
): ShiftSnapshot {
  const { date, actualStart, actualEnd, offStandardEntries, breakHours = UNPAID_BREAK_HOURS } = args;
  if (!actualStart || !actualEnd) return snapshot;
  const startMs = new Date(`${date}T${actualStart}`).getTime();
  let endMs = new Date(`${date}T${actualEnd}`).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return snapshot;
  if (endMs <= startMs) endMs += 86_400_000; // crossed midnight (e.g. 16:00 → 00:30)
  const hours = Math.max(0.1, (endMs - startMs) / 3_600_000 - breakHours);
  const oth = offStandardEntries
    .filter(e => { const t = new Date(e.startTime).getTime(); return t >= startMs && t < endMs; })
    .reduce((s, e) => s + e.minutes, 0);
  return { ...snapshot, hours, oth };
}

export function deriveShiftWindow(shiftType: ShiftType | null | undefined): ShiftWindow | null {
  if (shiftType === 'opening') return 'morning';
  if (shiftType === 'closing') return 'closing';
  if (shiftType === 'mid')     return 'mid';
  return null;
}

// The user's shift row for a date (defaults to today) — prefers one with
// start/end times. Source of shiftType and actual hours worked.
export function deriveUserShift(
  shifts: ShiftWithUser[], userId: string, date: string = localDateStr(0),
): ShiftWithUser | null {
  const todaysShifts = shifts.filter(s => s.userId === userId && s.date === date);
  if (todaysShifts.length === 0) return null;
  const withTimes = todaysShifts.find(s => s.startTime && s.endTime);
  return withTimes ?? todaysShifts[0] ?? null;
}

export function deriveUserShiftType(shifts: ShiftWithUser[], userId: string): ShiftType | null {
  return deriveUserShift(shifts, userId)?.shiftType ?? null;
}

export function pickShift(partition: ShiftPartition, window: ShiftWindow): ShiftSnapshot {
  if (window === 'morning') return partition.morning;
  if (window === 'mid')     return partition.mid;
  return partition.closing;
}
