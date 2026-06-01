import type { ShiftType } from '../types';

/** The minimal shape needed to tally a shift against the PTO/sick counters. */
export interface TallyShift {
  shiftType: ShiftType;
  date: string; // ISO 'YYYY-MM-DD'
}

/**
 * Net change to the running PTO / sick counters for a single shift transition.
 *
 * Unifies every write path: a create is `(null → after)`, a delete is
 * `(before → null)`, and an edit/flip is `(before → after)`. Only shifts dated
 * within `year` count, mirroring the year-scoped query in `usePTOStats`.
 *
 * Examples:
 *   day-off → pto   ⇒ { pto: +1, sick:  0 }   (Aaron's flip-to-PTO case)
 *   pto     → day   ⇒ { pto: -1, sick:  0 }
 *   pto     → sick  ⇒ { pto: -1, sick: +1 }
 *   notes-only edit ⇒ { pto:  0, sick:  0 }
 */
export function shiftTallyDelta(
  before: TallyShift | null,
  after: TallyShift | null,
  year: number,
): { pto: number; sick: number } {
  const counts = (s: TallyShift | null, type: ShiftType): number =>
    s !== null && s.shiftType === type && s.date.startsWith(String(year)) ? 1 : 0;

  return {
    pto:  counts(after, 'pto')  - counts(before, 'pto'),
    sick: counts(after, 'sick') - counts(before, 'sick'),
  };
}
