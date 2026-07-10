// TODAY's shifts, loaded on their OWN — keyed on today's date (recomputed each render, so it
// re-runs across a midnight boundary) + branch, NEVER on the navigable currentDate. This is what
// My Day reads, so it's immune to the Schedule screen being left on another week (the "My Day says
// not scheduled after viewing last week" bug, 2026-07-10). Extracted from ScheduleContext to keep
// it under the line cap; the provider owns the resolve + the write-sync (patchShift/create/delete).
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { ShiftWithUser } from '../types';

export function useTodayShifts(
  todayStr: string,
  activeBranch: string,
  rowToShiftRef: React.MutableRefObject<(row: Record<string, unknown>) => ShiftWithUser>,
) {
  const [todayShifts, setTodayShifts] = useState<ShiftWithUser[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('date', todayStr)
        .order('start_time', { ascending: true, nullsFirst: false });
      if (cancelled || error || !data) return;
      const rows = (data as Record<string, unknown>[]).map(r => rowToShiftRef.current(r));
      setTodayShifts(activeBranch === 'ALL' ? rows : rows.filter(s => s.branchId === activeBranch));
    })();
    return () => { cancelled = true; };
  }, [todayStr, activeBranch, rowToShiftRef]);
  return { todayShifts, setTodayShifts };
}
