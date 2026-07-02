// One source of truth for how a ShiftType READS across FG. Before this lib,
// six parallel Record<ShiftType, …> label/color maps had accumulated (WeekView,
// DayDetailModal, CalendarView, FlipShiftSheet, buildShiftReport, myDay — plus a
// string-manip twin in offStandardReport), so renaming a shift type meant six
// edits. What's consolidated here is only what's GENUINELY shared:
//   - the short label ('Opening') and the report sentence ('Opening shift')
//   - the pill classes WeekView + DayDetailModal already held byte-identically
//   - the 24h 'HH:MM:SS' → 'HH:MM' trim
// Deliberately NOT consolidated: CalendarView's dot colors and FlipShiftSheet's
// active/idle button tones (different render contexts — Tailwind needs literal
// class strings per context), the compact-vs-full 12h time dialects ('4:00p' vs
// '4:00 PM'), and api/_lib/scheduleSummary.describeShiftType (the server can't
// import src — Vercel transpiles functions; see that file's header).
import type { ShiftType } from '../types';

/** Short display label — chips, sheets, the cockpit. */
export const SHIFT_TYPE_LABEL: Record<ShiftType, string> = {
  'opening': 'Opening',
  'mid':     'Mid',
  'closing': 'Closing',
  'day-off': 'Day Off',
  'pto':     'PTO',
  'sick':    'Sick',
};

/** Report/sentence label — shift reports, off-standard exports. */
export function shiftTypeSentence(t: ShiftType): string {
  switch (t) {
    case 'opening': return 'Opening shift';
    case 'mid':     return 'Mid shift';
    case 'closing': return 'Closing shift';
    case 'day-off': return 'Day Off';
    case 'pto':     return 'PTO';
    case 'sick':    return 'Sick Day';
  }
}

/** The shared pill treatment (schedule week grid + day detail). One hue scheme:
 *  opening=blue, mid=teal, closing=yellow, day-off=gray, pto=violet, sick=rose. */
export const SHIFT_TYPE_PILL: Record<ShiftType, string> = {
  'opening': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  'mid':     'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
  'closing': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  'day-off': 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
  'pto':     'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
  'sick':    'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
};

/** DB times come back as 'HH:MM:SS' — trim to 'HH:MM' for 24h display. */
export function fmtTime24(t?: string): string {
  return t ? t.slice(0, 5) : '';
}

/** 'HH:MM – HH:MM', or null for a shift with no scheduled times (day-off/pto/sick). */
export function shiftTimeRange(start?: string, end?: string): string | null {
  if (!start || !end) return null;
  return `${fmtTime24(start)} – ${fmtTime24(end)}`;
}
