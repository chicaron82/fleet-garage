// Batch keytag staging (docs/ticket-misc-effie-batch-stage.md): given ONE read + its
// fleet resolution, decide what to stage — a register (new to fleet), a backfill (known but
// blank fields), or a skip (nothing to do / can't). Pure so the loop in useBatchKeytagStage
// stays thin and every branch is tested. Reuses the single-scan brain (resolveKeytagScan);
// batch is that producer, looped. Builds the proposal but never stages — that's the hook's job.
import { newVehicleFromRead, plateOnlyVehicleFromRead, type KeytagScanResult } from './resolveKeytagScan';
import { buildRegisterVehicleProposal, buildUpdateVehicleProposal, describeNewVehicle, type Proposal } from '../../api/_lib/holdProposal';
import type { KeytagRead } from '../../api/_lib/keytagRead';

export type BatchAction = 'register' | 'backfill' | 'skip';

export interface BatchStagePlan {
  plate: string;
  /** The MB-prefix snap changed the read → the row shows its show-your-work. */
  wasCorrected: boolean;
  rawPlate?: string;
  action: BatchAction;
  /** Present for register / backfill — what the hook stages. Absent on skip. */
  proposal?: Proposal;
  /** Human one-liner for the result row (what happened / why skipped). */
  detail: string;
  /**
   * ⭐ A skip he can OVERRIDE — the read fell short of a full vehicle, but the plate resolved and
   * the photo is fine. Carries the plate-only proposal so the row's "Add anyway" has something to
   * stage. Absent on every skip that genuinely has nothing to offer.
   *
   * Aaron, 2026-08-30: *"the tag should upload, and i can add the details myself from the tag by
   * hand."* The photo rides on a proposal, so a skip with no proposal discards it — the model's
   * failure costing him the one artifact that did not fail.
   *
   * ⚠️ OFFERED, NEVER AUTOMATIC. The batch is exactly where a misread PLATE goes unnoticed, and an
   * automatic plate-only register would mint a junk car from one. Same posture as every other notice
   * in the scan flow: report, and leave the doing to him.
   */
  offer?: { proposal: Proposal; label: string };
}

/** Decide the batch outcome for one resolved keytag read. Never stages or writes. */
export function planBatchStage(read: KeytagRead, result: KeytagScanResult): BatchStagePlan {
  const base = { plate: result.plate, wasCorrected: result.wasCorrected, rawPlate: result.rawPlate };

  // No readable plate → nothing to match or register on. Skip loudly.
  if (!result.plate) {
    return { ...base, action: 'skip', detail: "couldn't read the plate — scan it alone" };
  }

  const { resolution } = result;

  if (resolution.kind === 'new') {
    const nv = newVehicleFromRead(read, result.plate);
    if (!nv) {
      const partial = plateOnlyVehicleFromRead(read, result.plate);
      return {
        ...base,
        action: 'skip',
        detail: "not in fleet, and the read is short of make/model/unit/year",
        offer: {
          proposal: buildRegisterVehicleProposal(partial, false),
          label: 'Add anyway — keeps the tag photo',
        },
      };
    }
    return { ...base, action: 'register', proposal: buildRegisterVehicleProposal(nv, nv.make === 'Tesla'), detail: `register ${describeNewVehicle(nv)}` };
  }

  if (resolution.kind === 'complete') {
    return { ...base, action: 'skip', detail: 'already in the fleet — nothing to add' };
  }

  // partial: fill blanks if there are any; conflicts alone aren't auto-applied.
  if (resolution.fills.length > 0 && result.vehicle) {
    return {
      ...base,
      action: 'backfill',
      proposal: buildUpdateVehicleProposal(result.vehicle.id, result.plate, resolution.fills),
      detail: `backfill ${resolution.fills.map((f) => `${f.field} ${f.value}`).join(', ')}`,
    };
  }
  return { ...base, action: 'skip', detail: 'in the fleet; the tag only disagrees — nothing to fill' };
}
