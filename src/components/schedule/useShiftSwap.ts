import { useState } from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import { supabase, writeWithRefresh } from '../../lib/supabase';
import type { ShiftWithUser } from '../../types';

/**
 * Applies a swap or give-away as a single ATOMIC action, via the Postgres RPCs in
 * migration 107. Each RPC reads and rewrites both rows inside one transaction, so a
 * failure rolls the whole operation back — no half-swap can survive.
 *
 * This replaced two sequential client writes guarded by a best-effort restore-both.
 * That restore was `.catch`-swallowed, so a leg-2 failure whose restore ALSO failed
 * left a live half-swap — which bit Aaron 2026-07-24 (swapped Rey↔Robert; Robert got
 * the shift but Rey was never cleared, both on). One transaction removes the window.
 *
 * Content-only move: the RPCs swap shift_type + times and never touch user_id or
 * date, so shifts_user_date_unique is never in play. After the write we refresh() so
 * local schedule state matches the transaction's committed result.
 */
export function useShiftSwap() {
  const { refresh } = useSchedule();
  const [busy, setBusy] = useState(false);

  // Direct swap: two crew trade shifts on the same day.
  const swap = async (a: ShiftWithUser, b: ShiftWithUser, note?: string) => {
    setBusy(true);
    try {
      const { error } = await writeWithRefresh(() =>
        supabase.rpc('swap_shift_content', { p_a_id: a.id, p_b_id: b.id, p_note: note?.trim() || undefined }));
      if (error) throw error;
      refresh();
    } finally {
      setBusy(false);
    }
  };

  // Give-away: giver drops to a day-off; taker inherits (replacing their own
  // same-day shift if they have one, else a new row is created for them).
  const giveAway = async (shift: ShiftWithUser, takerId: string, takerShift: ShiftWithUser | null, note?: string) => {
    setBusy(true);
    try {
      const { error } = await writeWithRefresh(() =>
        supabase.rpc('give_away_shift', {
          p_giver_id: shift.id,
          p_taker_id: takerId,
          p_taker_shift_id: takerShift?.id ?? undefined,
          p_note: note?.trim() || undefined,
        }));
      if (error) throw error;
      refresh();
    } finally {
      setBusy(false);
    }
  };

  return { swap, giveAway, busy };
}
