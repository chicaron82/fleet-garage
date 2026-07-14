// My OWN shift type yesterday — the single cross-day fact the clopen insight needs.
// My Day derives everything else from todayShifts (today-only, so it's immune to the
// Schedule screen being left on another week — the 2026-07-10 bug), so "did I close
// yesterday?" simply isn't in that data. This fetches just my prior-day shift type on
// its own. Branch-agnostic on purpose: a clopen is about MY back-to-back shifts, not the
// active branch view. (Phase 2's Schedule week grid already loads the visible range, so
// clopen-on-cells there needs no extra fetch — this is a My-Day-only concern.)
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toISO } from '../context/ScheduleContext';
import type { ShiftType } from '../types';

export function useMyYesterdayShiftType(userId: string | undefined): ShiftType | undefined {
  const [shiftType, setShiftType] = useState<ShiftType | undefined>(undefined);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const y = new Date();
    y.setDate(y.getDate() - 1); // setDate handles month/year rollover + DST safely for a date
    const yStr = toISO(y);
    (async () => {
      const { data, error } = await supabase
        .from('shifts')
        .select('shift_type')
        .eq('user_id', userId)
        .eq('date', yStr)
        .limit(1);
      if (cancelled || error || !data?.length) return;
      setShiftType((data[0] as { shift_type: ShiftType }).shift_type);
    })();
    return () => { cancelled = true; };
  }, [userId]);
  return shiftType;
}
