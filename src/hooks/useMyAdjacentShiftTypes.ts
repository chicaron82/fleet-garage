// My own shift TYPES for yesterday and tomorrow — the two cross-day facts the My Day clopen
// heads-up needs (today's type is already in todayShifts). Yesterday answers "did I close
// last night?" (the opening-day clopen); tomorrow answers "do I open after closing today?"
// (the closing-day clopen — the prep warning, fired a day earlier). One query for the
// [yesterday, tomorrow] window. Branch-agnostic; My-Day-only.
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toISO } from '../context/ScheduleContext';
import type { ShiftType } from '../types';

export interface AdjacentShiftTypes {
  yesterday: ShiftType | undefined;
  tomorrow: ShiftType | undefined;
}

export function useMyAdjacentShiftTypes(userId: string | undefined): AdjacentShiftTypes {
  const [types, setTypes] = useState<AdjacentShiftTypes>({ yesterday: undefined, tomorrow: undefined });
  useEffect(() => {
    if (!userId) return; // stays at the initial {} until signed in; never a sync setState in-effect
    let cancelled = false;
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const t = new Date();
    t.setDate(t.getDate() + 1);
    const yStr = toISO(y);
    const tStr = toISO(t);
    (async () => {
      const { data, error } = await supabase
        .from('shifts')
        .select('date, shift_type')
        .eq('user_id', userId)
        .in('date', [yStr, tStr]);
      if (cancelled || error || !data) return;
      const byDate = new Map((data as { date: string; shift_type: ShiftType }[]).map((r) => [r.date, r.shift_type]));
      setTypes({ yesterday: byDate.get(yStr), tomorrow: byDate.get(tStr) });
    })();
    return () => { cancelled = true; };
  }, [userId]);
  return types;
}
