import { supabase, writeWithRefresh } from '../lib/supabase';
import type { Vehicle, FieldSource } from '../types';

/** Release a manual lock on ONE identity field — the un-lock half of the provenance ladder
 *  (inferred < tag < manual). Deletes the field's key from `field_sources` rather than setting it
 *  to some other value: absence already means "not locked, freely overwritable" per the existing
 *  contract (resolveKeytag / directEditVehicleIdentity), so no new state was needed.
 *
 *  Deliberately does NOT touch the field's actual VALUE or re-run a scan — unlocking and editing
 *  are different decisions (Aaron may want "let tags update this again" without changing today's
 *  value). The next scan of that car applies the tag normally through the existing change-and-warn
 *  path. Single-purpose, extracted to keep useVehicleOperations under the line cap (mirrors
 *  vehicleFieldsWrite.ts / evAssetWrite.ts / keyCountWrite.ts). */
export function makeUnlockVehicleField(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
}) {
  const { setAllVehicles } = deps;

  return async (vehicleId: string, field: string): Promise<void> => {
    const { data: cur } = await supabase.from('vehicles').select('field_sources').eq('id', vehicleId).maybeSingle();
    const existingSources = (cur && typeof cur.field_sources === 'object' && cur.field_sources)
      ? (cur.field_sources as Record<string, FieldSource>) : {};
    if (!(field in existingSources)) return; // already unlocked — nothing to write

    const rest = { ...existingSources };
    delete rest[field];
    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({ field_sources: rest }).eq('id', vehicleId)
    );
    if (error) throw new Error(`Failed to unlock ${field}: ${(error as { message?: string }).message}`);
    setAllVehicles(prev => prev.map(v => (v.id === vehicleId ? { ...v, fieldSources: rest } : v)));
  };
}
