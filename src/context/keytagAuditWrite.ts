import { supabase, writeWithRefresh } from '../lib/supabase';
import type { Vehicle, FieldSource } from '../types';
import { AUDIT_FIELDS, isBlankField, type AuditField } from '../lib/keytagAuditQueue';
import { findUnitConflict } from '../lib/identityConflict';

/** What the auditor read off the photo, field by field. A blank means he could not read that one
 *  either — it is left alone rather than stamped, because "I couldn't see it" is not a fact. */
export type KeytagAuditEdits = Partial<Record<AuditField, string>>;

/** What the save has to say for itself. `unitConflict` means the unit number was NOT applied
 *  because another live record already carries it — everything else he read still was. */
export interface KeytagAuditSaveResult { unitConflict?: Vehicle }

/** The `vehicles` columns an audit may touch — typed explicitly (not a generic Record) because
 *  the Supabase client rejects an untyped update payload. Mirrors vehicleFieldsWrite. */
interface KeytagAuditUpdate {
  owning_area?: string;
  rental_class?: string;
  class_code?: string;
  unit_number?: string;
  vin_last9?: string;
  field_sources?: Record<string, FieldSource>;
  keytag_audited_at: string;
  keytag_audited_by: string | null;
  keytag_audit_result: 'verified' | 'unreadable';
}

/** Field → column, as an exhaustive switch rather than a lookup map. A `Record<AuditField, keyof
 *  Update>` reads tidier and then needs a cast to write through, which is exactly where a typo
 *  stops being a compile error. The switch costs five lines and cannot silently miss a field. */
function applyField(payload: KeytagAuditUpdate, patch: Partial<Vehicle>, field: AuditField, value: string): void {
  switch (field) {
    case 'owningArea':  payload.owning_area = value; patch.owningArea  = value; break;
    case 'rentalClass': payload.rental_class = value; patch.rentalClass = value; break;
    case 'classCode':   payload.class_code = value; patch.classCode    = value; break;
    case 'unitNumber':  payload.unit_number = value; patch.unitNumber  = value; break;
    case 'vinLast9':    payload.vin_last9 = value; patch.vinLast9      = value; break;
  }
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

    for (const field of AUDIT_FIELDS) {
      const value = (edits[field] ?? '').trim();
      if (isBlankField(value)) continue;          // he couldn't read it either — not a fact
      if (field === 'unitNumber' && conflict) continue;  // blocked, and reported back

      // Only CHANGED values reach the payload; an unchanged one needs no column write. Both get
      // the 'manual' stamp — that stamp is the whole point of a confirmation.
      if (value !== (current[field] ?? '')) applyField(payload, patch, field, value);
      stamps[field] = 'manual';
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
    return { unitConflict: conflict };
  };
}

/**
 * "I can't read this one." — the tag photo is cropped, blurred, watermarked across the VIN, or
 * holds four tags at once.
 *
 * ⭐ THIS IS THE RETAKE WATCHLIST. There is no separate table: the flag is the same column that
 * advances the audit queue (migration 130), written by the same tap, so the list of cars needing a
 * fresh photo can never drift out of step with the audit that found them. A retake later clears
 * the result back to NULL, which puts the car straight back in line for the audit it never got.
 *
 * ⚠️ Writes NO identity fields. He did not read them, so there is nothing to record — and stamping
 * 'manual' here would lock values he never actually saw.
 */
export function makeFlagKeytagUnreadable(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  userId: string | null;
}) {
  const { setAllVehicles, userId } = deps;

  return async (vehicleId: string): Promise<void> => {
    const now = new Date().toISOString();
    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({
        keytag_audited_at: now,
        keytag_audited_by: userId,
        keytag_audit_result: 'unreadable',
      }).eq('id', vehicleId)
    );
    if (error) throw new Error(`Failed to flag key tag: ${(error as { message?: string }).message}`);
    setAllVehicles(prev => prev.map(v => (v.id === vehicleId ? {
      ...v, keytagAuditedAt: now, keytagAuditedBy: userId, keytagAuditResult: 'unreadable' as const,
    } : v)));
  };
}
