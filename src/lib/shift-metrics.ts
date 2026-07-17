import type { Shift, ShiftType, ShiftWithUser } from '../types';
import { localDateStr } from '../hooks/useFleetBalance';
import { businessDateOf } from './shiftDay';

// Structural minimal inputs — the live card passes full HandoffNote/ShiftCheckpoint
// objects (which satisfy these), and the report fetcher passes mapped DB rows.
// Keeping the partition logic in one place is what keeps the live card and the
// PDF/text report from drifting apart on the personal-rate math.
export interface HandoffSnapshotInput {
  fullPages: number;
  lastPageEntries: number;
  loggedAt: string;
  morningHours?: number;
  carryOverCleared?: number; // prior-day-fuelled cars cleared today; credited to morning rate
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
  const dateStr = businessDateOf(handoff.loggedAt);
  return new Date(`${dateStr}T${MORNING_HANDOFF_LOCAL_TIME}`);
}

// Off-standard entry, minimally shaped for the rate math. presetReason carries
// the 'fleeting_sent' tag that exempts an entry from reducing the denominator.
export interface OffStandardMinutes {
  startTime: string;
  minutes: number;
  presetReason?: string | null;
}

// Three presets are logged but must NOT reduce the rate denominator — for two
// distinct reasons:
//   Already-in-the-numerator (exempt to avoid DOUBLE-COUNTING):
//   • 'fleeting_sent' — the cars went up to fleet and already count in sent-to-fleet.
//   • 'edv' — extra-detail time IS cleaning (one slow car, already in the cleaned
//     count); exempting it would double-credit and inflate the rate.
//   Outside-the-washbay-rate entirely:
//   • 'airport_flip' — a fast interior turnaround done AT the airport (mats, garbage,
//     quick wipe; rentable in <6min, never comes to the washbay). It's cleaning, but
//     off-site: the flipped cars aren't in the numerator (no gas sheet), and the time
//     isn't washbay time, so it sits outside the rate. Logged for visibility (shift
//     summary, export); the closing/report context flag explains the light bay count.
// Everything else (closing duties, lot org, etc.) is non-cleaning time and reduces it.
export function reducesDenominator(e: { presetReason?: string | null }): boolean {
  return e.presetReason !== 'fleeting_sent'
    && e.presetReason !== 'edv'
    && e.presetReason !== 'airport_flip';
}

