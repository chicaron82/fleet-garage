// The change trail for one vehicle (migrations/118).
//
// Its own hook rather than another branch of useVehicleHistory: that hook is already the vehicle
// screen's convergence point, and "what has this RECORD been edited to" is a different axis from
// "what is wrong with this CAR". Same reasoning that split useVehicleSightings out.
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { VehicleChangeRow } from '../lib/vehicleChanges';

const MAX_ROWS = 50;

/** `refreshKey` re-reads the trail. Undoing an entry WRITES a new one (the same trigger records the
 *  revert), so without this the log he is looking at goes stale the moment he uses it — still showing
 *  the entry he just undid, still offering to undo it, and a second tap would refuse with a message
 *  about his own correction. Found at /reflect 61, an hour after shipping the undo. */
export function useVehicleChanges(vehicleId: string | null | undefined, refreshKey = 0): VehicleChangeRow[] {
  // Rows are STAMPED with the vehicle they belong to and only read back on a match — the same
  // guard useVehicleSightings uses, and for the same reason: without it, the moment between
  // navigating to a new car and its fetch landing renders the PREVIOUS car's history under the new
  // car's plate. On an audit trail that is not a cosmetic glitch, it is a false record.
  const [loaded, setLoaded] = useState<{ id: string; rows: VehicleChangeRow[] } | null>(null);

  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from('vehicle_changes')
        .select('changed_at, op, changed')
        .eq('vehicle_id', vehicleId!)
        .order('changed_at', { ascending: false })
        .limit(MAX_ROWS);
      if (cancelled) return;
      setLoaded({
        id: vehicleId!,
        rows: (data ?? []).map(r => ({
          changedAt: r.changed_at as string,
          op: (r.op === 'DELETE' ? 'DELETE' : 'UPDATE') as VehicleChangeRow['op'],
          changed: (r.changed ?? {}) as Record<string, unknown>,
        })),
      });
    }
    void load();
    return () => { cancelled = true; };
  }, [vehicleId, refreshKey]);

  if (!vehicleId || loaded?.id !== vehicleId) return [];
  return loaded.rows;
}
