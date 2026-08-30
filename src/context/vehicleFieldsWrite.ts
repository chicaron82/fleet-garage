import { supabase, writeWithRefresh } from '../lib/supabase';
import type { Vehicle, FieldSource } from '../types';
import type { KeytagFill } from '../lib/resolveKeytag';
import { findUnitConflict } from '../lib/identityConflict';

/** What the write has to say for itself. `unitConflict` means the tag's unit number was NOT applied
 *  because another live record already carries it — everything else the tag read still was. */
export interface UpdateFieldsResult { unitConflict?: Vehicle }

/** The `vehicles` row shape a backfill can touch — typed explicitly (not a generic
 *  Record) because the Supabase client rejects an untyped update payload. */
interface VehicleFieldsUpdate {
  unit_number?: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  rental_class?: string;
  // ⚠️ The three the reader has always extracted and this payload never carried (2026-08-30). A
  // scan could fill a car's colour but not its VIN, so 44 of the 45 cars in Aaron's audit queue sat
  // there missing exactly these two — off photos FG had already read correctly.
  owning_area?: string;
  class_code?: string;
  vin_last9?: string;
  field_sources?: Record<string, FieldSource>;
}

/** Applies key-tag-read FILLS + CHANGES (blanks and non-locked corrections — resolveKeytag decides
 *  which, and a LOCKED/manual field never reaches here) to a vehicle's identity fields, and stamps
 *  each applied field's provenance as 'tag'. This is the TAG write path; the manual-edit path stamps
 *  'manual' instead (directEditVehicleIdentity). Single-purpose, extracted to keep
 *  useVehicleOperations under the line cap (mirrors evAssetWrite.ts). */
export function makeUpdateVehicleFields(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  /** Live fleet, for the unit#-collision guard below. */
  allVehicles: Vehicle[];
}) {
  const { setAllVehicles, allVehicles } = deps;

  return async (vehicleId: string, fills: KeytagFill[]): Promise<UpdateFieldsResult> => {
    if (fills.length === 0) return {};

    // ⭐⭐ THE UNIT#-COLLISION GUARD. The registration form has always checked this (useUnitConflict
    // → findUnitConflict) because a unit number is fleet-wide: the same number on two records means
    // it has drifted onto the wrong car. A SCAN writing the same field had no such check, and that
    // is what produced both of this week's duplicate-unit findings — LUR254 on 2026-08-21 and
    // LUR243 tonight. Each time a tag wrote a unit number straight over the top and the collision
    // only surfaced days later on the audit board.
    //
    // ⚠️ It does NOT decide which record is right. Aaron's LUR254 case was the TAG being correct and
    // the other row being bogus; tonight's LUR243 was the opposite. The data cannot tell them apart
    // — only the key tag can, and he is holding it at exactly this moment. So the unit is left
    // alone, everything else the tag read is still written, and the conflict is handed back to be
    // said out loud. Never silently create the duplicate; never silently "fix" it either.
    const unitFill = fills.find(f => f.field === 'unitNumber');
    const conflict = unitFill
      ? findUnitConflict(String(unitFill.value ?? ''), allVehicles, vehicleId)
      : undefined;
    const applied = conflict ? fills.filter(f => f.field !== 'unitNumber') : fills;
    if (applied.length === 0) return { unitConflict: conflict };

    const payload: VehicleFieldsUpdate = {};
    const patch: Partial<Pick<Vehicle,
      'unitNumber' | 'make' | 'model' | 'year' | 'color' | 'rentalClass'
      | 'owningArea' | 'classCode' | 'vinLast9'>> = {};
    const stamps: Record<string, FieldSource> = {};
    for (const f of applied) {
      if (f.field === 'unitNumber')       { payload.unit_number = f.value as string; patch.unitNumber = f.value as string; }
      else if (f.field === 'year')        { payload.year = f.value as number; patch.year = f.value as number; }
      else if (f.field === 'rentalClass') { payload.rental_class = f.value as string; patch.rentalClass = f.value as string; }
      else if (f.field === 'owningArea')  { payload.owning_area = f.value as string; patch.owningArea = f.value as string; }
      else if (f.field === 'classCode')   { payload.class_code = f.value as string; patch.classCode = f.value as string; }
      else if (f.field === 'vinLast9')    { payload.vin_last9 = f.value as string; patch.vinLast9 = f.value as string; }
      else                                { payload[f.field] = f.value as string; patch[f.field] = f.value as string; }
      stamps[f.field] = 'tag';   // every field this path sets came from a scanned tag
    }
    // Merge the 'tag' stamps into the existing field_sources so provenance accumulates (a manual
    // edit can still lock over a tag, and vice-versa). Read-modify-write is safe on a single-operator
    // tool; if the read fails we still stamp what we're setting rather than lose provenance.
    const { data: cur } = await supabase.from('vehicles').select('field_sources').eq('id', vehicleId).maybeSingle();
    const existingSources = (cur && typeof cur.field_sources === 'object' && cur.field_sources)
      ? (cur.field_sources as Record<string, FieldSource>) : {};
    const merged = { ...existingSources, ...stamps };
    payload.field_sources = merged;

    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update(payload).eq('id', vehicleId)
    );
    if (error) throw new Error(`Failed to update vehicle: ${(error as { message?: string }).message}`);
    setAllVehicles(prev => prev.map(v => (v.id === vehicleId ? { ...v, ...patch, fieldSources: merged } : v)));
    return { unitConflict: conflict };
  };
}
