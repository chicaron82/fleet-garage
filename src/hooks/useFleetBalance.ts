import { useState, useEffect } from 'react';
import { projectFleetBalance } from '../lib/fleetProjection';
import { supabase } from '../lib/supabase';
import { shiftDateStr } from '../lib/shiftDay';

/** Today's *shift-date* as YYYY-MM-DD in local time. Rolls over at the 04:00
 *  cutover, not midnight — see src/lib/shiftDay.ts. Kept here as the historical
 *  import path the app already uses everywhere. */
export function localDateStr(offsetDays = 0): string {
  return shiftDateStr(offsetDays);
}

export interface FleetBalanceEntry {
  id: string;
  date: string;         // ISO date
  outCount: number;
  inCount: number;
  enteredById: string;  // User.id (mock string, e.g. "u1")
  enteredAt: string | null;  // ISO timestamp
}

export interface FleetBalanceProjection {
  avgOut: number;
  avgIn: number;
  label: string;
}

export function useFleetBalance() {
  const [entries, setEntries] = useState<FleetBalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fleet_balance')
        .select('*')
        .gte('date', localDateStr(-90))
        .order('date', { ascending: true });

      if (error) throw error;

      setEntries(
        (data ?? []).map(row => ({
          id: row.id,
          date: row.date,
          outCount: row.out_count,
          inCount: row.in_count,
          enteredById: row.entered_by,
          enteredAt: row.entered_at,
        }))
      );
    } catch (err) {
      console.error('Failed to fetch fleet balance:', err);
    } finally {
      setLoading(false);
    }
  }

  async function upsertEntry(date: string, outCount: number, inCount: number, enteredById: string): Promise<boolean> {
    // ⚠️ Computed from the days BEFORE `date`, and computed BEFORE the write — an estimate that
    // could see the answer would not be an estimate.
    const shown = projectFleetBalance(date, entries.filter(e => e.date !== date));
    try {
      const { error } = await supabase
        .from('fleet_balance')
        .upsert(
          {
            date,
            out_count: outCount,
            in_count: inCount,
            entered_by: enteredById,
            // ⭐⭐ THE ESTIMATE IS RECORDED WITH THE ANSWER, and this is the point of the ticket:
            // the projection used to be recoverable only by re-running the code, so the first
            // change to the formula would have erased every past estimate. Written here, the
            // record stops depending on the code. No `backfill:` stamp — this one was really shown.
            projected_out:   shown?.avgOut ?? null,
            projected_in:    shown?.avgIn  ?? null,
            projected_basis: shown?.basis  ?? null,
          },
          { onConflict: 'date' }
        );

      if (error) throw error;

      await fetchHistory();
      return true;
    } catch (err) {
      console.error('Failed to upsert fleet balance:', err);
      return false;
    }
  }

  function getTodayEntry(): FleetBalanceEntry | undefined {
    const today = localDateStr();
    return entries.find(e => e.date === today);
  }

  /**
   * ⭐ The RULE lives in `lib/fleetProjection` — pure, so it can be replayed over any history.
   * That is how the last-4 window was chosen and how 79 days of past estimates were backfilled
   * before this file changed. This hook only supplies "today" and the days before it.
   */
  function getProjection(): FleetBalanceProjection | null {
    const today = localDateStr();
    return projectFleetBalance(today, entries.filter(e => e.date !== today));
  }

  return {
    entries,
    loading,
    upsertEntry,
    getTodayEntry,
    getProjection,
  };
}
