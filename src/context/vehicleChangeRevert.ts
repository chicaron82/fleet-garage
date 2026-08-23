import { supabase, writeWithRefresh } from '../lib/supabase';
import { planRevert } from '../lib/changeRevert';
import { mapVehicle } from '../lib/garage-mappers';
import type { Vehicle } from '../types';
import type { Database } from '../types/database.types';

/** The generated Update shape. The patch's keys come from the TRIGGER's own record of these columns,
 *  so they are valid by construction — but a dynamically-built object cannot prove that to the
 *  typed client, and widening every column to optional-unknown is exactly what this alias says. */
type VehicleUpdate = Database['public']['Tables']['vehicles']['Update'];

/** Undo one entry in a car's change log (migrations/118 wrote the trail; this reads it backwards).
 *
 *  ⭐ THE CASE IT WAS BUILT FOR. A key-tag scan of LUR443 landed on LUR243's record and overwrote
 *  its identity — unit, make, model, year, colour, class, plus a class code, an owning number, a
 *  key count and the other car's tag photo. LUR243 is a real, different car carrying an "AC / heat
 *  issue" hold. Nothing was lost, because the log had every previous value; but restoring them
 *  meant eleven hand-written fields, two of which the UI cannot edit at all.
 *
 *  ⚠️⚠️ IT PLANS AGAINST THE DATABASE, NOT THE CLIENT'S COPY. The screen's vehicle object can be
 *  minutes stale, and "has anything moved since?" is the entire safety question — asking a stale
 *  object is asking the wrong witness. So the row is re-read inside the write, immediately before
 *  the decision, and `planRevert` refuses outright if any field has drifted rather than restoring
 *  the rest. See lib/changeRevert for why a HALF revert is worse than none.
 *
 *  The revert is itself logged by the same trigger, so undoing a mistake is as auditable as making
 *  one — which is the property that makes it safe to offer at all. */
export function makeRevertVehicleChange(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
}) {
  const { setAllVehicles } = deps;

  return async (
    vehicleId: string,
    changed: Record<string, unknown>,
    op: 'UPDATE' | 'DELETE',
  ): Promise<void> => {
    const { data: row, error: readErr } = await supabase
      .from('vehicles').select('*').eq('id', vehicleId).single();
    if (readErr || !row) throw new Error('Could not read the record to check it first.');

    const plan = planRevert(changed, row as Record<string, unknown>, op);
    if (!plan.ok) throw new Error(plan.reason);

    const { data: updated, error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update(plan.patch as VehicleUpdate).eq('id', vehicleId).select().single()
    ) as { data: unknown; error: unknown };
    if (error) throw new Error(`Could not undo it: ${(error as { message?: string }).message}`);

    // Re-map from what the DB actually returned rather than patching the local object by hand —
    // a revert touches columns no other write does, and a hand-merged copy would drift from truth.
    if (updated) {
      const fresh = mapVehicle(updated as Record<string, unknown>);
      setAllVehicles(prev => prev.map(v => (v.id === vehicleId ? fresh : v)));
    }
  };
}
