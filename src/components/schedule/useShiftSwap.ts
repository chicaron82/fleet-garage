import { useState } from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import { swapPlan, giveAwayPlan } from '../../lib/shiftSwap';
import type { ShiftWithUser } from '../../types';

/**
 * Applies a swap or give-away as a single confirmed action. Both are content
 * moves (see lib/shiftSwap) — no user_id changes, so the unique constraint is
 * never at risk — written through the existing optimistic schedule writes.
 *
 * Content-swap dodges the *constraint*, but two sequential writes still aren't
 * atomic on their own: a failed second leg would leave the grid half-swapped.
 * So on failure BOTH legs are restored to their original content — leg 2 can
 * throw *after* its DB write has already landed (a post-write session/network
 * hiccup), so rolling back only leg 1 would leave a half-swap with both rows
 * showing one shift. Restoring both guarantees a failed swap reverts cleanly.
 */
const original = (s: ShiftWithUser) =>
  ({ shiftType: s.shiftType, startTime: s.startTime, endTime: s.endTime, notes: s.notes });

export function useShiftSwap() {
  const { updateShift, createShift } = useSchedule();
  const [busy, setBusy] = useState(false);

  // Direct swap: two crew trade shifts on the same day.
  const swap = async (a: ShiftWithUser, b: ShiftWithUser, note?: string) => {
    setBusy(true);
    try {
      const { forA, forB } = swapPlan(a, b);
      const n = note?.trim() || undefined;
      const origA = original(a), origB = original(b);
      await updateShift(a.id, { ...forA, notes: n });
      try {
        await updateShift(b.id, { ...forB, notes: n });
      } catch (e) {
        // Restore BOTH rows — leg 2 may have written before throwing, so rolling
        // back only A would leave a half-swap. Guard each restore so a restore
        // failure can't mask the original error.
        await updateShift(a.id, origA).catch(() => {});
        await updateShift(b.id, origB).catch(() => {});
        throw e;
      }
    } finally {
      setBusy(false);
    }
  };

  // Give-away: giver drops to a day-off; taker inherits (replacing their own
  // same-day shift if they have one, else a new row is created for them).
  const giveAway = async (shift: ShiftWithUser, takerId: string, takerShift: ShiftWithUser | null, note?: string) => {
    setBusy(true);
    try {
      const { forGiver, forTaker } = giveAwayPlan(shift);
      const n = note?.trim() || undefined;
      await updateShift(shift.id, { ...forGiver, notes: n });
      try {
        if (takerShift) await updateShift(takerShift.id, { ...forTaker, notes: n });
        else await createShift({ userId: takerId, date: shift.date, ...forTaker, notes: n });
      } catch (e) {
        // Restore the giver rather than stranding them on a day-off; also restore
        // the taker's existing shift, which may have been written before the throw
        // (a freshly-created taker row can't be cleanly undone here, so only the
        // update case is reverted). Guarded so a restore failure can't mask the cause.
        await updateShift(shift.id, original(shift)).catch(() => {});
        if (takerShift) await updateShift(takerShift.id, original(takerShift)).catch(() => {});
        throw e;
      }
    } finally {
      setBusy(false);
    }
  };

  return { swap, giveAway, busy };
}
