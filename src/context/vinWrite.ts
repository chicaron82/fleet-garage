import { supabase, writeWithRefresh } from '../lib/supabase';
import { normalizeVinLast9 } from '../../api/_lib/vinLast9';
import type { Vehicle } from '../types';

/** Records the LAST 9 OF THE VIN read off a key tag (migrations/126).
 *
 *  ⭐ FIRST GOOD READ WINS — the same rule as classCodeWrite's tag tier, and for the same reason,
 *  only stronger: a VIN is immutable for the life of the car. An early reading is exactly as true
 *  as a late one, so the write only ever fills a blank and a later misread can never rewrite a good
 *  value. There is no `derived` tier to overwrite here, because a VIN cannot be deduced from
 *  anything FG holds — it is read or it is absent.
 *
 *  WHY FG WANTS IT: it is the only identifier on the tag that survives a re-plate. Aaron's
 *  out-of-province → MB conversions keep the unit number and owning area and change the plate —
 *  the key FG searches by. Today that's caught by the unit-number fallback, which works only while
 *  unit numbers stay unique. A VIN makes the identity certain rather than inferred.
 *
 *  ⚠️ `vinLast9`, never `vin`. Nine characters, not seventeen: no WMI, no plant, no year. Anything
 *  that tries to decode a manufacturer out of this is reading a field that isn't there.
 *
 *  Race-safe: the `is.null` filter restates the condition server-side so two near-simultaneous
 *  scans can't clobber each other. Best-effort by contract — a failed write must never cost the
 *  scan that triggered it. Single-purpose sibling write (see classCodeWrite / owningAreaWrite). */
export function makeRecordVinLast9(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  currentVehicle: (vehicleId: string) => Vehicle | undefined;
}) {
  const { setAllVehicles, currentVehicle } = deps;

  return async (vehicleId: string, rawVin: string): Promise<void> => {
    const vin = normalizeVinLast9(rawVin);
    if (!vin) return;
    if (currentVehicle(vehicleId)?.vinLast9) return;   // immutable — first reading stands

    const { data, error } = await writeWithRefresh(() =>
      supabase
        .from('vehicles')
        .update({ vin_last9: vin })
        .eq('id', vehicleId)
        .is('vin_last9', null)
        .select('id')
    );
    if (error || !data?.length) return;
    setAllVehicles(prev => prev.map(v => (v.id === vehicleId ? { ...v, vinLast9: vin } : v)));
  };
}
