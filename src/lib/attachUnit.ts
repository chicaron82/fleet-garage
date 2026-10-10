// A unit he typed, landing on the plate-only record FG already has — instead of a second car.
//
// ⭐ WHY (Aaron, 2026-10-09). He typed unit 5428263 off a Ram's door sticker into Find a car and got
// "Not in the fleet — couldn't read enough to register it". The truck WAS in FG, as `KGE609`: a
// plate-only geotab record with no unit, so the unit could never find it. Registering from that
// dead end would have minted a duplicate of exactly the trucks he is most likely to type a unit for.
//
// A plate-only record asserts one thing — this plate exists — and claims nothing else. The first
// time someone stands at the car with its unit number, that is the record to fill, not replace.

import type { Vehicle } from '../types';
import type { VehicleIdentityEdit } from '../context/vehicleIdentityWrite';

/** The live record already holding this plate with NO unit number, or null. */
export function plateOnlyRecord(vehicleId: string | null | undefined, vehicles: readonly Vehicle[]): Vehicle | null {
  if (!vehicleId) return null;
  const v = vehicles.find(x => x.id === vehicleId);
  if (!v || v.archivedAt) return null;
  return (v.unitNumber ?? '').trim() === '' ? v : null;
}

export interface AttachForm {
  unit: string; make: string; model: string; year: number; color: string;
  rentalClass: string; classCode: string; isHybrid: boolean;
}

/**
 * What attaching writes: always the unit, and the form's make/model/year/colour ONLY when the
 * record has none of its own and the form has all four. A record that already says what it is
 * keeps saying it; a half-typed form writes no identity at all rather than half of one.
 */
export function attachPlan(existing: Vehicle, form: AttachForm): { unit: string; identity?: VehicleIdentityEdit } {
  const unit = form.unit.trim();
  const recordIsBlank = !existing.make && !existing.model;
  const formIsWhole = !!form.make && !!form.model && form.year > 1999 && !!form.color;
  if (!recordIsBlank || !formIsWhole) return { unit };
  return {
    unit,
    identity: {
      make: form.make, model: form.model, year: form.year, color: form.color,
      rentalClass: form.rentalClass.trim() || null,
      classCode: form.classCode.trim().toUpperCase() || null,
      isHybrid: form.isHybrid,
    },
  };
}
