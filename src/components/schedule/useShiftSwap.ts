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
 * So the second write is guarded — if it throws, the first is rolled back to its
 * original content, so a failure leaves the schedule exactly as it was.
 */
export function useShiftSwap() {
  const { updateShift, createShift } = useSchedule();
  const [busy, setBusy] = useState(false);

  // Direct swap: two crew trade shifts on the same day.
  const swap = async (a: ShiftWithUser, b: ShiftWithUser, note?: string) => {
    setBusy(true);
    try {
      const { forA, forB } = swapPlan(a, b);
      const n = note?.trim() || undefined;
      await updateShift(a.id, { ...forA, notes: n });
      try {
        await updateShift(b.id, { ...forB, notes: n });
      } catch (e) {
        // Roll the first leg back so the grid never sits half-swapped.
        await updateShift(a.id, { shiftType: a.shiftType, startTime: a.startTime, endTime: a.endTime, notes: a.notes });
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
        // Taker leg failed — restore the giver's shift rather than stranding them on a day-off.
        await updateShift(shift.id, { shiftType: shift.shiftType, startTime: shift.startTime, endTime: shift.endTime, notes: shift.notes });
        throw e;
      }
    } finally {
      setBusy(false);
    }
  };

  return { swap, giveAway, busy };
}
