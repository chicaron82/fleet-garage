import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { currentUserId } from '../lib/closingInventorySync';
import type { VehicleSearchResult } from '../lib/ev-detection';

// The last three cars he found through 🔍 Find a car (migration 148).
//
// ⭐ Aaron, 2026-09-21, on the lot: *"When I tap the field it would show the last 3."* The car he
// just looked up is usually the car he needs again — for the odometer, the counter flip, the next
// question from the counter — and each return trip meant retyping the plate with gloves on.
//
// ⭐ The rows come back in the SAME SHAPE as a typeahead suggestion (`VehicleSearchResult`), so a
// recent is picked through exactly the path a typed match is. Nothing downstream can tell them apart,
// which is the point: a recent is a shortcut to a look-up, never a different kind of act.
//
// ⚠️ NOT A SIGHTING. His rule: typing something in just to look it up won't count as seen. This hook
// writes only `lookup_recents`; the sighting stays held by the overlay until an action implies he was
// actually at the car, exactly as it does for a typed plate.
//
// `enabled` is false everywhere but Find a car — the closing inventory and the airport flip share the
// lookup box, and a recents list is noise while he walks the lot entering one new car after another.

const RECENT_LIMIT = 3;
const VEHICLE_COLS = 'license_plate, unit_number, make, model, year, color, is_hybrid, is_tesla, archived_at';

export function useLookupRecents(enabled: boolean) {
  const [loaded, setLoaded] = useState<VehicleSearchResult[]>([]);
  const [reloads, setReloads] = useState(0);

  // Same shape as usePlateWatches: nothing set synchronously in the effect body, and a cancelled
  // guard so a slow response cannot repaint the list after the sheet has moved on.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    async function load() {
      const uid = await currentUserId();
      if (!uid || cancelled) return;
      const { data } = await supabase
        .from('lookup_recents')
        .select(`looked_up_at, vehicles(${VEHICLE_COLS})`)
        .eq('user_id', uid)
        .order('looked_up_at', { ascending: false })
        .limit(RECENT_LIMIT);
      if (cancelled) return;
      // A car deleted out from under a row cascades the row away, but the embed can still come back
      // null mid-flight — drop it rather than render a blank line.
      const rows = (data ?? []) as unknown as { vehicles: VehicleSearchResult | null }[];
      setLoaded(rows.map(r => r.vehicles).filter((v): v is VehicleSearchResult => v != null));
    }
    void load();
    return () => { cancelled = true; };
  }, [enabled, reloads]);

  /** Remember a car he found. An upsert on (user, car): looking it up again moves it to the top. */
  const record = useCallback(async (vehicleId: string) => {
    if (!enabled) return;
    const uid = await currentUserId();
    if (!uid) return;
    const { error } = await supabase.from('lookup_recents').upsert(
      { user_id: uid, vehicle_id: vehicleId, looked_up_at: new Date().toISOString() },
      { onConflict: 'user_id,vehicle_id' },
    );
    if (!error) setReloads(n => n + 1);
  }, [enabled]);

  return { recents: enabled ? loaded : [], record };
}
