import { supabase, writeWithRefresh } from '../lib/supabase';
import type { Vehicle, FieldSource } from '../types';
import { AUDIT_FIELDS, isBlankField, type AuditField } from '../lib/keytagAuditQueue';
import { normalizeOwning } from '../../api/_lib/owningArea';
import { normalizeVinLast9 } from '../../api/_lib/vinLast9';
import { findUnitConflict } from '../lib/identityConflict';
import { resolveSpelledOutModel } from '../lib/spelledOutModel';

/** What the auditor read off the photo, field by field. A blank means he could not read that one
 *  either — it is left alone rather than stamped, because "I couldn't see it" is not a fact. */
export type KeytagAuditEdits = Partial<Record<AuditField, string>> & {
  /**
   * ⭐ KEY COUNT, offered only on cars that have none — Aaron, 2026-08-30: *"some keytags have keys
   * with them, is it possible to add the keycount to the ones that have a tag and are missing a
   * keycount as part of the audit?"*
   *
   * ⚠️ It is NOT an `AuditField`, deliberately. The other five are printed ON the tag and are
   * confirmed by reading; this one is COUNTED off a ring that a photo may or may not include. It
   * never gets `manual` provenance from here and it is never pre-filled — a blank means he could
   * not see the keys, which is the honest and common case.
   */
  keyCount?: string;
  /** A quarter-turn for a sideways tag (migration 133). Display metadata; the file is untouched. */
  photoRotation?: number;
  /**
   * ⭐ THIS TAG SPELLS THE MODEL OUT — the labelled layout (US cars, old-Montreal 8892) prints
   * `TUCSON` or `Model Y` where the Canadian tag prints a model CODE. When set, the model-code box
   * held a NAME, so `classCode` is neither written nor stamped (he confirmed no code — the tag has
   * none) and `model` below is written instead. See docs ticket-two-tag-formats.
   */
  modelSpelledOut?: boolean;
  /** The model name as printed. Only read when `modelSpelledOut` is set. */
  model?: string;
};

/** What the save has to say for itself. `unitConflict` means the unit number was NOT applied
 *  because another live record already carries it — everything else he read still was. */
/**
 * ⚠️⚠️ THE VIN GUARD, and it belongs on EVERY door rather than the two it had.
 *
 * `normalizeVinLast9` is the only thing that separates a real last-9 from nine characters that merely
 * look like one — position 1 must be a check digit (0-9 or X) and the whole string must sit in the
 * VIN alphabet. Until 2026-09-13 it guarded exactly two paths: the SCAN (`vinWrite`) and the MODEL
 * read (`keytagReader`). The three a PERSON types into — this audit, the field editor, register —
 * wrote whatever they were handed.
 *
 * ⭐ That was backwards. The human paths are where a cropped tag and a keyring hole become a
 * confident wrong VIN, and `LFJ400` proved it: its tag PRINTS `VXSL47717` — the right characters
 * sliced one position too far left — and this path wrote it in on 2026-08-29, over a field that had
 * just been cleared.
 *
 * ⚠️ REFUSES rather than blanks. Writing the normalizer's '' would erase a good value to save a bad
 * one; refusing silently would let him believe it saved. So the field is skipped and the raw value
 * comes back on the result, exactly like `unitConflict`.
 */
function guardVin(raw: string): string | null {
  return normalizeVinLast9(raw) || null;
}

export interface KeytagAuditSaveResult {
  unitConflict?: Vehicle;
  /** The raw VIN the auditor typed, when it could not be a real last-9. Nothing was written for it. */
  vinRejected?: string;
}

/** The `vehicles` columns an audit may touch — typed explicitly (not a generic Record) because
 *  the Supabase client rejects an untyped update payload. Mirrors vehicleFieldsWrite. */
interface KeytagAuditUpdate {
  owning_area?: string;
  rental_class?: string;
  class_code?: string;
  unit_number?: string;
  vin_last9?: string;
  make?: string;
  model?: string;
  key_count?: number;
  keytag_photo_rotation?: number;
  field_sources?: Record<string, FieldSource>;
  keytag_audited_at: string;
  keytag_audited_by: string | null;
  keytag_audit_result: 'verified' | 'unreadable' | 'stale';
}

