// The rows behind the History cards. Fetches; the shaping lives in lib/fleetHistory (pure, tested).
//
// ⚠️⚠️ TWO EXCLUSIONS THAT MUST TRAVEL WITH EVERY QUERY HERE, or the numbers are quietly wrong:
//   1. FG's real record starts 2026-04-05. Everything before it is seeded.
//   2. Holds authored by a CREW-VOICE name are seeded too. ⚠️ Filter by NAME, never by badge shape —
//      `GM-001` (Howard W.) and `AGM-001` (Harpreet T.) look synthetic and are real people Aaron gave
//      credentials to when he showed FG to the GM and AGM.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/** FG's first real record. Anything earlier was seeded during the build. */
export const FG_RECORD_START = '2026-04-05';

/** Crew-voice authors. By NAME — a badge-shape heuristic wrongly excluded two real managers. */
const SEEDED_AUTHORS = [
  'DiZee', 'ZeeRah', 'Zee', 'Belle', 'Tori', 'CoZee', 'GenZee', 'ZeeDric', 'PerplexiZee',
];

/** The movement column compares against the record as it stood this long ago. */
const WEEK_MS = 7 * 86_400_000;

// ⚠️⚠️ THE API RETURNS AT MOST 1,000 ROWS PER REQUEST, WHATEVER `.limit()` ASKS FOR. This hook used to
// ask for `.limit(20000)` sightings and silently got the first 1,000. On 2026-09-10 the table held
// 1,131, so the "cars met" card read 801 sightings / 455 cars since Aug 17 against a true 926 / 491
// since Aug 16. The number looked reasonable, which is why nothing caught it; the gap grew every day.
// Found while building the top 10 on the same rows, by checking the card against a direct count.
// So every query here pages, in a stable order (`id`), until a short page says it's done.
const PAGE = 1000;
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ data: T[]; error: unknown }> {
  const data: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const res = await page(from, from + PAGE - 1);
    if (res.error) return { data, error: res.error };
    const rows = res.data ?? [];
    data.push(...rows);
    if (rows.length < PAGE) return { data, error: null };
  }
}

export interface FleetHistoryRows {
  /** `flagged_at` for every real hold since the record starts — feeds the monthly bars. */
  holdDates: string[];
  /** Vehicle ids flagged AT LEAST ONCE. A set, because the class card counts CARS, not holds. */
  flaggedVehicleIds: Set<string>;
  /** vehicle_id → how many times FG has met it on shift. */
  sightingsByVehicle: Map<string, number>;
  /** vehicle_id → the same count as it stood a week ago (sightings older than 7 days). */
  sightingsWeekAgo: Map<string, number>;
  /** vehicle_id → its newest sighting (ISO). Orders the cars inside a tie by who came through last. */
  lastSeenByVehicle: Map<string, string>;
  /** The observed sightings window, for the projection. Null until loaded. */
  window: { first: string; last: string; days: number } | null;
  loading: boolean;
  error: boolean;
}

const EMPTY: FleetHistoryRows = {
  holdDates: [], flaggedVehicleIds: new Set(), sightingsByVehicle: new Map(),
  sightingsWeekAgo: new Map(), lastSeenByVehicle: new Map(),
  window: null, loading: true, error: false,
};

export function useFleetHistory(): FleetHistoryRows {
  const [rows, setRows] = useState<FleetHistoryRows>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [holds, sightings] = await Promise.all([
          fetchAll((from, to) => supabase.from('holds')
            .select('vehicle_id, flagged_at, flagged_by_name')
            .gte('flagged_at', FG_RECORD_START)
            .order('id')
            .range(from, to)),
          // One row per sighting; counted client-side because the shape the cards want is a
          // distribution, and a grouped query would still need the per-car numbers to build it.
          fetchAll((from, to) => supabase.from('vehicle_sightings')
            .select('vehicle_id, seen_at')
            .order('id')
            .range(from, to)),
        ]);
        if (cancelled) return;
        if (holds.error || sightings.error) { setRows(r => ({ ...r, loading: false, error: true })); return; }

        const holdDates: string[] = [];
        const flaggedVehicleIds = new Set<string>();
        for (const h of holds.data) {
          if (SEEDED_AUTHORS.includes(h.flagged_by_name ?? '')) continue;
          if (h.flagged_at) holdDates.push(h.flagged_at);
          if (h.vehicle_id) flaggedVehicleIds.add(h.vehicle_id);
        }

        const weekAgo = Date.now() - WEEK_MS;
        const sightingsByVehicle = new Map<string, number>();
        const sightingsWeekAgo = new Map<string, number>();
        const lastSeenByVehicle = new Map<string, string>();
        let first = '', last = '';
        for (const s of sightings.data) {
          if (s.vehicle_id) {
            sightingsByVehicle.set(s.vehicle_id, (sightingsByVehicle.get(s.vehicle_id) ?? 0) + 1);
            const at = s.seen_at ?? '';
            if (at && Date.parse(at) < weekAgo) {
              sightingsWeekAgo.set(s.vehicle_id, (sightingsWeekAgo.get(s.vehicle_id) ?? 0) + 1);
            }
            if (at > (lastSeenByVehicle.get(s.vehicle_id) ?? '')) lastSeenByVehicle.set(s.vehicle_id, at);
          }
          // ⚠️ LOCAL date, not the UTC slice it used to be: the first sighting was the evening of
          // Aug 16 in Winnipeg, which is already Aug 17 in UTC, so the card said "since 2026-08-17".
          // en-CA formats as YYYY-MM-DD in the device's own zone.
          const d = s.seen_at ? new Date(s.seen_at).toLocaleDateString('en-CA') : '';
          if (!d) continue;
          if (!first || d < first) first = d;
          if (!last || d > last) last = d;
        }
        // ⚠️ Inclusive day count. Aug 17 → Sep 3 is 18 days of tracking, not 17 — an off-by-one here
        // makes the per-day rate high and every projection with it.
        const days = first && last
          ? Math.round((Date.parse(last) - Date.parse(first)) / 86_400_000) + 1
          : 0;

        setRows({
          holdDates, flaggedVehicleIds, sightingsByVehicle, sightingsWeekAgo, lastSeenByVehicle,
          window: first ? { first, last, days } : null,
          loading: false, error: false,
        });
      } catch {
        if (!cancelled) setRows(r => ({ ...r, loading: false, error: true }));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return rows;
}
