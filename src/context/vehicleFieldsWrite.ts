import { supabase, writeWithRefresh } from '../lib/supabase';
import type { Vehicle, FieldSource } from '../types';
import type { KeytagFill } from '../lib/resolveKeytag';

/** The `vehicles` row shape a backfill can touch — typed explicitly (not a generic
 *  Record) because the Supabase client rejects an untyped update payload. */
interface VehicleFieldsUpdate {
  unit_number?: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  rental_class?: string;
  field_sources?: Record<string, FieldSource>;
}

/** Applies key-tag-read FILLS + CHANGES (blanks and non-locked corrections — resolveKeytag decides
 *  which, and a LOCKED/manual field never reaches here) to a vehicle's identity fields, and stamps
 *  each applied field's provenance as 'tag'. This is the TAG write path; the manual-edit path stamps
 *  'manual' instead (directEditVehicleIdentity). Single-purpose, extracted to keep
 *  useVehicleOperations under the line cap (mirrors evAssetWrite.ts). */
export function makeUpdateVehicleFields(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
}) {
  const { setAllVehicles } = deps;

  return async (vehicleId: string, fills: KeytagFill[]): Promise<void> => {
    if (fills.length === 0) return;
    const payload: VehicleFieldsUpdate = {};
    const patch: Partial<Pick<Vehicle, 'unitNumber' | 'make' | 'model' | 'year' | 'color' | 'rentalClass'>> = {};
    const stamps: Record<string, FieldSource> = {};
    for (const f of fills) {
      if (f.field === 'unitNumber')       { payload.unit_number = f.value as string; patch.unitNumber = f.value as string; }
      else if (f.field === 'year')        { payload.year = f.value as number; patch.year = f.value as number; }
      else if (f.field === 'rentalClass') { payload.rental_class = f.value as string; patch.rentalClass = f.value as string; }
      else                                { payload[f.field] = f.value as string; patch[f.field] = f.value as string; }
      stamps[f.field] = 'tag';   // every field this path sets came from a scanned tag
    }
    // Merge the 'tag' stamps into the existing field_sources so provenance accumulates (a manual
    // edit can still lock over a tag, and vice-versa). Read-modify-write is safe on a single-operator
    // tool; if the read fails we still stamp what we're setting rather than lose provenance.
    const { data: cur } = await supabase.from('vehicles').select('field_sources').eq('id', vehicleId).maybeSingle();
    const existingSources = (cur && typeof cur.field_sources === 'object' && cur.field_sources)
      ? (cur.field_sources as Record<string, FieldSource>) : {};
    const merged = { ...existingSources, ...stamps };
    payload.field_sources = merged;

    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update(payload).eq('id', vehicleId)
    );
    if (error) throw new Error(`Failed to update vehicle: ${(error as { message?: string }).message}`);
    setAllVehicles(prev => prev.map(v => (v.id === vehicleId ? { ...v, ...patch, fieldSources: merged } : v)));
  };
}
