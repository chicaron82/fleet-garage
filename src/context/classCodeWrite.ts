import { supabase, writeWithRefresh } from '../lib/supabase';
import type { Vehicle } from '../types';

/** Records the CLASS CODE read off a key tag (migration 120).
 *
 *  The code ("CKSE", "CCVL") is what the codex turns into a make and model, and FG read it on every
 *  scan for the scanner's whole life without storing it — so a record whose identity came FROM a
 *  code could never be checked against it.
 *
 *  ⭐ THE WRITE RULE, and it is a three-way not a two-way (2026-08-19):
 *    • **no code**       → write it, stamped `tag`.
 *    • **derived code**  → **OVERWRITE it**, stamped `tag`. Migration 121 backfilled 480 cars from
 *      make+model+hybrid+year. Those are deductions, not readings. If the write stayed strictly
 *      if-missing, **a deduction would permanently block the truth** — a real tag could never
 *      correct a backfilled guess, and three quarters of the fleet would be frozen at whatever the
 *      codex implied. The backfill is a placeholder that yields to evidence.
 *    • **tag-read code** → **never touch it.** A car's code doesn't change, so the first real
 *      reading wins and a later MISREAD must not rewrite a good value (a Seltos tag read CKSE as
 *      CKSP on 2026-08-19; one bad angle while clearing a backlog). Correction is a deliberate act
 *      — that is what the edit form is for — never a side effect of a scan.
 *
 *  Race-safe: the filter re-states the same condition server-side, so two near-simultaneous scans
 *  can't clobber each other. Best-effort by contract — a failed write must never cost the scan that
 *  triggered it. Single-purpose sibling write (see owningAreaWrite / keytagPhotoWrite). */
export function makeRecordClassCode(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  /** The vehicle as currently known — its code AND where that code came from. */
  currentVehicle: (vehicleId: string) => Vehicle | undefined;
}) {
  const { setAllVehicles, currentVehicle } = deps;

  return async (vehicleId: string, classCode: string): Promise<void> => {
    const code = classCode.trim().toUpperCase();
    if (!code) return;

    const v = currentVehicle(vehicleId);
    const source = v?.fieldSources?.classCode;
    if (v?.classCode && (source === 'tag' || source === 'manual')) return; // a reading or his own edit stands
    if (v?.classCode === code && source === 'tag') return;

    const { data, error } = await writeWithRefresh(() =>
      supabase
        .from('vehicles')
        .update({
          class_code: code,
          field_sources: { ...(v?.fieldSources ?? {}), classCode: 'tag' },
        })
        .eq('id', vehicleId)
        // Server-side guard mirroring the rule above: fill a blank, or upgrade a derived one.
        // Anything already stamped `tag` matches neither and is left exactly as it is.
        .or('class_code.is.null,field_sources->>classCode.eq.derived')
        .select('id')
    );
    if (error || !data?.length) return; // 0 rows = a tag read already stands → don't diverge locally
    setAllVehicles(prev => prev.map(x => (x.id === vehicleId
      ? { ...x, classCode: code, fieldSources: { ...(x.fieldSources ?? {}), classCode: 'tag' } }
      : x)));
  };
}
