// Feeds lib/scheduleAnomaly: the operator's own last-12-weeks day-of-week baseline plus the
// next few days of schedule. IO only — the deciding is the pure lib.
//
// Two windows, both deliberate:
//  * BASELINE_WEEKS 12 — long enough that a weekday has ~12 observations (a real sample), short
//    enough to track a genuine roster change rather than averaging in ancient history.
//  * LOOKAHEAD_DAYS 3 — Aaron's nag budget: far enough to act on (told Friday about Sunday),
//    close enough that it never becomes wallpaper he stops reading.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { scheduleAnomalies, type AnomalyDay } from '../lib/scheduleAnomaly';
import type { ScheduleInsight } from '../lib/scheduleInsights';
import type { ShiftType } from '../types';

const BASELINE_WEEKS = 12;
const LOOKAHEAD_DAYS = 3;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const isOff = (t: ShiftType) => t === 'day-off' || t === 'pto' || t === 'sick';

export function useScheduleAnomalies(userId: string | undefined, today: Date): ScheduleInsight[] {
  const [insights, setInsights] = useState<ScheduleInsight[]>([]);
  const todayISO = iso(today);

  const load = useCallback(async () => {
    if (!userId) return;
    const start = iso(addDays(new Date(todayISO), -BASELINE_WEEKS * 7));
    const end = iso(addDays(new Date(todayISO), LOOKAHEAD_DAYS));
    const { data } = await supabase
      .from('shifts')
      .select('date, shift_type')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end);
    if (!data) return;

    // Baseline: per weekday, how often was it a day off? PAST only — a future scheduled day
    // must never teach the baseline that it's normal (that would let the anomaly explain
    // itself away).
    const off = Array(7).fill(0);
    const seen = Array(7).fill(0);
    for (const r of data) {
      const date = r.date as string;
      if (date >= todayISO) continue;
      const dow = new Date(`${date}T00:00:00`).getDay();
      seen[dow] += 1;
      if (isOff(r.shift_type as ShiftType)) off[dow] += 1;
    }

    // The lookahead, tomorrow-first and contiguous (the pure fn counts off-blocks by adjacency).
    const byDate = new Map(data.map(r => [r.date as string, r.shift_type as ShiftType]));
    const days: AnomalyDay[] = [];
    for (let n = 1; n <= LOOKAHEAD_DAYS; n++) {
      const d = addDays(new Date(`${todayISO}T00:00:00`), n);
      const key = iso(d);
      const shiftType = byDate.get(key);
      if (!shiftType) continue; // unscheduled day — nothing to claim
      const dow = d.getDay();
      days.push({
        date: key, dayName: DAY_NAMES[dow], daysAway: n, shiftType,
        offCount: off[dow], sampleSize: seen[dow],
      });
    }
    setInsights(scheduleAnomalies(days));
  }, [userId, todayISO]);

  // setState post-await (async), matching usePersonalEvents / useEffieMemory.
  useEffect(() => { void load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  return insights;
}
