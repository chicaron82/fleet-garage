// One step up from resolveKeytag: given a raw key-tag read and the fleet, normalize the
// plate (correctManitobaPlate — the misread-prefix safety net), match it to a fleet
// vehicle, and resolve to new / complete / partial. Pure — the fleet is passed in; the
// caller (<KeytagScan>) renders the branch and stages the register/backfill.
// See docs/ticket-misc-effie-keytag-scan.md.
import { correctManitobaPlate } from '../../api/_lib/platePrefix';
import { matchByUnitNumber } from './matchByUnitNumber';
import { resolveKeytag, type KeytagResolution, type KeytagFill, type KeytagChange, type KeytagConflict, type KeytagField, type KeytagExistingVehicle } from './resolveKeytag';
import type { KeytagRead } from '../../api/_lib/keytagRead';
import type { NewVehicle } from '../../api/_lib/holdProposal';
import { normalizeOwning } from '../../api/_lib/owningArea';
import type { Vehicle, FieldSource } from '../types';

/** A vehicle's field_sources → the fields the operator has LOCKED (source 'manual'). A locked
 *  field disagreeing with the tag becomes a conflict (blocked); everything else is fill/change. */
export function lockedFromSources(fs: Record<string, FieldSource> | undefined): Partial<Record<KeytagField, boolean>> {
  const locked: Partial<Record<KeytagField, boolean>> = {};
  if (fs) for (const [k, v] of Object.entries(fs)) if (v === 'manual') locked[k as KeytagField] = true;
  return locked;
}

/**
 * A fleet row projected onto the shape the resolver compares against.
 *
 * ⚠️ ONE DEFINITION ON PURPOSE. A second copy of this projection is how a field gets added to
 * `KeytagExistingVehicle` and silently stays blank on one of the two paths — which is precisely the
 * failure that put owningArea and vinLast9 out of reach for months. A field missing here reads as
 * `undefined`, which the resolver treats as BLANK, so it would report a FILL for a value the record
 * already holds.
 */
export function keytagExistingFrom(vehicle: Vehicle): KeytagExistingVehicle {
  return {
    unitNumber: vehicle.unitNumber, make: vehicle.make, model: vehicle.model,
    year: vehicle.year, color: vehicle.color, rentalClass: vehicle.rentalClass ?? null,
    owningArea: vehicle.owningArea ?? null,
    classCode: vehicle.classCode ?? null,
    vinLast9: vehicle.vinLast9 ?? null,
  };
}

/** A read complete enough to register from (the identity essentials) → a NewVehicle, else
 *  null. Lives here (the keytag resolve lib) so both the single-scan hook and the batch
 *  planner share one definition. */
export function newVehicleFromRead(read: KeytagRead, plate: string): NewVehicle | null {
  if (!read.make || !read.model || !read.unitNumber || !read.year) return null;
  return {
    unitNumber: read.unitNumber, plate, make: read.make, model: read.model, year: read.year,
    color: read.color ?? '', rentalClass: read.rentalClass,
    // ⚠️ owningArea is NORMALIZED here for the same reason resolveKeytag normalizes it: tags print
    // "08199" and the fleet stores 8199. A registration writing the printed form would seed a car
    // that disagrees with every other record of the same branch.
    classCode: read.classCode, owningArea: normalizeOwning(read.owningArea) || undefined,
    vinLast9: read.vinLast9,
  };
}

/**
 * ⭐ THE SAME CAR, REGISTERED ON WHAT THE TAG ACTUALLY GAVE UP — for when the read fell short of a
 * full vehicle but the PHOTO is perfectly legible.
 *
 * Aaron, batch-uploading his camera roll, 2026-08-30: *"the tag should upload, and i can add the
 * details myself from the tag by hand."* Until now a short read produced a `skip`, a skip carries no
 * proposal, and the key-tag photo rides through on the proposal — **so the model's failure threw
 * away the one artifact that had not failed.** He can read that photo with his own eyes.
 *
 * ⚠️ The blanks are FG's existing plate-only shape, not an invention: the 26 geotab-watchlist rows
 * created 2026-07-18 carry exactly `year: 0`, `make: ''`, `model: ''`. Those are not broken records
 * — they are cars FG knows OF and has never MET. `make`/`model`/`year` are NOT NULL in the schema,
 * so this is the only honest way to say "unknown", and it is already the way FG says it.
 *
 * ⭐ A car registered this way carries its photo and no audit stamp, which is precisely
 * `isAuditable` — so it queues itself for the key-tag auditor with no extra plumbing. The audit
 * fills the five tag fields; make/model/year still need the record's own edit, which is where Aaron
 * said he was happy to do them.
 */
