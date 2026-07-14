// The pure heart of the log-damage drop-n-go: a resolved key-tag scan + a damage description
// → the branch-correct hold-bearing proposal to stage. No I/O, no write — the caller
// (useDamageIntake) does the reads and the staging; this just decides WHICH hold proposal the
// three resolution branches produce:
//   new      → register_and_hold   (register the unknown vehicle + damage hold)
//   complete → hold                (damage hold on the known vehicle)
//   partial  → update_and_hold     (backfill the blank fields + damage hold, blanks-only)
// See docs/ticket-effie-damage-drop-intake.md.
import {
  buildHoldProposal,
  buildRegisterHoldProposal,
  buildUpdateAndHoldProposal,
  type Proposal,
} from '../../api/_lib/holdProposal';
import { newVehicleFromRead, type KeytagScanResult } from './resolveKeytagScan';
import type { KeytagRead } from '../../api/_lib/keytagRead';
import type { Vehicle } from '../types';

/** "Unit 1234 · 2026 Toyota Corolla (White)" — the hold card's target label for a fleet row. */
function vehicleLabel(v: Vehicle): string {
  const veh = [v.year, v.make, v.model].filter(Boolean).join(' ');
  const head = [v.unitNumber ? `Unit ${v.unitNumber}` : '', veh].filter(Boolean).join(' · ');
  const base = head || v.licensePlate;
  return v.color ? `${base} (${v.color})` : base;
}

export type DamageIntakeBlock =
  | { ok: true; proposal: Proposal }
  /** The tag read new-to-fleet but couldn't fill a registerable identity (need make/model/
   *  unit/year) — the caller falls back to "add it via Effie chat / read them off". */
  | { ok: false; reason: 'unreadable_new' };

export function buildDamageIntakeProposal(
  read: KeytagRead,
  result: KeytagScanResult,
  description: string,
  holdType = 'damage',
): DamageIntakeBlock {
  const { resolution, plate, vehicle } = result;

  if (resolution.kind === 'new') {
    const nv = newVehicleFromRead(read, plate);
    if (!nv) return { ok: false, reason: 'unreadable_new' };
    return { ok: true, proposal: buildRegisterHoldProposal(nv, holdType, description) };
  }

  // complete / partial both mean a matched fleet vehicle (resolveKeytagScan only returns
  // those kinds when it found one) — the guard is defensive type-narrowing.
  if (!vehicle) return { ok: false, reason: 'unreadable_new' };

  if (resolution.kind === 'partial') {
    return {
      ok: true,
      proposal: buildUpdateAndHoldProposal(vehicle.id, plate, resolution.fills, holdType, description),
    };
  }

  return {
    ok: true,
    proposal: buildHoldProposal({ vehicleId: vehicle.id, plate, label: vehicleLabel(vehicle) }, holdType, description),
  };
}