/** Field → column, as an exhaustive switch rather than a lookup map. A `Record<AuditField, keyof
 *  Update>` reads tidier and then needs a cast to write through, which is exactly where a typo
 *  stops being a compile error. The switch costs five lines and cannot silently miss a field.
 *
 *  ⚠️ Returns the RAW value when a field was refused (VIN only, today) so the caller can report it.
 *  Returning null for "written" rather than throwing keeps every other field on the same save. */
function applyField(payload: KeytagAuditUpdate, patch: Partial<Vehicle>, field: AuditField, value: string): string | null {
  switch (field) {
    case 'owningArea':  payload.owning_area = value; patch.owningArea  = value; break;
    case 'rentalClass': payload.rental_class = value; patch.rentalClass = value; break;
    case 'classCode':   payload.class_code = value; patch.classCode    = value; break;
    case 'unitNumber':  payload.unit_number = value; patch.unitNumber  = value; break;
    case 'vinLast9': {
      const vin = guardVin(value);
      if (!vin) return value;                    // refused — caller reports it, nothing written
      payload.vin_last9 = vin; patch.vinLast9 = vin; break;
    }
  }
  return null;
}

/**
 * The auditor's write path — a HUMAN read the stored key-tag photo and says what it says.
 *
 * ⭐⭐ WHY THIS IS ITS OWN MODULE AND NOT A LOOSENED `vinWrite`. `vinWrite` is first-write-wins and
 * immutable by design: *"a VIN is immutable for the life of the car... a later misread can never
 * rewrite a good value."* That rule exists because MODELS are unreliable and, in a batch, there is
 * nobody present to adjudicate. Aaron with the photo in front of him is the other case entirely —
 * the top of the provenance ladder, the same reasoning `plateWrite` already uses for the one tag
 * write that overwrites: *"a human confirming a re-plate outranks a later scan."*
 *
 * ⚠️ So the scan and batch guards stay EXACTLY as strict as they are. Nothing here relaxes them;
 * this is a second door, opened only by a person, and it is the one place a VIN may be corrected.
 *
 * ⭐ CONFIRMING IS A WRITE. A field he leaves untouched is still stamped 'manual', which
 * `resolveKeytag` treats as locked — so an audited record becomes immune to every later misread.
 * Filling blanks is the visible win; hardening what is already there is the larger one.
 */
