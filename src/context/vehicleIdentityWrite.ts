import { supabase, writeWithRefresh } from '../lib/supabase';
import { pinClassMapping } from './classPinWrite';
import type { ClassPinContradiction } from '../../api/_lib/vehicleClassCodex';
import type { Vehicle, FieldSource } from '../types';

// The operator's CONFIRMED TRUTH about a car's identity — a deliberate overwrite, not a suggestion.
//
// Extracted from useVehicleOperations 2026-08-25 when adding the class pin took that file to 332
// against the hard 330. The cap did exactly its job: it turned "this file is long" into a real
// module rather than into deleted documentation. It sits beside its siblings vehicleFieldsWrite
// (what a TAG may fill) and fieldUnlockWrite (releasing a lock) — the write-path trio for one row.

/** What a human may correct by hand. Omitted → a unit/plate-only edit, as before. */
export interface VehicleIdentityEdit {
  make: string; model: string; year: number; color: string;
  rentalClass: string | null; classCode?: string | null; isHybrid?: boolean;
}

export interface IdentityWriteResult {
  ok: boolean;
  /** Whether the shared code→class mapping was pinned as part of this edit. False when the edit
   *  carried no code/class pair to teach, or when that write failed — reported rather than
   *  assumed, so nothing upstream can claim a mapping it did not store. */
  pinned: boolean;
  /** Set when the mapping was REFUSED because the codex contradicts it — the car's own edit still
   *  landed. Carries the code he probably meant. */
  pinBlocked?: ClassPinContradiction;
}

/**
 * Write a hand-corrected identity, LOCK the fields it touched, and pin what it teaches.
 *
 * A human correcting the make/model/year/colour/CLASS he mis-selected at registration, or fixing
 * what a wrong tag mapped to, outranks any scan — so every field he set is stamped `manual` and the
 * provenance ladder (inferred < tag < manual) stops a later tag read from clobbering it (the
 * CCLH-should-be-CCMH case).
 */
export async function writeVehicleIdentity(
  vehicleId: string,
  unit: string | null,
  plate: string,
  identity: VehicleIdentityEdit | undefined,
  setAllVehicles: (fn: (prev: Vehicle[]) => Vehicle[]) => void,
): Promise<IdentityWriteResult> {
    // Manual edit = the operator's confirmed truth → stamp 'manual' on every field he set, so the
    // provenance ladder (inferred < tag < manual) blocks a later scan from clobbering it. Merge into
    // the existing sources (read-modify-write; single-operator tool, no concurrent writers).
    const stamps: Record<string, FieldSource> = {};
    if (unit) stamps.unitNumber = 'manual';
    if (identity) {
      stamps.make = 'manual'; stamps.model = 'manual'; stamps.year = 'manual'; stamps.color = 'manual';
      stamps.isHybrid = 'manual';  // a human's hybrid call outranks a later tag read
      if (identity.rentalClass && identity.rentalClass.trim() !== '') stamps.rentalClass = 'manual';
      // ⚠️ A hand-corrected class code must outrank BOTH a later tag read and the migration-121
      // backfill. Without this stamp his correction would still read as 'derived' and the very next
      // scan would overwrite it — the exact loop the editable field exists to break.
      if (identity.classCode && identity.classCode.trim() !== '') stamps.classCode = 'manual';
    }
    // ⭐ …and teach the SHARED mapping too, pinned. The stamps above lock this CAR; without it the
    // next different CRHX still resolves to Q4, because api/keytag-read.ts re-teaches the code→class
    // table from every tag it reads. Same ladder, one level down (migration 127).
    let pinned = false;
    let pinBlocked: ClassPinContradiction | undefined;
    if (identity?.classCode && identity.rentalClass) {
      const outcome = await pinClassMapping(identity.classCode, identity.rentalClass);
      pinned = outcome.pinned;
      pinBlocked = outcome.contradiction;
    }

    const { data: cur } = await supabase.from('vehicles').select('field_sources').eq('id', vehicleId).maybeSingle();
    const existingSources = (cur && typeof cur.field_sources === 'object' && cur.field_sources)
      ? (cur.field_sources as Record<string, FieldSource>) : {};
    const mergedSources = { ...existingSources, ...stamps };

    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({
        unit_number:          unit,
        license_plate:        plate,
        ...(identity ? { make: identity.make, model: identity.model, year: identity.year, color: identity.color, rental_class: identity.rentalClass, class_code: identity.classCode ?? null, is_hybrid: identity.isHybrid ?? false } : {}),
        field_sources:        mergedSources,
        edit_status:          null,
        edit_suggested_unit:  null,
        edit_suggested_plate: null,
        edit_suggested_by:    null,
        edit_suggested_at:    null,
        edit_suggestion_note: null,
        edit_reviewed_by:     null,
        edit_reviewed_at:     null,
      }).eq('id', vehicleId)
    );
    if (error) return { ok: false, pinned, pinBlocked };
    setAllVehicles(prev => prev.map(v => v.id !== vehicleId ? v : {
      ...v, unitNumber: unit, licensePlate: plate, editStatus: null, fieldSources: mergedSources,
      ...(identity ? { make: identity.make, model: identity.model, year: identity.year, color: identity.color, rentalClass: identity.rentalClass } : {}),
    }));
    return { ok: true, pinned, pinBlocked };
}
