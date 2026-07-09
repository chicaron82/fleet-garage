import { supabase, writeWithRefresh } from '../lib/supabase';
import type { Vehicle } from '../types';
import type { KeytagFill } from '../lib/resolveKeytag';

/** The `vehicles` row shape a backfill can touch — typed explicitly (not a generic
 *  Record) because the Supabase client rejects an untyped update payload. */
interface VehicleFieldsUpdate {
  unit_number?: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
}

/** Applies keytag-read FILLS (blanks-only — resolveKeytag's backfill principle never
 *  overwrites a value that was already there) to an existing vehicle's identity fields.
 *  Single-purpose write, extracted to keep useVehicleOperations under the line cap
 *  (mirrors evAssetWrite.ts). */
export function makeUpdateVehicleFields(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
}) {
  const { setAllVehicles } = deps;

  return async (vehicleId: string, fills: KeytagFill[]): Promise<void> => {
    if (fills.length === 0) return;
    const payload: VehicleFieldsUpdate = {};
    const patch: Partial<Pick<Vehicle, 'unitNumber' | 'make' | 'model' | 'year' | 'color'>> = {};
    for (const f of fills) {
      if (f.field === 'unitNumber') { payload.unit_number = f.value as string; patch.unitNumber = f.value as string; }
      else if (f.field === 'year')  { payload.year = f.value as number; patch.year = f.value as number; }
      else                          { payload[f.field] = f.value as string; patch[f.field] = f.value as string; }
    }
    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update(payload).eq('id', vehicleId)
    );
    if (error) throw new Error(`Failed to update vehicle: ${(error as { message?: string }).message}`);
    setAllVehicles(prev => prev.map(v => (v.id === vehicleId ? { ...v, ...patch } : v)));
  };
}