export function makeSaveKeytagAudit(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  /** Live fleet, for the unit#-collision guard below. */
  allVehicles: Vehicle[];
  userId: string | null;
}) {
  const { setAllVehicles, allVehicles, userId } = deps;

  return async (vehicleId: string, edits: KeytagAuditEdits): Promise<KeytagAuditSaveResult> => {
    const current = allVehicles.find(v => v.id === vehicleId);
    if (!current) throw new Error('Vehicle not found');

    const now = new Date().toISOString();
    const payload: KeytagAuditUpdate = {
      keytag_audited_at: now,
      keytag_audited_by: userId,
      keytag_audit_result: 'verified',
    };
    const patch: Partial<Vehicle> = {};
    const stamps: Record<string, FieldSource> = {};

    // ⚠️ THE UNIT#-COLLISION GUARD, same as the scan path (vehicleFieldsWrite). A unit number is
    // fleet-wide: the same number on two records means it has drifted onto the wrong car, and both
    // of last week's duplicate-unit findings came from a write with no such check. It does NOT
    // decide which record is right — the unit is left alone, everything else he read is still
    // written, and the conflict is handed back to be said out loud.
    const typedUnit = (edits.unitNumber ?? '').trim();
    const unitChanged = !isBlankField(typedUnit) && typedUnit !== (current.unitNumber ?? '');
    const conflict = unitChanged ? findUnitConflict(typedUnit, allVehicles, vehicleId) : undefined;

    let vinRejected: string | undefined;

    for (const field of AUDIT_FIELDS) {
      // ⚠️ UPPERCASED HERE TOO, not only in the form. The card is today's only caller, and a rule
      // that lives in a component is a rule the next caller does not inherit — the whole reason
      // this file exists is that provenance and shape belong to the WRITE. Costs nothing when the
      // value already arrives upper.
      const raw = (edits[field] ?? '').trim().toUpperCase();
      // ⚠️ THE LEADING ZERO IS A PRINT CONVENTION, NOT PART OF THE NUMBER. Tags print "08191" and
      // "08890"; the branch is 8191 and 8890. Aaron: *"the leading zero i usually would drop anyway,
      // as some older owning ones have 08890, 08999, 08898."* `normalizeOwning` has always known
      // this — and until now **no writer called it**. It was wired into the scan read alone, so a
      // hand-typed owning went to the database exactly as printed. That is how SPHV03 came to hold
      // `02294` for a branch that is 2294.
      //
      // ⭐ It strips only LEADING zeros, so a genuinely five-digit branch that does not begin with
      // one survives intact — Aaron's own caveat that overseas numbering may run to five digits.
      const value = field === 'owningArea' ? normalizeOwning(raw) : raw;
      if (isBlankField(value)) continue;          // he couldn't read it either — not a fact
      if (field === 'unitNumber' && conflict) continue;  // blocked, and reported back
      // ⚠️ A spelled-out tag has no model code, so there is nothing to confirm — and stamping
      // 'manual' would lock whatever FG holds (possibly a misfiled name) as human-verified.
      if (field === 'classCode' && edits.modelSpelledOut) continue;

      // Only CHANGED values reach the payload; an unchanged one needs no column write. Both get
      // the 'manual' stamp — that stamp is the whole point of a confirmation.
      if (value !== (current[field] ?? '')) {
        const refused = applyField(payload, patch, field, value);
        // ⚠️ A refused field is NOT stamped 'manual' — the stamp claims a human confirmed the value
        // FG now holds, and FG does not hold this one.
        if (refused) { vinRejected = refused; continue; }
      }
      stamps[field] = 'manual';
    }

    // ⭐ THE SPELLED-OUT MODEL — the one tag layout where the model is PRINTED rather than derived.
    // It OVERWRITES what FG holds (Aaron, 2026-09-14: a person holding the tag outranks an earlier
    // guess, the `plateWrite` reasoning). FG's own spelling wins when it knows the model; make is
    // filled only into a BLANK make, only when the evidence names one, and stamped 'derived' because
    // no tag printed it.
    const spelled = edits.modelSpelledOut ? resolveSpelledOutModel(edits.model ?? '', allVehicles, vehicleId) : null;
    if (spelled) {
      if (spelled.model !== (current.model ?? '')) { payload.model = spelled.model; patch.model = spelled.model; }
      stamps.model = 'manual';
      if (spelled.make && isBlankField(current.make)) {
        payload.make = spelled.make; patch.make = spelled.make;
        stamps.make = 'derived';
      }
    }

    // ⭐ KEY COUNT — a number, not a tag field, and never provenance-stamped. It is counted off a
    // ring the photo may or may not show, so a blank is the honest and common answer. Only written
    // when he typed one AND the car had none: re-asking a car that already has a count invites a
    // worse answer (guessed from a photo) to overwrite a better one (counted in the hand).
    const typedKeys = (edits.keyCount ?? '').trim();
    if (typedKeys && current.keyCount === null) {
      const n = Number(typedKeys);
      if (Number.isFinite(n) && n >= 0 && n <= 9) {
        payload.key_count = n;
        patch.keyCount = n;
      }
    }

    // ⭐ ROTATION — display metadata for a sideways tag (migration 133). Written whenever it differs,
    // including back to 0, so four taps genuinely restore the photo as captured. The stored file is
    // never re-encoded.
    if (edits.photoRotation !== undefined && edits.photoRotation !== (current.keytagPhotoRotation ?? 0)) {
      payload.keytag_photo_rotation = edits.photoRotation;
      patch.keytagPhotoRotation = edits.photoRotation;
    }

    // Merge onto the existing provenance so a manual stamp accumulates rather than replacing what
    // other fields already recorded. Read-modify-write is safe on a single-operator tool.
    const { data: cur } = await supabase.from('vehicles').select('field_sources').eq('id', vehicleId).maybeSingle();
    const existingSources = (cur && typeof cur.field_sources === 'object' && cur.field_sources)
      ? (cur.field_sources as Record<string, FieldSource>) : {};
    const merged = { ...existingSources, ...stamps };
    payload.field_sources = merged;

    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update(payload).eq('id', vehicleId)
    );
    if (error) throw new Error(`Failed to save audit: ${(error as { message?: string }).message}`);

    setAllVehicles(prev => prev.map(v => (v.id === vehicleId ? {
      ...v, ...patch,
      fieldSources: merged,
      keytagAuditedAt: now,
      keytagAuditedBy: userId,
      keytagAuditResult: 'verified' as const,
    } : v)));
    return { unitConflict: conflict, vinRejected };
  };
}

