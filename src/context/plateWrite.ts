import { supabase, writeWithRefresh } from '../lib/supabase';
import { normalizePlate } from '../lib/fleetAudit';
import { shouldOfferPlateUpdate } from '../lib/plateDifference';
import type { Vehicle } from '../types';

/** Adopts a NEW PLATE off a key tag when the car has been re-plated.
 *
 *  Aaron, 2026-08-26, with a Suburban that came from Calgary on `0GK641` and got Manitoba plates:
 *  *"the only change on a replate is the plate."*
 *
 *  ⚠️ THE OPPOSITE OF EVERY OTHER TAG WRITE IN HERE. `vinWrite` and `classCodeWrite` fill blanks and
 *  never overwrite; `keytagPhotoWrite` is attach-if-missing; the scan overlay holds the plate rule
 *  *"once a vehicle RESOLVED, its record is authoritative for the plate"*. All of that exists because
 *  the cheap reader is ~87.5% on plates and a resolved car must not have a misread written over a
 *  good record. **This write deliberately overwrites a non-blank field**, so it is gated harder than
 *  the others:
 *
 *    1. `shouldOfferPlateUpdate` must agree it is a RE-PLATE and not a misread (lib/plateDifference)
 *       — the same guard the UI used to decide whether to offer at all, restated here so the rule
 *       cannot be bypassed by a caller that forgets it.
 *    2. The operator has to have tapped. Nothing here fires from a scan alone.
 *
 *  ⚠️ Stamped `manual`, not `tag`. The tag is where the plate CAME from, but a human confirming a
 *  re-plate outranks a later scan — otherwise the next read of an old tag still lying in the car
 *  would put the Alberta plate straight back. Provenance ladder: inferred < tag < manual.
 *
 *  Race-safe via the `eq` on the OLD plate: two near-simultaneous adoptions cannot double-apply, and
 *  a plate that already moved on is left alone rather than clobbered.
 */
export function makeAdoptPlate(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  currentVehicle: (vehicleId: string) => Vehicle | undefined;
}) {
  const { setAllVehicles, currentVehicle } = deps;

  return async (vehicleId: string, tagPlate: string): Promise<boolean> => {
    const next = normalizePlate(tagPlate);
    const vehicle = currentVehicle(vehicleId);
    const previous = vehicle?.licensePlate ?? '';
    if (!next || !vehicle) return false;
    // The guard, restated server-of-the-UI side. A misread must never reach the write.
    if (!shouldOfferPlateUpdate(next, previous)) return false;

    const sources = { ...(vehicle.fieldSources ?? {}), licensePlate: 'manual' as const };

    // ⭐⭐ THE STORED PHOTO IS NOW OUT OF DATE, AND THIS IS THE MOMENT WE KNOW IT. This offer only
    // fires when the TAG is newer than the record — so the photo already on file was shot on the
    // OLD plate, and `keytagPhotoWrite` is attach-if-missing, meaning this very scan will not
    // replace it. FG has never said so: Aaron's Suburban carried an Alberta-plate photo for five
    // days, through a full audit that verified all four surviving fields, and nothing anywhere
    // mentioned that the plate line was wrong.
    //
    // ⚠️ 'stale', NOT 'unreadable'. That tag is perfectly legible; the errand is a photo of a
    // DIFFERENT tag, not a better photo of the same one (migration 134, and see KeytagAuditResult).
    // Aaron, 2026-08-31: *"i'd say just flag it for a retake the next time it comes in."*
    //
    // ⚠️ ONLY IF A PHOTO ALREADY EXISTS. A car with none is about to receive THIS scan's photo,
    // which shows the new plate — flagging that as stale would be wrong the instant it landed.
    // And `keytag_audited_at` is cleared so a fresh capture re-queues the audit rather than
    // leaving a verified stamp sitting on top of a replaced tag.
    const stale = !!vehicle.keytagPhotoUrl;
    const patch = stale
      ? { license_plate: next, field_sources: sources,
          keytag_audit_result: 'stale' as const, keytag_audited_at: null }
      : { license_plate: next, field_sources: sources };

    const { data, error } = await writeWithRefresh(() =>
      supabase
        .from('vehicles')
        .update(patch)
        .eq('id', vehicleId)
        .eq('license_plate', previous)
        .select('id')
    );
    if (error || !data?.length) return false;
    setAllVehicles(prev => prev.map(v => (v.id === vehicleId
      ? { ...v, licensePlate: next, fieldSources: sources,
          ...(stale ? { keytagAuditResult: 'stale' as const, keytagAuditedAt: undefined } : {}) }
      : v)));
    return true;
  };
}
