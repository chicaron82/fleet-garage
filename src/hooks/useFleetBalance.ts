import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/** Returns today's date as YYYY-MM-DD in the browser's local timezone. */
export function localDateStr(offsetDays = 0): string {
  const d = new Date();
  if (offsetDays) d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface FleetBalanceEntry {
  id: string;
  date: string;         // ISO date
  outCount: number;
  inCount: number;
  enteredById: string;  // User.id (mock string, e.g. "u1")
  enteredAt: string;    // ISO timestamp
}

export function useFleetBalance() {
  const [entries, setEntries] = useState<FleetBalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch last 7 days on mount
  useEffect(() => {
    fetchLast7Days();
  }, []);

  async function fetchLast7Days() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fleet_balance')
        .select('*')
        .gte('date', localDateStr(-7))
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
    try {
      const { error } = await supabase
        .from('fleet_balance')
        .upsert(
          {
            date,
            out_count: outCount,
            in_count: inCount,
            entered_by: enteredById,
          },
          { onConflict: 'date' }
        );

      if (error) throw error;

      // Refresh the list
      await fetchLast7Days();
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

  return {
    entries,
    loading,
    upsertEntry,
    getTodayEntry,
  };
}
