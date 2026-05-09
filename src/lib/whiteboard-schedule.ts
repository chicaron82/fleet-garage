import type { WhiteboardNote } from '../types';

export function isNoteActiveForMonth(note: WhiteboardNote, month: number): boolean {
  if (!note.activeMonths || note.activeMonths.length === 0) return true;
  return note.activeMonths.includes(month);
}

export function seasonalStarterBody(isPeakSeason: boolean): string {
  return isPeakSeason
    ? 'Peak season active. High demand expected. Prioritize SUV and Q4 cleans.'
    : 'Winter season. AWD priority. Monitor tire swap queue.';
}
