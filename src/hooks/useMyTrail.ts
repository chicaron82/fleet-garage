// The cars HE has been at today — the other axis on `vehicle_changes`.
//
// Its own hook rather than a branch of useVehicleChanges: that one is "what has this RECORD been
// edited to" (one car, many actors); this is "where has HE been" (one actor, many cars). Same split
// reasoning that separated useVehicleSightings.
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { TrailChangeRow } from '../lib/myTrail';

// A shift's worth of writes with headroom. He is FG's only real writer, so this is generous.
const MAX_ROWS = 200;

/** Local midnight, ISO — the window the headline's word "today" is actually claiming. */
export function startOfToday(now: Date = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * @param actors his profile id, plus any agent name that writes as him (`dizee`).
 *
 * ⚠️ FILTERED IN SQL, not in the client. The bulk import alone is 3,383 rows; pulling the lot down
 * to discard 95% of it on his phone would make a card that exists to feel good cost him a payload.
 */
export function useMyTrail(actors: readonly string[], sinceISO: string): TrailChangeRow[] {
  const key = actors.join(',');
  const [rows, setRows] = useState<TrailChangeRow[]>([]);

  useEffect(() => {
    const list = key.split(',').filter(Boolean);
    if (list.length === 0) return;   // nothing to fetch — the empty case is DERIVED below, not set
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from('vehicle_changes')
        .select('vehicle_id, changed_at, op, changed, actor')
        .in('actor', list)
        .gte('changed_at', sinceISO)
        .order('changed_at', { ascending: false })
        .limit(MAX_ROWS);
      if (cancelled) return;
      setRows((data ?? []).map(r => ({
        vehicleId: (r.vehicle_id as string) ?? '',
        changedAt: r.changed_at as string,
        op: (r.op === 'DELETE' ? 'DELETE' : 'UPDATE') as TrailChangeRow['op'],
        changed: (r.changed ?? {}) as Record<string, unknown>,
        actor: (r.actor as string | null) ?? null,
      })));
    }
    void load();
    return () => { cancelled = true; };
  }, [key, sinceISO]);

  // ⭐ DERIVED, not stored. Clearing rows with `setRows([])` inside the effect is a synchronous
  // setState in an effect body (react-hooks/set-state-in-effect) — and derived state cannot go
  // stale, which stored state always can. Same correction as LocationSearchInput's `visible`.
  return key ? rows : [];
}