// Partition off-standard minutes by the morning/closing boundary.
// When no handoff exists, everything counts as morning (the day hasn't crossed over yet).
export function splitOffStandard(
  entries: ReadonlyArray<OffStandardMinutes>,
  boundary: Date | null,
): { morning: number; closing: number } {
  const reducible = entries.filter(reducesDenominator);
  if (!boundary) {
    const total = reducible.reduce((s, e) => s + e.minutes, 0);
    return { morning: total, closing: 0 };
  }
  let m = 0;
  let c = 0;
  for (const e of reducible) {
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
  offStandardEntries: ReadonlyArray<OffStandardMinutes>;
  midArrival?: CheckpointSnapshotInput | null;
  midDeparture?: CheckpointSnapshotInput | null;
}): ShiftPartition {
  const { handoff, checkpoint, fullDayCleaned, offStandardEntries, midArrival, midDeparture } = args;

  // morningGas = pure gas-sheet count at handoff (used as the closing boundary).
  // morningCleaned = morningGas + carryOverCleared (what morning actually sent to fleet,
  // including prior-day-fuelled cars that had no fresh gas line today).
  const morningGas = handoff
    ? handoff.fullPages * 19 + handoff.lastPageEntries
    : null;
  const morningCleaned = morningGas != null
    ? morningGas + (handoff?.carryOverCleared ?? 0)
    : null;
  const morningHours = handoff?.morningHours ?? MORNING_SHIFT_HOURS;

  const checkpointCount = checkpoint
    ? checkpoint.fullPages * 19 + checkpoint.lastPageEntries
    : null;
  // Boundary stays on morningGas (pure gas), not morningCleaned — carry-over
  // doesn't move the physical gas-sheet boundary between morning and closing.
  const closingStartCount = checkpointCount ?? morningGas;
  const closingCleaned = closingStartCount != null && fullDayCleaned != null
    ? Math.max(0, fullDayCleaned - closingStartCount)
    : null;

  const boundary = handoff ? morningHandoffBoundary(handoff) : null;
  const oth = splitOffStandard(offStandardEntries, boundary);

  const midArrCount = midArrival  ? midArrival.fullPages  * 19 + midArrival.lastPageEntries  : null;
  const midDepCount = midDeparture ? midDeparture.fullPages * 19 + midDeparture.lastPageEntries : null;
  const midCleaned  = midArrCount != null && midDepCount != null ? Math.max(0, midDepCount - midArrCount) : null;
  const midHours    = CLOSING_SHIFT_HOURS; // fixed 8h window — start time varies, duration does not
  const reducible = offStandardEntries.filter(reducesDenominator);
  const midOth = midArrival?.loggedAt && midDeparture?.loggedAt
    ? (() => {
        const lo = new Date(midArrival.loggedAt).getTime();
        const hi = new Date(midDeparture.loggedAt).getTime();
        return reducible
          .filter(e => { const t = new Date(e.startTime).getTime(); return t >= lo && t < hi; })
          .reduce((s, e) => s + e.minutes, 0);
      })()
    : reducible.reduce((s, e) => s + e.minutes, 0);

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

// LIVE-ONLY flip credit (Aaron 2026-07-17). A return flipped at the airport is a rent-ready car —
// the same output as a washbay clean, minus the ~27min round-trip transit. Its TIME already sits
// in the rate denominator (airport_flip is non-reducing), so uncredited flips were dragging the
// rate DOWN — charged time, zero credited output. Crediting the count into the numerator corrects
// that. Returns the base rates untouched when there are no flips or no cleaned baseline yet — and
// is DELIBERATELY not folded into resolveShiftRates, so the durable snapshot/PDF stays flip-free
// (flips are ephemeral; only the live card reads them).
export function creditFlipsToRate(snapshot: ShiftSnapshot, flipCount: number): ShiftRates {
  if (snapshot.cleaned == null || flipCount <= 0) return computeShiftRates(snapshot);
  return computeShiftRates({ ...snapshot, cleaned: snapshot.cleaned + flipCount });
}

// The standard unpaid lunch, subtracted from a clock window to get productive
// hours — consistent with how morningHours is defined (06:45–15:15 = 8.5h clock,
// 8.0h productive). Aaron treats a rare second break as a manual one-off.
export const UNPAID_BREAK_HOURS = 0.5;
// No unpaid lunch is taken on a short call-in; the break is only deducted once
// the shift runs long enough to include one (MB: a break is owed after 5h).
const BREAK_MIN_SPAN_HOURS = 5;

// The throughput window AND the off-standard scope derive from the best clock
// window we have for the shift: actual hours worked when logged (called in
// early / stayed late), else the planned start/end, else the snapshot's per-type
// default (fixed 8h / morningHours). Actual and planned are taken as pairs,
// never mixed. Hours = clock span minus the unpaid lunch, but only when the span
// is long enough to include one. The car COUNTS are pinned to the timestamped
// gas sheet by the user, so all we take from the schedule is the window; the
// app's checkpoint loggedAt is deliberately not trusted (it's data-entry time).
export function applyShiftWindow(
  snapshot: ShiftSnapshot,
  args: {
    date: string;                       // shift business-date YYYY-MM-DD
    actualStart?: string | null;        // 'HH:MM' or 'HH:MM:SS', local
    actualEnd?: string | null;
    plannedStart?: string | null;       // scheduled times — fallback when no actual
    plannedEnd?: string | null;
    offStandardEntries: ReadonlyArray<OffStandardMinutes>;
    breakHours?: number;
  },
): ShiftSnapshot {
  const { date, actualStart, actualEnd, plannedStart, plannedEnd, offStandardEntries, breakHours = UNPAID_BREAK_HOURS } = args;
  const [start, end] =
    actualStart && actualEnd     ? [actualStart, actualEnd]
    : plannedStart && plannedEnd ? [plannedStart, plannedEnd]
    : [null, null];
  if (!start || !end) return snapshot;
  const startMs = new Date(`${date}T${start}`).getTime();
  let endMs = new Date(`${date}T${end}`).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return snapshot;
  if (endMs <= startMs) endMs += 86_400_000; // crossed midnight (e.g. 16:00 → 00:30)
  const span = (endMs - startMs) / 3_600_000;
  const hours = Math.max(0.1, span - (span > BREAK_MIN_SPAN_HOURS ? breakHours : 0));
  const oth = offStandardEntries
    .filter(reducesDenominator)
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

export interface UserShiftRates {
  snapshot: ShiftSnapshot;
  baseline: number | null;
  yourEffort: number | null;
}

// The single seam the live card and the exported report both compute the
// personal rate through: pick the user's window, resolve its hours
// (actual → planned → per-type default) and OTH scope, then rate it. One
// function so the two surfaces cannot drift apart — the 540/hr lesson, locked.
export function resolveShiftRates(args: {
  partition: ShiftPartition;
  shift: Pick<Shift, 'shiftType' | 'startTime' | 'endTime' | 'actualStartTime' | 'actualEndTime'> | null;
  date: string;
  offStandardEntries: ReadonlyArray<OffStandardMinutes>;
}): UserShiftRates {
  const { partition, shift, date, offStandardEntries } = args;
  const window = deriveShiftWindow(shift?.shiftType) ?? 'morning';
  const snapshot = applyShiftWindow(pickShift(partition, window), {
    date,
    actualStart: shift?.actualStartTime,
    actualEnd:   shift?.actualEndTime,
    plannedStart: shift?.startTime,
    plannedEnd:   shift?.endTime,
    offStandardEntries,
  });
  const { baseline, yourEffort } = computeShiftRates(snapshot);
  return { snapshot, baseline, yourEffort };
}

// Above this effort a personal rate almost certainly means a mis-logged count
// (arrival/departure read off the wrong gas-sheet row), not a real shift —
// well clear of a legit heavy-trip ~11.7/hr. Company standard is 3.0/hr.
export const IMPLAUSIBLE_EFFORT_RATE = 20;

// A heads-up when the personal rate looks like a data-entry error, so a
// mis-logged count can't quietly become the next 540/hr. null when it looks
// sane. Surfaced on the live card only — fix it before it reaches the report.
export function shiftRateWarning(snapshot: ShiftSnapshot): string | null {
  if (snapshot.cleaned == null) return null;
  // Off-standard meeting/exceeding the whole window is impossible (the 540 case).
  if (snapshot.oth / 60 >= snapshot.hours) {
    return 'Off-standard meets or exceeds your shift window — check your times and counts.';
  }
  const { yourEffort } = computeShiftRates(snapshot);
  if (yourEffort != null && yourEffort > IMPLAUSIBLE_EFFORT_RATE) {
    return `Rate looks high (${yourEffort.toFixed(1)}/hr) — double-check your arrival/departure counts.`;
  }
  return null;
}
