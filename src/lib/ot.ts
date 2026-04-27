import type { Shift } from '../types';
import { isFullDayShift } from '../types';

function timeToDec(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h + m / 60;
}

export function calcHours(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const s = timeToDec(start);
  let e = timeToDec(end);
  if (e <= s) e += 24; // midnight crossover e.g. 22:00–00:30
  return Math.max(0, e - s);
}

// Returns OT hours for a shift. Rules:
//   day-off + actual hours logged  → all actual hours are OT
//   isStat                         → all actual hours are OT
//   regular shift                  → max(0, actualHours - 8)
export function calcOT(shift: Shift): number {
  const actual = calcHours(shift.actualStartTime, shift.actualEndTime);
  if (actual <= 0) return 0;
  if (isFullDayShift(shift.shiftType) || shift.isStat) return actual;
  return Math.max(0, actual - 8);
}

export function fmtHours(h: number): string {
  if (h === 0) return '0h';
  const hrs  = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}
