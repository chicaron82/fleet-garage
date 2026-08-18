// One step up from resolveKeytag: given a raw key-tag read and the fleet, normalize the
// plate (correctManitobaPrefix — the misread-prefix safety net), match it to a fleet
// vehicle, and resolve to new / complete / partial. Pure — the fleet is passed in; the
// caller (<KeytagScan>) renders the branch and stages the register/backfill.
// See docs/ticket-misc-effie-keytag-scan.md.
import { correctManitobaPrefix } from '../../api/_lib/platePrefix';
import { matchByUnitNumber } from './matchByUnitNumber';
import { resolveKeytag, type KeytagResolution, type KeytagFill, type KeytagChange, type KeytagConflict, type KeytagField } from './resolveKeytag';
import type { KeytagRead } from '../../api/_lib/keytagRead';
import type { NewVehicle } from '../../api/_lib/holdProposal';
import type { Vehicle, FieldSource } from '../types';

/** A vehicle's field_sources → the fields the operator has LOCKED (source 'manual'). A locked
 *  field disagreeing with the tag becomes a conflict (blocked); everything else is fill/change. */
function lockedFromSources(fs: Record<string, FieldSource> | undefined): Partial<Record<KeytagField, boolean>> {
  const locked: Partial<Record<KeytagField, boolean>> = {};
  if (fs) for (const [k, v] of Object.entries(fs)) if (v === 'manual') locked[k as KeytagField] = true;
  return locked;
}

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
  /** The plate couldn't be read and the UNIT NUMBER identified the car instead. Surfaced on the
   *  card — FG never resolves by a weaker key without saying which key did the work. */
  matchedByUnit: boolean;
  /** Two or more live vehicles carry the scanned unit, so nothing was matched. Not an error: the
   *  operator picks. Empty on every normal scan. */
  unitCandidates: Vehicle[];
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
): { vehicleId: string; plate: string; applies: KeytagFill[]; fills: KeytagFill[]; changes: KeytagChange[] } | null {
  const { resolution, vehicle, plate } = resolveKeytagScan(read, vehicles);
  if (resolution.kind !== 'partial' || !vehicle) return null;
  const { fills, changes } = resolution;
  if (fills.length === 0 && changes.length === 0) return null;
  // `applies` is what the write sets: blanks filled + non-locked disagreements corrected. The
  // caller stamps every applied field's source as 'tag'. `fills`/`changes` stay separate so the
  // toast can say which were NEW vs which OVERRODE a stale value.
  const applies: KeytagFill[] = [...fills, ...changes.map(c => ({ field: c.field, value: c.value }))];
  return { vehicleId: vehicle.id, plate, applies, fills, changes };
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

const FIELD_LABEL: Record<string, string> = {
  unitNumber: 'unit', make: 'make', model: 'model', year: 'year', color: 'colour', rentalClass: 'class',
};

/** One human line for a BLOCKED disagreement — the tag disagrees with a value Aaron manually set,
 *  so his edit wins and the tag is not applied: "⚠️ Tag says class F — your edit (E6) kept". */
export function conflictNote(conflicts: KeytagConflict[]): string {
  if (conflicts.length === 0) return '';
  const parts = conflicts.map(c => `${FIELD_LABEL[c.field] ?? c.field} ${c.read} — your edit (${c.existing}) kept`);
  return `⚠️ Tag says ${parts.join(' · ')}`;
}

/** One human line for an APPLIED change — the tag corrected a stale (inferred / older-tag) value
 *  that wasn't locked: "↻ Updated from tag: class Q4 → C". Says the override out loud; never silent. */
export function changeNote(changes: KeytagChange[]): string {
  if (changes.length === 0) return '';
  const parts = changes.map(c => `${FIELD_LABEL[c.field] ?? c.field} ${c.from} → ${c.value}`);
  return `↻ Updated from tag: ${parts.join(' · ')}`;
}

export function resolveKeytagScan(read: KeytagRead, vehicles: Vehicle[]): KeytagScanResult {
  const raw = (read.plate ?? '').trim().toUpperCase().replace(/\s+/g, '');
  const plate = correctManitobaPrefix(read.plate ?? '');
  const byPlate = plate
    ? vehicles.find(v => v.licensePlate.trim().toUpperCase() === plate) ?? null
    : null;

  // ── Unit-number fallback ────────────────────────────────────────────────────────────────────
  // The tag carries TWO identity keys and this only ever used one. A crumpled or torn tag loses
  // the plate long before it loses the unit number, and that is precisely the scan worth doing —
  // a clean tag Aaron can read himself (2026-08-18, see matchByUnitNumber.ts).
  //
  // Strictly a FALLBACK: the plate is the primary key and wins whenever it matched, so a scan that
  // resolves today keeps resolving to the same car. The unit is consulted only when the plate gave
  // us nothing, and only an unambiguous hit is accepted — units are not unique in this fleet.
  const unitMatch = byPlate ? { kind: 'none' as const } : matchByUnitNumber(read.unitNumber, vehicles);
  const vehicle = byPlate ?? (unitMatch.kind === 'one' ? unitMatch.vehicle : null);
  const matchedByUnit = !byPlate && unitMatch.kind === 'one';
  const unitCandidates = unitMatch.kind === 'ambiguous' ? unitMatch.vehicles : [];

  const existing = vehicle
    ? { unitNumber: vehicle.unitNumber, make: vehicle.make, model: vehicle.model, year: vehicle.year, color: vehicle.color, rentalClass: vehicle.rentalClass ?? null }
    : null;
  return {
    rawPlate: read.plate,
    plate,
    wasCorrected: plate !== raw,
    vehicle,
    matchedByUnit,
    unitCandidates,
    resolution: resolveKeytag(read, existing, vehicle ? lockedFromSources(vehicle.fieldSources) : {}),
  };
}