export function plateOnlyVehicleFromRead(read: KeytagRead, plate: string): NewVehicle {
  return {
    unitNumber: read.unitNumber ?? '',
    plate,
    make: read.make ?? '',
    model: read.model ?? '',
    year: read.year ?? 0,
    color: read.color ?? '',
    rentalClass: read.rentalClass,
    classCode: read.classCode,
    owningArea: normalizeOwning(read.owningArea) || undefined,
    vinLast9: read.vinLast9,
  };
}

/** Does this record still have the blanks a plate-only register leaves behind? */
export function isPlateOnly(v: { make?: string | null; model?: string | null; year?: number | null }): boolean {
  return !v.make?.trim() || !v.model?.trim() || !v.year;
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

/**
 * The words FG uses for a tag field, in one place — so a message about a scan cannot speak half in
 * English and half in TypeScript.
 *
 * ⚠️⚠️ IT USED TO COVER ONLY SIX OF THE NINE, and the gap was visible in the shipped toast: the
 * backfill line built its own half by joining raw `f.field`, so a real scan read
 * `filled unitNumber, rentalClass · ↻ Updated from tag: class Q4 → C` — **the two halves of one
 * sentence using two different vocabularies**, with `class` and `rentalClass` naming the same thing
 * four words apart. The labels for the last three follow FG's own existing wording (`KeytagRereadRow`
 * says *"owning area, model code"*), rather than a fresh dialect.
 */
const FIELD_LABEL: Record<KeytagField, string> = {
  unitNumber: 'unit', make: 'make', model: 'model', year: 'year', color: 'colour', rentalClass: 'class',
  owningArea: 'owning area', classCode: 'model code', vinLast9: 'VIN',
};

/**
 * One human line for what the scan FILLED IN — the third sibling of `changeNote`/`conflictNote`,
 * and the one Aaron asked for by name: *"this scan backfilled data."*
 *
 * ⭐⭐ A RECEIPT, NOT A TROPHY. It reports what happened to the record while he was holding the tag —
 * something he did not do and would not otherwise know — and says nothing at all when the scan
 * revealed nothing. **The empty string is the important case:** a car FG already knew completely
 * produces no line, because "you scanned a car" is not news and a signal spent on every scan is a
 * signal gone by next week.
 */
export function fillNote(fills: KeytagFill[]): string {
  if (fills.length === 0) return '';
  return `filled ${fills.map(f => FIELD_LABEL[f.field] ?? f.field).join(', ')}`;
}

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
  const plate = correctManitobaPlate(read.plate ?? '');
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
  // us nothing, and only an unambiguous hit is accepted.
  //
  // ⚠️ THAT GUARD USED TO SAY "units are not unique in this fleet". THAT WAS FALSE, and Aaron said so
  // flatly: *"unit numbers are unique."* The three shared units I could find were all ARCHIVED
  // duplicates from plate misreads (LUR143/LURL43, LUR254/LUR234, 0EJ761/OEJ761), every one already
  // resolved by him weeks earlier — and the scanner never sees archived cars anyway, because
  // VehicleHoldContext filters `!v.archivedAt` (see lib/fleet-master). Among LIVE records, no unit is
  // shared. The sentence generalised a fleet RULE out of dirty data that had since been cleaned.
  //
  // ⭐ The ambiguity guard STAYS — it costs nothing and it is honest about what it can prove from the
  // rows in hand. What is gone is the false reason. A comment that asserts a property of the FLEET
  // reads as domain knowledge, so nobody re-checks it: within an hour of reading this one I had
  // written a query that forgot to filter `archived_at`, "confirmed" it, and built a whole theory on
  // top. A wrong comment does not sit still; it steers the next reader into a wrong question.
  const unitMatch = byPlate ? { kind: 'none' as const } : matchByUnitNumber(read.unitNumber, vehicles);
  const vehicle = byPlate ?? (unitMatch.kind === 'one' ? unitMatch.vehicle : null);
  const matchedByUnit = !byPlate && unitMatch.kind === 'one';
  const unitCandidates = unitMatch.kind === 'ambiguous' ? unitMatch.vehicles : [];

  const existing = vehicle ? keytagExistingFrom(vehicle) : null;
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
