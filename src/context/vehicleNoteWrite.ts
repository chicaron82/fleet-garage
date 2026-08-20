import { supabase, writeWithRefresh } from '../lib/supabase';
import type { Vehicle } from '../types';

/** Sets — or clears — the car's current note (migrations/122). The tier below a hold: for the
 *  facts about a car that don't earn the full instrument. Aaron: *"I don't hold every single
 *  damage in FG… leaving a note addresses that at some point there was damage and it's getting
 *  sent fixed."*
 *
 *  Passing `null` CLEARS it, and clearing is not deletion — migration 118's trigger records
 *  `{note: {from: "…", to: null}}` on the way out, so the car keeps the memory in its change trail.
 *  That's the whole reason the note is a column rather than its own table: if the damage was never
 *  held, the note is the only trace it existed, and losing it on clear would recreate the exact
 *  old-damage amnesia FG was built against.
 *
 *  `note_at` is stamped here rather than by the caller so every write agrees on what "when" means,
 *  and cleared alongside the note so a stale timestamp can never outlive its sentence.
 *
 *  Single-purpose sibling write, same shape as keyCountWrite/evAssetWrite — keeps
 *  useVehicleOperations under the line cap. */
export function makeSetVehicleNote(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
}) {
  const { setAllVehicles } = deps;

  return async (vehicleId: string, note: string | null): Promise<void> => {
    const trimmed = note?.trim() || null;          // whitespace-only is not a note
    const noteAt = trimmed ? new Date().toISOString() : null;
    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({ note: trimmed, note_at: noteAt }).eq('id', vehicleId)
    );
    if (error) throw new Error(`Failed to save note: ${(error as { message?: string }).message}`);
    setAllVehicles(prev => prev.map(v => (v.id === vehicleId ? { ...v, note: trimmed, noteAt } : v)));
  };
}
