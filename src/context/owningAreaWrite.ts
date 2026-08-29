import { supabase, writeWithRefresh } from '../lib/supabase';
import type { Vehicle } from '../types';
import { normalizeOwning } from '../../api/_lib/owningArea';

/** Records the OWNING branch read off a key tag — but only onto a vehicle that has none yet.
 *
 *  The owning number ("8199" Winnipeg, "8193" Calgary…) sits on every tag's class line and FG threw
 *  it away for the scanner's whole life. It's the input to a real decision: a car sent one-way from
 *  another branch may be kept and re-plated to Manitoba, and until now nothing on the record said
 *  where a car came from.
 *
 *  IF-MISSING, deliberately, and this one is stricter than it looks:
 *   • Every vehicle registered before 2026-08-18 has no owning, so the field fills in as tags get
 *     scanned. Nothing is backfilled — inventing an owning would be worse than an empty one.
 *   • A car's owning does NOT change when it's flipped ("the unit number and owning would remain
 *     the same but then the license would be changed"). So once set it should stay set, and a later
 *     scan that mis-reads the number must not overwrite a good value. First good read wins; a
 *     correction is a deliberate act, not a side effect of any scan.
 *
 *  Race-safe via `.is(null)` — the same guard `keytagPhotoWrite` uses — so two near-simultaneous
 *  scans can't clobber each other. Best-effort by contract: a failed write must never cost the scan
 *  that triggered it. Single-purpose sibling write (see keytagPhotoWrite / keyCountWrite). */
export function makeRecordOwningArea(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  /** Latest known owning for a vehicle (render-time is fine) — lets us skip the round trip in the
   *  common already-known case; the `.is(null)` guard below is the race-safe backstop. */
  currentOwning: (vehicleId: string) => string | null | undefined;
}) {
  const { setAllVehicles, currentOwning } = deps;

  return async (vehicleId: string, rawOwning: string): Promise<void> => {
    // Normalised here as well as in the read. Today's only caller hands over an already-normalised
    // value from `keytag-read`, but that is a guarantee living in the CALLER — and a rule that lives
    // in the caller is a rule the next caller does not inherit. Costs nothing when it is already
    // clean. (The auditor's hand-typed path is the caller that proved it.)
    const owningArea = normalizeOwning(rawOwning);
    if (!owningArea) return;
    if (currentOwning(vehicleId)) return; // already known — never clobber
    const { data, error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({ owning_area: owningArea }).eq('id', vehicleId).is('owning_area', null).select('id')
    );
    if (error || !data?.length) return; // 0 rows = someone filled it first → don't diverge local state
    setAllVehicles(prev => prev.map(v => (v.id === vehicleId ? { ...v, owningArea } : v)));
  };
}
