import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface FleetBalanceEntry {
  id: string;
  date: string;         // ISO date
  outCount: number;
  inCount: number;
  enteredById: string;  // User.id
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
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('fleet_balance')
        .select('*')
        .gte('date', sevenDaysAgo.toISOString().split('T')[0])
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
    const today = new Date().toISOString().split('T')[0];
    return entries.find(e => e.date === today);
  }

  return {
    entries,
    loading,
    upsertEntry,
    getTodayEntry,
  };
}
