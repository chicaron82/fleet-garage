// Pure build step for the schedule import (Phase 2): turn confirmed grid rows into the
// shift rows to write. No I/O — the time defaults + the full-day predicate are injected,
// so it's fully testable. 'unknown' cells are skipped (never write a guess); the human
// should have corrected them in the preview.
import type { ParsedShiftType } from '../../api/_lib/scheduleParse';
import type { ShiftType } from '../types';

/** Add n days to an ISO date (YYYY-MM-DD), staying in UTC to avoid TZ drift. */
export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** The shift types a preview cell cycles through on tap (skips 'unknown'). */
export const CYCLE: ParsedShiftType[] = ['opening', 'mid', 'closing', 'day-off', 'pto', 'sick'];

/** Next type when a cell is tapped; an 'unknown' cell cycles into the first real type. */
export function nextType(t: ParsedShiftType): ParsedShiftType {
  return CYCLE[(CYCLE.indexOf(t) + 1) % CYCLE.length];
}

/** A cell in a confirmed row — its real date + the effective type + the real times. */
export interface BuildCell {
  date: string | null;
  type: ParsedShiftType;
  startTime: string | null;
  endTime: string | null;
}

/** A confirmed row: the resolved user + their dated cells. */
export interface ImportRow {
  userId: string;
  cells: BuildCell[];
}

export interface ImportShift {
  userId: string;
  date: string;
  shiftType: ShiftType;
  startTime?: string;
  endTime?: string;
}

/**
 * Build the shifts to write from each cell's REAL date + REAL times. A cell with no date
 * or an 'unknown' type is dropped (never written). Working shifts keep their printed
 * times; if a cell has no times (e.g. the human flipped an OFF cell to a working type),
 * the type's default times fill in. Full-day types (off/pto/sick) carry no times. Rows
 * must already be resolved to a userId (the caller drops unassigned rows).
 */
export function buildImportShifts(
  rows: ImportRow[],
  defaults: Record<ShiftType, { start: string; end: string }>,
  isFullDay: (t: ShiftType) => boolean,
): ImportShift[] {
  const out: ImportShift[] = [];
  for (const row of rows) {
    for (const cell of row.cells) {
      if (!cell.date || cell.type === 'unknown') continue;
      const shiftType = cell.type as ShiftType;
      const full = isFullDay(shiftType);
      out.push({
        userId: row.userId,
        date: cell.date,
        shiftType,
        startTime: full ? undefined : (cell.startTime ?? defaults[shiftType].start),
        endTime: full ? undefined : (cell.endTime ?? defaults[shiftType].end),
      });
    }
  }
  return out;
}

/**
 * Shift types the import must NOT delete. A printed sheet routinely omits approved time off
 * (Aaron's boss forgetting to mark his PTO is the recurring case), so a delete-and-replace
 * that trusts the sheet destroys real bookings. FG's own record wins for these.
 */
export const PROTECTED_IMPORT_TYPES = ['pto', 'sick'] as const;

/** A day the import kept instead of overwriting. */
export interface PreservedDay {
  userId: string;
  date: string;
  shiftType: ShiftType;
}

/** What an import actually did — surfaced to the operator so preservation is never silent. */
export interface ImportOutcome {
  written: number;
  preserved: PreservedDay[];
}

/**
 * Drop any incoming shift that lands on a day we preserved. Without this the sheet's version
 * of a protected day would be inserted alongside the kept row, double-booking the date (and
 * double-counting it in the PTO tally).
 */
export function dropProtectedDays<T extends { userId: string; date: string }>(
  shifts: T[],
  preserved: PreservedDay[],
): T[] {
  const keys = new Set(preserved.map((p) => `${p.userId}|${p.date}`));
  return shifts.filter((s) => !keys.has(`${s.userId}|${s.date}`));
}

/** The min/max date across the built shifts — the window the import wipes then refills. */
export function dateRange(shifts: { date: string }[]): { start: string; end: string } | null {
  if (shifts.length === 0) return null;
  const dates = shifts.map((s) => s.date).sort();
  return { start: dates[0], end: dates[dates.length - 1] };
}
