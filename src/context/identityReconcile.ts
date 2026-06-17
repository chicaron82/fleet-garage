import { supabase, writeWithRefresh } from '../lib/supabase';
import { withSubmitLock } from '../lib/submitLock';
import type { Vehicle } from '../types';

/**
 * Release a unit number from the record it was stapled to in error. At
 * registration the new vehicle is created separately (addVehicle already sets the
 * unit#), so "moving" a conflicting identifier collapses to a single write: null
 * the old record's unit_number, leaving its plate / make / history intact. The
 * old record survives, now visibly missing a unit# (a valid state — unit_number
 * is nullable) for follow-up. Guarded per-vehicle so a double-tap can't
 * double-apply. Extracted from useVehicleOperations to keep it under the 330-line
 * cap; closes over the same shared state the hook owns.
 */
export function makeReleaseUnitNumber(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
}) {
  return async (vehicleId: string): Promise<void> => {
    await withSubmitLock(`release-unit:${vehicleId}`, async () => {
      const { error } = await writeWithRefresh(() =>
        supabase.from('vehicles').update({ unit_number: null }).eq('id', vehicleId)
      );
      if (error) throw new Error(`Failed to release unit number: ${(error as { message?: string }).message}`);
      deps.setAllVehicles(prev => prev.map(v => v.id === vehicleId ? { ...v, unitNumber: null } : v));
    });
  };
}
