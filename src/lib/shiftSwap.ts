import type { Shift } from '../types';

// Swap mechanics for the schedule. The key insight that keeps this migration-free:
// we swap each shift's *schedulable content* (type + times) and leave `user_id` and
// `date` untouched — so the `shifts_user_date_unique (user_id, date)` constraint
// (migration 083) can never be violated mid-operation. Swapping ownership by moving
// `user_id` would transiently put two rows on one (user, date); swapping content
// reaches the identical end state without ever tripping it.

/** The schedulable part of a shift that a swap/give-away moves between rows. */
export type ShiftContent = Pick<Shift, 'shiftType' | 'startTime' | 'endTime'>;

const DAY_OFF: ShiftContent = { shiftType: 'day-off', startTime: undefined, endTime: undefined };

function content(s: ShiftContent): ShiftContent {
  return { shiftType: s.shiftType, startTime: s.startTime, endTime: s.endTime };
}

/**
 * Direct swap: each shift takes on the other's content. Result is identical to
 * trading ownership — A's person ends up with B's shift and vice-versa — but each
 * row keeps its own (user_id, date), so the unique constraint is never in play.
 */
export function swapPlan(a: ShiftContent, b: ShiftContent): { forA: ShiftContent; forB: ShiftContent } {
  return { forA: content(b), forB: content(a) };
}

/**
 * Give-away: the giver drops to a day-off and the taker inherits the shift's
 * content. `forTaker` is applied to the taker's existing same-day shift if they
 * have one (a replace — surface the conflict first), or a new row if they don't.
 */
export function giveAwayPlan(shift: ShiftContent): { forGiver: ShiftContent; forTaker: ShiftContent } {
  return { forGiver: DAY_OFF, forTaker: content(shift) };
}
