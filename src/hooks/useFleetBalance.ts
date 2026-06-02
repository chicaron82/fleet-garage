import { useState, useEffect } from 'react';
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

  function getProjection(): FleetBalanceProjection | null {
    const today = localDateStr();
    const dayOfWeek = new Date(today + 'T00:00:00').getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const historical = entries.filter(e => e.date !== today);

    if (isWeekend) {
      const prior7 = historical.slice(-7);
      if (prior7.length < 2) return null;
      return {
        avgOut: Math.round(prior7.reduce((s, e) => s + e.outCount, 0) / prior7.length),
        avgIn:  Math.round(prior7.reduce((s, e) => s + e.inCount,  0) / prior7.length),
        label:  'Based on prior week avg · Placeholder until today\'s balance is entered',
      };
    }

    const dayName = new Date(today + 'T00:00:00').toLocaleDateString('en-CA', { weekday: 'long' });
    const sameDayEntries = historical.filter(e => new Date(e.date + 'T00:00:00').getDay() === dayOfWeek);
    if (sameDayEntries.length >= 2) {
      const n = sameDayEntries.length;
      return {
        avgOut: Math.round(sameDayEntries.reduce((s, e) => s + e.outCount, 0) / n),
        avgIn:  Math.round(sameDayEntries.reduce((s, e) => s + e.inCount,  0) / n),
        label:  `Based on ${n}-${dayName} avg · Placeholder until today's balance is entered`,
      };
    }

    // Fallback: overall weekday average
    const weekdayEntries = historical.filter(e => {
      const d = new Date(e.date + 'T00:00:00').getDay();
      return d >= 1 && d <= 5;
    });
    if (weekdayEntries.length < 2) return null;
    return {
      avgOut: Math.round(weekdayEntries.reduce((s, e) => s + e.outCount, 0) / weekdayEntries.length),
      avgIn:  Math.round(weekdayEntries.reduce((s, e) => s + e.inCount,  0) / weekdayEntries.length),
      label:  'Based on weekday avg · Placeholder until today\'s balance is entered',
    };
  }

  return {
    entries,
    loading,
    upsertEntry,
    getTodayEntry,
    getProjection,
  };
}
