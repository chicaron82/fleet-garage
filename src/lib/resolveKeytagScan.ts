// One step up from resolveKeytag: given a raw key-tag read and the fleet, normalize the
// plate (correctManitobaPrefix — the misread-prefix safety net), match it to a fleet
// vehicle, and resolve to new / complete / partial. Pure — the fleet is passed in; the
// caller (<KeytagScan>) renders the branch and stages the register/backfill.
// See docs/ticket-misc-effie-keytag-scan.md.
import { correctManitobaPrefix } from '../../api/_lib/platePrefix';
import { resolveKeytag, type KeytagResolution, type KeytagFill, type KeytagConflict } from './resolveKeytag';
import type { KeytagRead } from '../../api/_lib/keytagRead';
import type { NewVehicle } from '../../api/_lib/holdProposal';
import type { Vehicle } from '../types';

/** A read complete enough to register from (the identity essentials) → a NewVehicle, else
 *  null. Lives here (the keytag resolve lib) so both the single-scan hook and the batch
 *  planner share one definition. */
export function newVehicleFromRead(read: KeytagRead, plate: string): NewVehicle | null {
  if (!read.make || !read.model || !read.unitNumber || !read.year) return null;
  return { unitNumber: read.unitNumber, plate, make: read.make, model: read.model, year: read.year, color: read.color ?? '', rentalClass: read.rentalClass };
}

export interface KeytagScanResult {
  /** Exactly what the tag read (pre-normalize) — shown when the prefix was corrected. */
  rawPlate: string | undefined;
  /** Normalized + MB-prefix-corrected plate — the match key and what fills the field. */
  plate: string;
  /** The MB-prefix snap changed the read → show-your-work before offering to register. */
  wasCorrected: boolean;
  /** The matched fleet vehicle, or null = not in the fleet (new). */
  vehicle: Vehicle | null;
  /** new | complete | partial (with fills/conflicts) — from resolveKeytag. */
  resolution: KeytagResolution;
}

/** The vehicle to AUTO-REGISTER when a key tag is scanned to start a movement/trip and the car
 *  is new to the fleet — else null (already on record, or the read is too partial to register).
 *  A scanned keytag carries the full identity, so a movement of an unknown car should add it
 *  rather than log an orphan trip against a plate FG doesn't know (LUR315, 2026-07-15). Pure:
 *  the fleet is passed in. */
export function newVehicleToRegisterOnScan(read: KeytagRead, vehicles: Vehicle[]): NewVehicle | null {
  const { resolution, plate } = resolveKeytagScan(read, vehicles);
  if (resolution.kind !== 'new') return null; // complete/partial → already on record
  return newVehicleFromRead(read, plate); // null if the read lacks make/model/unit/year
}

/** When a scanned key tag matches an ON-RECORD but PARTIAL vehicle, the blank fields to backfill
 *  (blanks-only — resolveKeytag never proposes a conflicting field) + which vehicle. Null when the
 *  car is new, complete, or the tag adds nothing. Lets a movement scan top up a thin fleet record
 *  the same way the drop-n-go does. Pure. */
export function backfillFieldsOnScan(
  read: KeytagRead,
  vehicles: Vehicle[],
): { vehicleId: string; plate: string; fills: KeytagFill[] } | null {
  const { resolution, vehicle, plate } = resolveKeytagScan(read, vehicles);
  if (resolution.kind !== 'partial' || !vehicle || resolution.fills.length === 0) return null;
  return { vehicleId: vehicle.id, plate, fills: resolution.fills };
}

/** The OTHER half of a partial resolution: the fields where the tag DISAGREES with the record.
 *
 *  `backfillFieldsOnScan` deliberately drops these — fill blanks, flag conflicts, never clobber a
 *  value a human confirmed. But "flag" only happened on the Holds scanner; every other surface
 *  called the backfill, got `null` for a conflict-only read, and showed the operator nothing. So a
 *  tag that plainly disagrees with the record was SILENT on the scan-router — the surface that
 *  replaced the barcode and gets the most tags.
 *
 *  That's the wrong kind of quiet for a tool whose whole job is removing ambiguity: the physical
 *  tag in his hand is the best evidence FG will ever get about a car, and disagreeing with the
 *  record is exactly the moment worth saying out loud. This reports; it never writes. Correcting
 *  stays a deliberate act on the vehicle record (the ✏️ identity edit).
 *
 *  Sibling function rather than a new field on the backfill return: four call sites consume that
 *  shape and none of them want conflicts. Pure. */
export function keytagConflictsOnScan(
  read: KeytagRead,
  vehicles: Vehicle[],
): { vehicleId: string; plate: string; conflicts: KeytagConflict[] } | null {
  const { resolution, vehicle, plate } = resolveKeytagScan(read, vehicles);
  if (resolution.kind !== 'partial' || !vehicle || resolution.conflicts.length === 0) return null;
  return { vehicleId: vehicle.id, plate, conflicts: resolution.conflicts };
}

/** One human line for a disagreement: "⚠️ tag says class C, record says Q4". Separate from the
 *  detection so the wording is testable and the same everywhere it's shown. */
export function conflictNote(conflicts: KeytagConflict[]): string {
  if (conflicts.length === 0) return '';
  const label: Record<string, string> = {
    unitNumber: 'unit', make: 'make', model: 'model', year: 'year', color: 'colour', rentalClass: 'class',
  };
  const parts = conflicts.map(c => `${label[c.field] ?? c.field} ${c.read} (record says ${c.existing})`);
  return `⚠️ Tag says ${parts.join(' · ')} — open the record to correct it.`;
}

export function resolveKeytagScan(read: KeytagRead, vehicles: Vehicle[]): KeytagScanResult {
  const raw = (read.plate ?? '').trim().toUpperCase().replace(/\s+/g, '');
  const plate = correctManitobaPrefix(read.plate ?? '');
  const vehicle = plate
    ? vehicles.find(v => v.licensePlate.trim().toUpperCase() === plate) ?? null
    : null;
  const existing = vehicle
    ? { unitNumber: vehicle.unitNumber, make: vehicle.make, model: vehicle.model, year: vehicle.year, color: vehicle.color, rentalClass: vehicle.rentalClass ?? null }
    : null;
  return {
    rawPlate: read.plate,
    plate,
    wasCorrected: plate !== raw,
    vehicle,
    resolution: resolveKeytag(read, existing),
  };
}
