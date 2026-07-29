// Feeds lib/scheduleAnomaly: the operator's DECLARED work week (the decision) plus his last-12-
// weeks day-of-week history (evidence copy only) and the next few days of schedule. IO only — the
// deciding is the pure lib.
//
// NORMAL_WORKDAYS is the declared anchor (Aaron 2026-07-17: "mon-fri is my work week. deviations
// from it i'd like surfaced"). Declared, not inferred, so sustained coverage churn can never erode
// it — a boss-shuffled Sunday or a stolen Wednesday keeps firing forever. Personal-first: this is
// Aaron's contracted week; if the crew ever grows, lift it to a per-user setting.
//
// Two history windows, both now serving the EVIDENCE line only:
//  * BASELINE_WEEKS 12 — enough observations for an honest "you've had 11 of 12 Suns off".
//  * LOOKAHEAD_DAYS 3 — Aaron's nag budget: far enough to act on (told Friday about Sunday),
//    close enough that it never becomes wallpaper he stops reading.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { scheduleAnomalies, type AnomalyDay } from '../lib/scheduleAnomaly';
import type { ScheduleInsight } from '../lib/scheduleInsights';
import type { ShiftType } from '../types';

const BASELINE_WEEKS = 12;
/** Nag budget — how many days out an anomaly may SURFACE. Aaron's tuning: far enough to act on,
 *  close enough it never becomes wallpaper. */
const LOOKAHEAD_DAYS = 3;
/** How far to fetch/scan for COUNTING an off-block. Kept separate from the nag budget so a 4-day
 *  break reads "4 days off" — reusing the 3-day nag window as the count window truncated it to 3
 *  (Aaron caught it live 2026-07-29: FG said 3, his schedule had 4). Bounds the max countable run. */
const BLOCK_LOOKAHEAD = 14;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** His declared work week — Mon(1)…Fri(5). Everything else is a normally-off day. */
const NORMAL_WORKDAYS = new Set([1, 2, 3, 4, 5]);

// LOCAL calendar date, NOT toISOString/UTC. `now` is a raw instant, so a UTC serialization rolled
// `todayISO` to tomorrow after ~7pm in Winnipeg (UTC-5) — firing "no work tomorrow" a day early.
// The '17 fix corrected the lookahead PARSE (midnight below) but left this anchor on UTC; this is
// the other half. Midnight-based lookahead dates serialize the same either way, so this is safe.
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const isOff = (t: ShiftType) => t === 'day-off' || t === 'pto' || t === 'sick';

export function useScheduleAnomalies(userId: string | undefined, today: Date): ScheduleInsight[] {
  const [insights, setInsights] = useState<ScheduleInsight[]>([]);
  const todayISO = iso(today);

  const load = useCallback(async () => {
    if (!userId) return;
    // Parse todayISO as LOCAL (matches the lookahead loop below) — `new Date('YYYY-MM-DD')` is
    // UTC, so in a UTC-behind tz (Winnipeg) the window boundary landed a day short and the n=3
    // lookahead day never made it into the query. Caught by render-verify 2026-07-17.
    const midnight = new Date(`${todayISO}T00:00:00`);
    const start = iso(addDays(midnight, -BASELINE_WEEKS * 7));
    const end = iso(addDays(midnight, BLOCK_LOOKAHEAD));
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
    // Built out to BLOCK_LOOKAHEAD for an honest off-block count; scheduleAnomalies only SURFACES
    // the first LOOKAHEAD_DAYS (the nag budget) — the rest just lets the count run true.
    const byDate = new Map(data.map(r => [r.date as string, r.shift_type as ShiftType]));
    const days: AnomalyDay[] = [];
    for (let n = 1; n <= BLOCK_LOOKAHEAD; n++) {
      const d = addDays(midnight, n);
      const key = iso(d);
      const shiftType = byDate.get(key);
      if (!shiftType) continue; // unscheduled day — nothing to claim
      const dow = d.getDay();
      days.push({
        date: key, dayName: DAY_NAMES[dow], daysAway: n, shiftType,
        normalWorkday: NORMAL_WORKDAYS.has(dow),
        offCount: off[dow], sampleSize: seen[dow],
      });
    }
    setInsights(scheduleAnomalies(days, LOOKAHEAD_DAYS));
  }, [userId, todayISO]);

  // setState post-await (async), matching usePersonalEvents / useEffieMemory.
  useEffect(() => { void load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  return insights;
}
