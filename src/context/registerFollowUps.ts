import { teachClassCode } from '../hooks/useUnknownClassCode';
import type { EvAssetStatus } from '../types';

/**
 * The writes that happen AFTER a registration has already succeeded.
 *
 * Five of them — attach the source key tag, log the EV asset check, release a unit number the
 * conflict reconciliation freed, promote the plate registry sighting, teach the class codex — and
 * they share one rule that is the reason they live together:
 *
 * ⚠️ **None of them may fail the registration.** The vehicle row exists by the time any of this
 * runs. An error that bubbled up and reset `submitting` would invite a second tap and mint a
 * DUPLICATE CAR. A lost asset log costs one re-check in the EV Assets tab; a duplicate costs a
 * fleet record and the hunt to find it. So each one is best-effort, and the two whose failure the
 * operator actually needs to know about are REPORTED rather than thrown.
 *
 * Extracted from `RegisterVehicleForm.handleSubmit` 2026-08-25 (the form crossed the 330 cap when
 * registration adopted the shared EV control). It was always a separable unit; being inside a
 * 107-line submit handler is what kept it untested.
 */
export interface RegisterFollowUpOps {
  attachKeytagPhotoIfMissing: (vehicleId: string, photo: string) => Promise<void>;
  updateVehicleEVAssets: (vehicleId: string, cable: boolean, adapter: boolean, source: 'vsa_washbay') => Promise<boolean>;
  releaseUnitNumber: (vehicleId: string) => Promise<void>;
  remember: (plate: string, m: { vehicleId: string; unitNumber: string }) => unknown;
}

export interface RegisterFollowUpInput {
  vehicleId: string;
  unit: string;
  plate: string;
  make: string;
  model: string;
  isTesla: boolean;
  /** Both non-null = he answered. Null = "didn't check" — register as not assessed, log nothing. */
  cable: EvAssetStatus | null;
  adapter: EvAssetStatus | null;
  keytagPhoto?: string;
  /** The record that wrongly held this unit#, when the operator confirmed the conflict. */
  conflictVehicleId?: string;
  /** Non-empty only when the scan carried a code the codex could NOT resolve. */
  teachCode?: string;
  userId?: string;
}

export interface RegisterFollowUpResult {
  /** The car registered but the asset check didn't land — must be surfaced, never swallowed. */
  evLogFailed: boolean;
  /** The car registered but the old record still holds the unit# — a recoverable duplicate. */
  releaseFailed: boolean;
}

export async function runRegisterFollowUps(
  input: RegisterFollowUpInput,
  ops: RegisterFollowUpOps,
): Promise<RegisterFollowUpResult> {
  const { vehicleId, unit, plate, make, model, isTesla, cable, adapter } = input;

  // The scan-router only attaches tags to already-KNOWN cars, so a scan-to-register otherwise left
  // the fresh record with no tag on file — the one case where the source tag matters most, since
  // it's the only evidence the OCR'd identity can later be audited against.
  if (input.keytagPhoto) void ops.attachKeytagPhotoIfMissing(vehicleId, input.keytagPhoto);

  // ⚡ Logged through the SAME path the EV Assets tab uses, so it arrives in the asset history with
  // its source rather than as a silent column write. Source is 'vsa_washbay' because EvSource
  // answers WHERE the check happened, not who did it.
  //
  // ⚠️ Check the RETURN, not a thrown error. `updateVehicleEVAssets` does not throw — it swallows
  // the Supabase error and returns false — so a try/catch here would be dead code reporting a lost
  // assessment as a clean registration.
  //
  // BOTH must be answered: `updateVehicleEVAssets` takes the pair in one call, there is no
  // single-asset write. In practice they're never half-answered — the control fills both on mount
  // and "Didn't check" clears both — so this reads as "he didn't withdraw it".
  //
  // ⚠️ AND caught anyway. The return-value check above is the documented path, but it only holds
  // while `updateVehicleEVAssets` keeps swallowing its own errors — a network failure before that
  // swallow would throw, escape to `handleSubmit`'s catch, reset `submitting`, and invite the
  // second tap that mints a duplicate car. Relying on a collaborator never to throw is not a
  // guarantee, it's a hope with a comment attached. Both outcomes mean the same thing to him:
  // registered, asset check lost, re-log it in the tab.
  let evLogFailed = false;
  if (isTesla && cable !== null && adapter !== null) {
    try {
      evLogFailed = !(await ops.updateVehicleEVAssets(vehicleId, cable === 'present', adapter === 'present', 'vsa_washbay'));
    } catch { evLogFailed = true; }
  }

  // The new vehicle now carries the number, so release it from the record it was stapled to in
  // error. A failure leaves a recoverable duplicate rather than a lost unit# — but "recoverable"
  // only helps if he knows to look, so it's reported instead of swallowed.
  let releaseFailed = false;
  if (input.conflictVehicleId) {
    try { await ops.releaseUnitNumber(input.conflictVehicleId); } catch { releaseFailed = true; }
  }

  // Point any remembered registry sighting for this plate at the now-canonical vehicle.
  // Bookkeeping only — losing it costs nothing the operator would notice, so it isn't reported;
  // but it is CAUGHT, because a synchronous throw here would take the registration down with it.
  try { void ops.remember(plate, { vehicleId, unitNumber: unit }); } catch { /* best-effort */ }

  // The tag printed a code the codex couldn't resolve and he just told us what the car IS — so
  // learn it, and the NEXT scan of this code fills make/model on its own. Teach what he CONFIRMED,
  // never what the reader guessed: a blank box teaches nothing, because no entry beats a wrong one
  // (a bad code resolves a future car to the wrong vehicle).
  try {
    if (input.teachCode) void teachClassCode(input.teachCode, make, model, input.userId);
  } catch { /* best-effort — a codex miss costs one manual entry, never the registration */ }

  return { evLogFailed, releaseFailed };
}
