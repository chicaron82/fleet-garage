import { supabase, writeWithRefresh } from '../lib/supabase';
import type { Vehicle } from '../types';

/** Records the keys-on-ring count observed at a check-in. Unlike `updateVehicleFields` (which is
 *  blanks-only keytag BACKFILL and must never overwrite), this is a deliberate overwrite: the
 *  latest count IS the new truth, and the shortfall against the previous value was already
 *  surfaced to the operator at the moment of capture. Single-purpose sibling write, same shape as
 *  evAssetWrite — keeps useVehicleOperations under the line cap. */
export function makeRecordKeyCount(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
}) {
  const { setAllVehicles } = deps;

  return async (vehicleId: string, keyCount: number): Promise<void> => {
    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({ key_count: keyCount }).eq('id', vehicleId)
    );
    if (error) throw new Error(`Failed to record key count: ${(error as { message?: string }).message}`);
    setAllVehicles(prev => prev.map(v => (v.id === vehicleId ? { ...v, keyCount } : v)));
  };
}
