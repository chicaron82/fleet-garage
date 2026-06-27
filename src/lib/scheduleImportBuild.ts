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

/** A confirmed row: the resolved user + the effective shift type per column (Mon..). */
export interface ImportRow {
  userId: string;
  types: ParsedShiftType[];
}

export interface ImportShift {
  userId: string;
  date: string;
  shiftType: ShiftType;
  startTime?: string;
  endTime?: string;
}

/**
 * Build the shifts to write. Column index i → weekStart + i days. Each cell's type
 * becomes a shift (with default times unless it's a full-day type); 'unknown' cells are
 * dropped. Rows must already be resolved to a userId (unassigned rows are excluded by the
 * caller).
 */
export function buildImportShifts(
  rows: ImportRow[],
  weekStartISO: string,
  defaults: Record<ShiftType, { start: string; end: string }>,
  isFullDay: (t: ShiftType) => boolean,
): ImportShift[] {
  const out: ImportShift[] = [];
  for (const row of rows) {
    row.types.forEach((t, i) => {
      if (t === 'unknown') return;
      const shiftType = t as ShiftType;
      const date = addDaysISO(weekStartISO, i);
      const full = isFullDay(shiftType);
      out.push({
        userId: row.userId,
        date,
        shiftType,
        startTime: full ? undefined : defaults[shiftType].start,
        endTime: full ? undefined : defaults[shiftType].end,
      });
    });
  }
  return out;
}
