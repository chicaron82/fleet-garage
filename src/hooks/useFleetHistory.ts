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

export interface FleetHistoryRows {
  /** `flagged_at` for every real hold since the record starts — feeds the monthly bars. */
  holdDates: string[];
  /** Vehicle ids flagged AT LEAST ONCE. A set, because the class card counts CARS, not holds. */
  flaggedVehicleIds: Set<string>;
  /** vehicle_id → how many times FG has met it on shift. */
  sightingsByVehicle: Map<string, number>;
  /** The observed sightings window, for the projection. Null until loaded. */
  window: { first: string; last: string; days: number } | null;
  loading: boolean;
  error: boolean;
}

const EMPTY: FleetHistoryRows = {
  holdDates: [], flaggedVehicleIds: new Set(), sightingsByVehicle: new Map(),
  window: null, loading: true, error: false,
};

export function useFleetHistory(): FleetHistoryRows {
  const [rows, setRows] = useState<FleetHistoryRows>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [holds, sightings] = await Promise.all([
          supabase.from('holds')
            .select('vehicle_id, flagged_at, flagged_by_name')
            .gte('flagged_at', FG_RECORD_START)
            .limit(10000),
          // One row per sighting; counted client-side because the shape the cards want is a
          // distribution, and a grouped query would still need the per-car numbers to build it.
          supabase.from('vehicle_sightings').select('vehicle_id, seen_at').limit(20000),
        ]);
        if (cancelled) return;
        if (holds.error || sightings.error) { setRows(r => ({ ...r, loading: false, error: true })); return; }

        const holdDates: string[] = [];
        const flaggedVehicleIds = new Set<string>();
        for (const h of holds.data ?? []) {
          if (SEEDED_AUTHORS.includes(h.flagged_by_name ?? '')) continue;
          if (h.flagged_at) holdDates.push(h.flagged_at);
          if (h.vehicle_id) flaggedVehicleIds.add(h.vehicle_id);
        }

        const sightingsByVehicle = new Map<string, number>();
        let first = '', last = '';
        for (const s of sightings.data ?? []) {
          if (s.vehicle_id) sightingsByVehicle.set(s.vehicle_id, (sightingsByVehicle.get(s.vehicle_id) ?? 0) + 1);
          const d = (s.seen_at ?? '').slice(0, 10);
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
          holdDates, flaggedVehicleIds, sightingsByVehicle,
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
