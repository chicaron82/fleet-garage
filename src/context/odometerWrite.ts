import { supabase, writeWithRefresh } from '../lib/supabase';
import { shouldReplaceOdometer } from '../lib/odometer';
import type { Vehicle } from '../types';

/** Records the odometer the airport flip already collects (migrations/123).
 *
 *  ⭐ LATEST WINS — the deliberate opposite of classCodeWrite's first-good-read-wins. A class code
 *  never changes over a car's life, so an early reading is as true as a late one and a later scan
 *  must not clobber it. An odometer only ever moves FORWARD, so the newest reading is always the
 *  best one — and a LOWER number arriving later is a misread or the wrong car, never a fact
 *  (see lib/odometer.shouldReplaceOdometer).
 *
 *  The guard is restated server-side (`odometer.lt.N`) so two near-simultaneous flips can't have the
 *  older one land last. `or=(odometer.is.null,...)` covers the first reading.
 *
 *  Best-effort by contract: a failed write must never cost the flip that triggered it — the counter
 *  copy-out is the operator's actual job, and this is bookkeeping riding along behind it. */
export function makeRecordOdometer(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  currentOdometer: (vehicleId: string) => number | null | undefined;
}) {
  const { setAllVehicles, currentOdometer } = deps;

  return async (vehicleId: string, km: number): Promise<void> => {
    if (!shouldReplaceOdometer(currentOdometer(vehicleId), km)) return;
    const at = new Date().toISOString();
    const { data, error } = await writeWithRefresh(() =>
      supabase
        .from('vehicles')
        .update({ odometer: km, odometer_at: at })
        .eq('id', vehicleId)
        .or(`odometer.is.null,odometer.lt.${km}`)
        .select('id')
    );
    if (error || !data?.length) return; // 0 rows = a higher reading already landed → don't diverge
    setAllVehicles(prev => prev.map(v => (v.id === vehicleId ? { ...v, odometer: km, odometerAt: at } : v)));
  };
}
