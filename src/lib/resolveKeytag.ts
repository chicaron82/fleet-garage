// The brain of the keytag-scan flow: given a key-tag read and whatever the fleet already
// knows about that plate, decide whether it's a NEW registration, a COMPLETE match
// (nothing to do), or a PARTIAL one that needs blanks filled and/or conflicts flagged.
//
// Pure + decoupled: the caller does the plate lookup FIRST (normalize → find the vehicle,
// or null) and passes the result in. This function never writes and never touches the DB.
//
// Provenance ladder (the load-bearing rule, reworked 2026-07-22 — docs/ticket-keytag-field-
// provenance.md): inferred < tag < manual. A field's value is only as trustworthy as its source,
// so rank sources by how much they actually know.
//   • blank existing            → FILL   (the tag supplies what FG didn't have)
//   • non-blank, NOT locked      → CHANGE (the tag overrides an inferred/older-tag value — applied,
//                                          and warned, because a good value can also be misread)
//   • non-blank, LOCKED (manual) → CONFLICT (Aaron edited it; the tag is blocked, and warned)
// This replaces the old "fill blanks / flag conflicts" contract: a tag now CORRECTS a stale value
// instead of only reporting it — which is how DiZee's 156 inferred rental classes self-heal — but
// a value the operator manually set outranks any scan. `locked` comes from the vehicle's
// field_sources (a field marked 'manual'). Pure: never writes, never touches the DB.
import type { KeytagRead } from '../../api/_lib/keytagRead';
import { normalizeOwning } from '../../api/_lib/owningArea';

/** The identity fields of an existing fleet vehicle a read can backfill — a subset of
 *  Vehicle, so the resolver stays decoupled from the full row type. */
export interface KeytagExistingVehicle {
  unitNumber: string | null;
  make: string;
  model: string;
  year: number;
  color: string;
  rentalClass: string | null;
  /** ⭐ THE THREE THE READER HAS ALWAYS EXTRACTED AND NO WRITER EVER TOOK. Added 2026-08-30 after
   *  Aaron dumped his camera roll into the batch register and asked the obvious question: *"were
   *  the keytags in the audit really that unreadable? i feel most of them could have been read
   *  easily."* They could. The queue he was left with was 45 cars, and 44 of them were missing
   *  EXACTLY these — owning area and VIN — while not one was missing its unit number. That is not
   *  a legibility shape; a smudged tag loses the big print with the small.
   *
   *  `api/keytag-read.ts` asks the model for all three by name. This resolver's FIELDS list did not
   *  include them, so a scan could never fill them on a car FG already had. Same confession this
   *  file's sibling already carries twice — *"the line was always read and the number always
   *  discarded"* (Aug 18) and *"…and the city always discarded"* (Aug 28) — except those two were
   *  fixed by teaching the READER, and nobody checked whether the WRITERS would take the answer. */
  owningArea: string | null;
  classCode: string | null;
  vinLast9: string | null;
}

/** A backfillable field. Plate is the match key, never resolved here. rentalClass is read off
 *  the tag's corner — backfilling it is how the existing fleet gets classed as cars are scanned. */
export type KeytagField =
  | 'unitNumber' | 'make' | 'model' | 'year' | 'color' | 'rentalClass'
  | 'owningArea' | 'classCode' | 'vinLast9';

/** A blank existing field the read can fill in. */
export interface KeytagFill {
  field: KeytagField;
  value: string | number;
}

/** A non-blank existing field the read OVERRIDES because it isn't locked — the value IS applied
 *  (an inferred guess or an older tag read yielding to a fresh tag), and warned about. */
export interface KeytagChange {
  field: KeytagField;
  from: string | number;   // the value being replaced
  value: string | number;  // the tag's value, now applied
}

/** A field where the read disagrees with a LOCKED (manually-set) value — blocked, never applied,
 *  surfaced so the operator sees the tag disagrees with his own edit. */
export interface KeytagConflict {
  field: KeytagField;
  existing: string | number;
  read: string | number;
}

export type KeytagResolution =
  | { kind: 'new' }
  | { kind: 'complete' }
  | { kind: 'partial'; fills: KeytagFill[]; changes: KeytagChange[]; conflicts: KeytagConflict[] };

const FIELDS: KeytagField[] = [
  'unitNumber', 'make', 'model', 'year', 'color', 'rentalClass',
  'owningArea', 'classCode', 'vinLast9',
];

/**
 * The read's value for one field, in the form the DATABASE holds it.
 *
 * ⚠️ OWNING AREA IS THE REASON THIS EXISTS. Tags print the branch with a leading zero — "08199" —
 * and FG stores it without one, because `normalizeOwning` has always stripped it ("the leading zero
 * is a print convention, not part of the number", keytagAuditWrite). Comparing the raw read against
 * the stored value would call 08199 ≠ 8199 a CHANGE on every single scan of a correctly-recorded
 * car: a fleet-wide stream of false corrections, each one applied. Normalize before comparing, not
 * after deciding.
 */
function readValue(read: KeytagRead, field: KeytagField): string | number | undefined {
  if (field !== 'owningArea') return read[field];
  const n = normalizeOwning(read.owningArea);
  return n === '' ? undefined : n;
}

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
  /** Fields the operator has manually set (from the vehicle's field_sources === 'manual'). A locked
   *  field disagreeing with the tag is a CONFLICT (blocked); an unlocked one is a CHANGE (applied). */
  locked: Partial<Record<KeytagField, boolean>> = {},
): KeytagResolution {
  // Plate not in the fleet → this is a brand-new car; register it from the read.
  if (!existing) return { kind: 'new' };

  const fills: KeytagFill[] = [];
  const changes: KeytagChange[] = [];
  const conflicts: KeytagConflict[] = [];
  for (const field of FIELDS) {
    const readVal = readValue(read, field);
    if (isBlank(readVal)) continue; // the read offers nothing for this field
    const existingVal = existing[field];
    if (isBlank(existingVal)) {
      fills.push({ field, value: readVal as string | number });
    } else if (!sameValue(existingVal as string | number, readVal as string | number)) {
      if (locked[field]) {
        conflicts.push({ field, existing: existingVal as string | number, read: readVal as string | number });
      } else {
        changes.push({ field, from: existingVal as string | number, value: readVal as string | number });
      }
    }
  }

  if (fills.length === 0 && changes.length === 0 && conflicts.length === 0) return { kind: 'complete' };
  return { kind: 'partial', fills, changes, conflicts };
}
