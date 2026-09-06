// The windows actually worked, for the shift form's quick-pick chips.
//
// ⚠️ FETCHES ITS OWN RANGE ON PURPOSE. ScheduleContext carries a warning at its `shifts` field —
// "Do NOT aggregate an arbitrary date range from this — it will be silently partial" — because that
// array is only ever the navigable window. Ranking presets off a partial window would quietly
// promote whatever happened to be on screen.
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { ShiftTimeRow } from '../lib/shiftTimePresets';

/** Half a year: long enough for a seasonal shape to show, short enough that a retired shift
 *  pattern stops outranking the one they moved to. */
const LOOKBACK_DAYS = 180;
const MAX_ROWS = 4000;

let cache: { at: number; rows: ShiftTimeRow[] } | null = null;
const TTL_MS = 10 * 60 * 1000;

/** Rows are shared per session — the form opens and closes constantly and this never changes fast. */
export function useShiftTimePresets(): ShiftTimeRow[] {
  const [rows, setRows] = useState<ShiftTimeRow[]>(cache?.rows ?? []);

  useEffect(() => {
    if (cache && Date.now() - cache.at < TTL_MS) return;
    let cancelled = false;
    async function load() {
      const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from('shifts')
        .select('shift_type, start_time, end_time')
        .gte('date', since)
        .not('start_time', 'is', null)
        .limit(MAX_ROWS);
      if (cancelled) return;
      const mapped: ShiftTimeRow[] = (data ?? []).map(r => ({
        shiftType: (r.shift_type as string) ?? '',
        // Postgres hands back 'HH:MM:SS'; the form's inputs speak 'HH:MM'.
        start: ((r.start_time as string) ?? '').slice(0, 5),
        end: ((r.end_time as string) ?? '').slice(0, 5),
      }));
      cache = { at: Date.now(), rows: mapped };
      setRows(mapped);
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return rows;
}
