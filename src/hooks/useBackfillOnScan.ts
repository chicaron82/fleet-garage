// Blanks-only identity backfill for an ON-RECORD car, applied at the moment a key tag is scanned.
//
// The bug this exists to kill (found live on the lot, LZM534 2026-07-18): FG read the whole tag —
// unit#, make, model, year — then threw it away because the surface only wanted the plate. Every
// path that handles an ALREADY-REGISTERED car did this; only the new-car register path had the
// identity threaded through. That's backwards for the geotab placeholders (make=''/model=''/year=0)
// which were designed to self-heal on scan.
//
// The fix is positional: backfill where the scan RESOLVES, not at each destination — so whatever
// the operator routes to next (hold / view / trip) already sees a complete record. Safe without an
// approval gate because of resolveKeytag's contract: FILL blanks, FLAG conflicts, never overwrite a
// value a human confirmed.
//
// NOT the same job as `useRegisterOnScan`, which also REGISTERS unknown plates so a movement isn't
// logged against a car FG doesn't know. This one deliberately never creates a fleet row — the
// scan-router keeps offering "Register" as the operator's choice. See docs/ticket-backfill-at-scan.md.
import { useCallback, useState } from 'react';
import { resolveKeytagScan, backfillFieldsOnScan, keytagConflictsOnScan, conflictNote, changeNote, fillNote } from '../lib/resolveKeytagScan';
import { firstPhotoNote, isBlankField } from '../lib/keytagAuditQueue';
import type { useVehicleHoldContext } from '../context/VehicleHoldContext';
import type { KeytagRead } from '../../api/_lib/keytagRead';

export function useBackfillOnScan(deps: {
  vehicles: ReturnType<typeof useVehicleHoldContext>['vehicles'];
  updateVehicleFields: ReturnType<typeof useVehicleHoldContext>['updateVehicleFields'];
  /** Optional: when a caller has the tag PHOTO, backfill also becomes the universal capture point —
   *  a known vehicle lacking a keytag photo gets one, on every surface that routes a scan through
   *  here. If-missing, so it never clobbers a good tag. Omit on surfaces with no photo. */
  attachKeytagPhotoIfMissing?: ReturnType<typeof useVehicleHoldContext>['attachKeytagPhotoIfMissing'];
}) {
  const { vehicles, updateVehicleFields, attachKeytagPhotoIfMissing } = deps;
  const [backfillToast, setBackfillToast] = useState<string | null>(null);
  // The disagreement half. Deliberately NOT auto-cleared like the fill toast: a fill is
  // good news that can flash by, a conflict is something he has to decide about, and it
  // dies with the scan card anyway.
  const [conflictToast, setConflictToast] = useState<string | null>(null);

  /** Given a key-tag read: if it matches an on-record car with blank fields, fill them. No-ops for
   *  a new plate, a complete record, or a read that adds nothing. Never throws — a failed write
   *  must not block what the operator came here to do. */
  const backfillFromRead = useCallback(async (read: KeytagRead, photo?: string) => {
    // Universal keytag capture: if the caller handed us the tag photo and this scan resolves to a
    // KNOWN vehicle, save the photo when it lacks one — independent of whether there's anything to
    // backfill (a complete known car still deserves its source tag on file). If-missing, never a
    // clobber. This is the shared choke-point (scan-router + holds search route through here).
    // ⭐⭐ AND SAY SO WHEN IT WAS THE CAR'S FIRST. He came here to start a trip or write up the
    // closing inventory; taking a car off the photo backlog is something the scan did FOR him,
    // which is the whole definition of a fact worth a receipt.
    let photoNote = '';
    let photoPlate = '';
    if (photo && attachKeytagPhotoIfMissing) {
      const known = resolveKeytagScan(read, vehicles).vehicle;
      if (known) {
        // ⚠️ Checked BEFORE the write, because the attach is if-missing and reports nothing back.
        const hadNone = isBlankField(known.keytagPhotoUrl);
        void attachKeytagPhotoIfMissing(known.id, photo);
        if (hadNone) {
          // ⚠️ Same predicate auditQueueStats uses for `noPhoto`, so this line and the audit card
          // can never disagree about how many are left. Minus this one, which is now captured.
          photoNote = firstPhotoNote(vehicles.filter(v => isBlankField(v.keytagPhotoUrl)).length - 1);
          photoPlate = known.licensePlate;
        }
      }
    }
    // Say the disagreement out loud BEFORE the write — it's independent of whether there
    // was anything to fill, and it used to be swallowed entirely on this surface.
    const cf = keytagConflictsOnScan(read, vehicles);
    setConflictToast(cf ? conflictNote(cf.conflicts) : null);

    const bf = backfillFieldsOnScan(read, vehicles); // partial with fills and/or changes, else null
    // ⚠️ A COMPLETE RECORD USED TO RETURN HERE SILENTLY — and that is exactly the car whose first
    // photo just got captured, since a complete record has nothing to backfill. The capture receipt
    // has to survive the early return or the only case it exists for is the one it misses.
    if (!bf) {
      if (photoNote) {
        setBackfillToast(`✨ ${photoPlate} · ${photoNote}`);
        setTimeout(() => setBackfillToast(null), 3000);
      }
      return;
    }
    try {
      const res = await updateVehicleFields(bf.vehicleId, bf.applies); // fills + corrections, stamped 'tag'
      // ⭐ The tag's unit number collided with another live record, so it was NOT applied. Say it
      // HERE, at the scan, because this is the one moment he is holding the key tag — the only
      // thing that can settle which record is right. Both of this week's duplicate-unit findings
      // were created by this write and surfaced days later on a board instead.
      if (res?.unitConflict) {
        const other = res.unitConflict;
        setConflictToast(`⚠️ Unit ${bf.applies.find(f => f.field === 'unitNumber')?.value} is already on `
          + `${other.licensePlate} — not applied. Same car, or has the number moved?`);
      }
      // Show the work — never write silently. A fill is new info; a change OVERRODE a stale value
      // (an inferred guess or older tag read self-healing), which is worth saying more loudly.
      // ⚠️ APPLIED, not planned. `bf.fills` is what the tag OFFERED; when the unit number collides it
      // is skipped, and reporting it anyway would have the success toast claim a write that never
      // happened — beside a warning saying it didn't. Found at /reflect 61, an hour after shipping
      // the guard: I added the refusal and left the boast intact.
      const applied = res?.unitConflict ? bf.fills.filter(f => f.field !== 'unitNumber') : bf.fills;
      // ⚠️ Was joining raw `f.field` here — so this half said `unitNumber` while `changeNote`, one
      // line down, said `class` for the same kind of thing. One vocabulary, one place.
      const filled = fillNote(applied);
      const changed = changeNote(bf.changes);
      const note = [filled, changed, photoNote].filter(Boolean).join(' · ');
      if (note) {
        setBackfillToast(`✨ ${bf.plate} · ${note}`);
        setTimeout(() => setBackfillToast(null), 3000);
      }
    } catch { /* non-blocking */ }
  }, [vehicles, updateVehicleFields, attachKeytagPhotoIfMissing]);

  return { backfillToast, conflictToast, backfillFromRead };
}