/** The two outcomes that end an audit WITHOUT any values being read. Both leave the car audited and
 *  both put it on a watchlist; which watchlist, and what the next person is told to do, is the whole
 *  difference. See migration 143 and `KeytagAuditResult`. */
export type KeytagFlag = 'unreadable' | 'check-vehicle';

/**
 * "I couldn't get it off the tag." — the two ways that happens, told apart.
 *
 *   'unreadable'    → the PHOTO failed: cropped, blurred, watermarked across the VIN, four tags in
 *                     one frame. A better picture fixes it. → `retakeWatchlist`
 *   'check-vehicle' → the photo is fine and the TAG has no answer on it: a hand-written replacement
 *                     with no `Last9vin:` line, or a tag printed from ANOTHER car's record (two
 *                     different vehicles, one unit number). A better picture fixes nothing — it
 *                     reproduces the wrong answer perfectly. The barcode sticker is the fix.
 *                     → `checkVehicleWatchlist`
 *
 * ⭐ THIS IS THE WATCHLIST — either one. There is no separate table: the flag is the same column
 * that advances the audit queue (migration 130), written by the same tap, so a list can never drift
 * out of step with the audit that found it. A retake later clears the result back to NULL, which
 * puts the car straight back in line for the audit it never got.
 *
 * ⚠️⚠️ GENERALISED 2026-09-13 rather than copied. The obvious move was a second
 * `makeFlagKeytagCheckVehicle` beside this one — two functions identical but for a string literal,
 * which is how the third and fourth outcomes would each arrive as another copy. The outcome is a
 * PARAMETER because it was always a parameter; it just only had one value.
 *
 * ⚠️ Writes NO identity fields, under either flag. He did not read them, so there is nothing to
 * record — and stamping 'manual' here would lock values he never actually saw.
 */
export function makeFlagKeytag(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  userId: string | null;
}) {
  const { setAllVehicles, userId } = deps;

  return async (vehicleId: string, result: KeytagFlag = 'unreadable'): Promise<void> => {
    const now = new Date().toISOString();
    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({
        keytag_audited_at: now,
        keytag_audited_by: userId,
        keytag_audit_result: result,
      }).eq('id', vehicleId)
    );
    if (error) throw new Error(`Failed to flag key tag: ${(error as { message?: string }).message}`);
    setAllVehicles(prev => prev.map(v => (v.id === vehicleId ? {
      ...v, keytagAuditedAt: now, keytagAuditedBy: userId, keytagAuditResult: result,
    } : v)));
  };
}

/**
 * Put an audited car back in the queue.
 *
 * ⭐⭐ WHY THIS HAD TO EXIST. The auditor could not fix its own mistakes. An audited car leaves the
 * queue permanently, so the first wrong entry — FVB4297, a rental class typed into the model-code
 * box because the tag's own heading says `Class` — could only be corrected with hand-written SQL.
 * A tool that writes at the TOP of the provenance ladder and has no way back is a tool whose every
 * error is permanent, and this one shipped with a documented anchoring risk. The undo is not a
 * nicety; it is the counterweight to `manual` being the strongest stamp FG has.
 *
 * ⚠️ Clears ONLY the audit stamp. The `manual` provenance on the fields stays put, deliberately:
 * re-opening the audit does not un-make what he confirmed, and dropping those locks would let the
 * next scan overwrite good values in the window before he gets back to the car. Saving the re-audit
 * re-stamps them anyway.
 */
export function makeReopenKeytagAudit(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
}) {
  const { setAllVehicles } = deps;

  return async (vehicleId: string): Promise<void> => {
    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({
        keytag_audited_at: null,
        keytag_audited_by: null,
        keytag_audit_result: null,
      }).eq('id', vehicleId)
    );
    if (error) throw new Error(`Failed to reopen the audit: ${(error as { message?: string }).message}`);
    setAllVehicles(prev => prev.map(v => (v.id === vehicleId ? {
      ...v, keytagAuditedAt: null, keytagAuditedBy: null, keytagAuditResult: null,
    } : v)));
  };
}
