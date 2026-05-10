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

export type VisibilityPreset = 'always' | 'winter' | 'summer' | 'fall';

export const VISIBILITY_PRESETS: Record<VisibilityPreset, { label: string; months: number[] }> = {
  always: { label: 'Always visible',        months: [] },
  winter: { label: 'Winter only (Nov–Apr)', months: [11, 12, 1, 2, 3, 4] },
  summer: { label: 'Peak season (May–Oct)', months: [5, 6, 7, 8, 9, 10] },
  fall:   { label: 'Fall notice (Oct–Nov)', months: [10, 11] },
};
