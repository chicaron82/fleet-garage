// The brain of the keytag-scan flow: given a key-tag read and whatever the fleet already
// knows about that plate, decide whether it's a NEW registration, a COMPLETE match
// (nothing to do), or a PARTIAL one that needs blanks filled and/or conflicts flagged.
//
// Pure + decoupled: the caller does the plate lookup FIRST (normalize → find the vehicle,
// or null) and passes the result in. This function never writes and never touches the DB.
//
// Backfill principle (the load-bearing rule): FILL blanks freely, FLAG conflicts. A key-tag
// read must never silently overwrite a good existing value — an OCR misread of the color
// shouldn't clobber a color a human already confirmed. Blanks it fills automatically;
// disagreements it surfaces for a human to resolve.
import type { KeytagRead } from '../../api/_lib/keytagRead';

/** The identity fields of an existing fleet vehicle a read can backfill — a subset of
 *  Vehicle, so the resolver stays decoupled from the full row type. */
export interface KeytagExistingVehicle {
  unitNumber: string | null;
  make: string;
  model: string;
  year: number;
  color: string;
}

/** A backfillable identity field. Plate is the match key, never resolved here. */
export type KeytagField = 'unitNumber' | 'make' | 'model' | 'year' | 'color';

/** A blank existing field the read can fill in. */
export interface KeytagFill {
  field: KeytagField;
  value: string | number;
}

/** A field where the read disagrees with a good existing value — flagged, never applied. */
export interface KeytagConflict {
  field: KeytagField;
  existing: string | number;
  read: string | number;
}

export type KeytagResolution =
  | { kind: 'new' }
  | { kind: 'complete' }
  | { kind: 'partial'; fills: KeytagFill[]; conflicts: KeytagConflict[] };

const FIELDS: KeytagField[] = ['unitNumber', 'make', 'model', 'year', 'color'];

/** A value is "blank" (unknown) if it's null/undefined, an empty/whitespace string, or a
 *  non-positive year (0 is FG's unknown-year sentinel). */
function isBlank(v: string | number | null | undefined): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'number') return v <= 0;
  return v.trim() === '';
}

/** Trim + case-insensitive for text; numeric for years. So "toyota" == "Toyota" is not a
 *  conflict, but 2019 != 2020 is. */
function sameValue(a: string | number, b: string | number): boolean {
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function resolveKeytag(
  read: KeytagRead,
  existing: KeytagExistingVehicle | null,
): KeytagResolution {
  // Plate not in the fleet → this is a brand-new car; register it from the read.
  if (!existing) return { kind: 'new' };

  const fills: KeytagFill[] = [];
  const conflicts: KeytagConflict[] = [];
  for (const field of FIELDS) {
    const readVal = read[field];
    if (isBlank(readVal)) continue; // the read offers nothing for this field
    const existingVal = existing[field];
    if (isBlank(existingVal)) {
      fills.push({ field, value: readVal as string | number });
    } else if (!sameValue(existingVal as string | number, readVal as string | number)) {
      conflicts.push({ field, existing: existingVal as string | number, read: readVal as string | number });
    }
  }

  if (fills.length === 0 && conflicts.length === 0) return { kind: 'complete' };
  return { kind: 'partial', fills, conflicts };
}
