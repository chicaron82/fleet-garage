import type { WashbayLog, HandoffNote, ShiftCheckpoint } from '../../types';
import { CLOSING_SHIFT_HOURS, buildShiftPartition } from '../../lib/shift-metrics';
import { sentToFleet } from '../../lib/washbay-throughput';
import { shiftDateStr, businessDateOf } from '../../lib/shiftDay';

// Builders for the throughput chart, split out of ShiftThroughputSection so they
// can be unit-tested with an injected `now`. All day reckoning goes through the
// shift-date helpers (04:00 cutover) so the washbay log, the handoff (matched by
// businessDateOf on its loggedAt), and the closing checkpoint all resolve to the
// same shift-day — including across the 00:00–04:00 overtime window, where raw
// calendar dates used to mis-align them.

export interface DayData {
  label: string;
  morningRate: number | null;
  closingRate: number | null;
}

export interface TodaySnapshot {
  morningCleaned: number | null;
  morningHours: number | null;
  morningRate: number | null;
  closingCleaned: number | null;
  closingHours: number | null;
  closingRate: number | null;
}

export function buildLiveDays(
  washbayLogs: WashbayLog[],
  handoffNotes: HandoffNote[],
  checkpoints: ShiftCheckpoint[],
  now: Date = new Date(),
): DayData[] {
  const days: DayData[] = [];
  for (let i = 7; i >= 1; i--) {
    const dateStr = shiftDateStr(-i, now);
    const label = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short' });

    const log = washbayLogs.find(l => l.date === dateStr);
    const handoff = handoffNotes.find(n => businessDateOf(n.loggedAt) === dateStr);
    const checkpoint = checkpoints.find(c => c.date === dateStr && c.checkpointType === 'closing_arrival') ?? null;

    let morningRate: number | null = null;
    let closingRate: number | null = null;

    if (handoff && handoff.morningHours > 0) {
      const partition = buildShiftPartition({
        handoff,
        checkpoint: checkpoint ?? null,
        fullDayCleaned: log ? sentToFleet(log) : null,
        offStandardEntries: [],
      });
      if (partition.morning.cleaned != null) {
        morningRate = partition.morning.cleaned / partition.morning.hours;
      }
      if (partition.closing.cleaned != null && partition.closing.cleaned >= 0) {
        closingRate = partition.closing.cleaned / CLOSING_SHIFT_HOURS;
      }
    }

    days.push({ label, morningRate, closingRate });
  }
  return days;
}

export function buildTodaySnapshot(
  washbayLogs: WashbayLog[],
  handoffNotes: HandoffNote[],
  checkpoints: ShiftCheckpoint[],
  now: Date = new Date(),
): TodaySnapshot {
  const todayStr = shiftDateStr(0, now);
  const handoff = handoffNotes.find(n => businessDateOf(n.loggedAt) === todayStr);
  const log = washbayLogs.find(l => l.date === todayStr);
  const checkpoint = checkpoints.find(c => c.date === todayStr && c.checkpointType === 'closing_arrival') ?? null;

  let morningCleaned: number | null = null;
  let morningHours: number | null = null;
  let morningRate: number | null = null;
  let closingCleaned: number | null = null;
  let closingHours: number | null = null;
  let closingRate: number | null = null;

  if (handoff && handoff.morningHours > 0) {
    const partition = buildShiftPartition({
      handoff,
      checkpoint: checkpoint ?? null,
      fullDayCleaned: log ? sentToFleet(log) : null,
      offStandardEntries: [],
    });
    morningCleaned = partition.morning.cleaned;
    morningHours = partition.morning.hours;
    if (morningCleaned != null) morningRate = morningCleaned / morningHours;
    if (partition.closing.cleaned != null && partition.closing.cleaned >= 0) {
      closingCleaned = partition.closing.cleaned;
      closingHours = CLOSING_SHIFT_HOURS;
      closingRate = closingCleaned / closingHours;
    }
  }

  return { morningCleaned, morningHours, morningRate, closingCleaned, closingHours, closingRate };
}
