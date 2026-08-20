import { supabase, writeWithRefresh } from '../lib/supabase';
import type { Vehicle } from '../types';

/** Records the CLASS CODE read off a key tag — but only onto a vehicle that has none yet.
 *
 *  The code ("CKSE", "CCVL") is what the codex turns into a make and model, and FG read it on every
 *  scan for the scanner's whole life without ever storing it. A record whose identity came FROM a
 *  code could not be checked against that code afterwards (migration 120).
 *
 *  IF-MISSING, and stricter than it looks — the same reasoning as owningAreaWrite:
 *   • A car's class code does not change over its life, so the FIRST good read should win.
 *   • ⚠️ A later MISREAD must never overwrite a good value. On 2026-08-19 a Seltos tag read CKSE as
 *     CKSP; if a scan could clobber the stored code, one bad read would rewrite a correct record.
 *     Correction is a deliberate act — that is what the edit form is for — never a side effect.
 *
 *  Race-safe via `.is(null)`, best-effort by contract: a failed write must never cost the scan that
 *  triggered it. Single-purpose sibling write (see owningAreaWrite / keytagPhotoWrite). */
export function makeRecordClassCode(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  /** Latest known code for a vehicle — skips the round trip in the common already-known case;
   *  the `.is(null)` guard below is the race-safe backstop. */
  currentClassCode: (vehicleId: string) => string | null | undefined;
}) {
  const { setAllVehicles, currentClassCode } = deps;

  return async (vehicleId: string, classCode: string): Promise<void> => {
    const code = classCode.trim().toUpperCase();
    if (!code) return;
    if (currentClassCode(vehicleId)) return; // already known — never clobber
    const { data, error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({ class_code: code }).eq('id', vehicleId).is('class_code', null).select('id')
    );
    if (error || !data?.length) return; // 0 rows = someone filled it first → don't diverge local state
    setAllVehicles(prev => prev.map(v => (v.id === vehicleId ? { ...v, classCode: code } : v)));
  };
}
