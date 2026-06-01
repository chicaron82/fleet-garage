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

/**
 * Ownership-scoped tally delta. The personal PTO/sick counters in `usePTOStats`
 * are seeded by a query scoped to the logged-in user (`.eq('user_id', viewerId)`),
 * so only that viewer's *own* shift writes may move them. A manager editing a
 * teammate's shift must not drift the manager's personal tally — this returns a
 * zero delta whenever the written shift belongs to someone other than the viewer.
 */
export function ownedTallyDelta(
  ownerId: string,
  viewerId: string | undefined,
  before: TallyShift | null,
  after: TallyShift | null,
  year: number,
): { pto: number; sick: number } {
  if (!viewerId || ownerId !== viewerId) return { pto: 0, sick: 0 };
  return shiftTallyDelta(before, after, year);
}
