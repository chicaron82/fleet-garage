import type { HandoffNote } from '../../types';
import type { BackfillFormState } from './BackfillEntryForm';
import { shiftDateStr, businessDateOf } from '../../lib/shiftDay';

export interface BackfillEntry {
  id: string;
  date: string;
  fullPages: number;
  lastPageEntries: number;
  carsRemaining: number;
  cleanNotPickedUp: number;
  carryOver: number;
  teamSize: number;
  overtimeHours: number;
  enteredBy: string;
  enteredAt: string;
}

export function findLatestBackfill(entries: BackfillEntry[]): BackfillEntry | null {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

export function buildRollingDates(now: Date = new Date()): string[] {
  const dates: string[] = [];
  for (let i = 0; i < 30; i++) {
    dates.push(shiftDateStr(-i, now));
  }
  return dates;
}

export function fmtDateLabel(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function deriveStats(
  entry: { fullPages: number; lastPageEntries: number; carsRemaining: number; overtimeHours: number },
  isPeakSeason: boolean,
) {
  const carsIn      = entry.fullPages * 19 + entry.lastPageEntries;
  const carsCleaned = Math.max(0, carsIn - entry.carsRemaining);
  const baseHours   = isPeakSeason ? 16 : 15;
  const opHours     = baseHours + entry.overtimeHours;
  const throughput  = opHours > 0 ? carsCleaned / opHours : 0;
  return { carsIn, carsCleaned, opHours, throughput };
}

export function deriveHandoffStats(note: HandoffNote) {
  const carsIn       = note.fullPages * 19 + note.lastPageEntries;
  const dateStr      = businessDateOf(note.loggedAt);
  const shiftStart   = new Date(`${dateStr}T06:45:00`);
  const handoffHours = Math.max(0, (new Date(note.loggedAt).getTime() - shiftStart.getTime()) / 3_600_000);
  const partialRate  = handoffHours > 0 ? carsIn / handoffHours : 0;
  return { carsIn, handoffHours, partialRate };
}

export function blankForm(seed?: BackfillEntry | null): BackfillFormState {
  return {
    totalPages:           0,
    entriesOnCurrentPage: 0,
    carsRemaining:        '',
    cleanNotPickedUp:     '',
    carryOver:            0,
    teamSize:             seed?.teamSize ?? 3,
    overtimeHours:        seed?.overtimeHours ?? 0,
  };
}
