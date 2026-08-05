import type { Vehicle, VehicleRegistryEntry } from '../types';

/**
 * A vehicle identity resolved from a plate — either a real fleet `vehicles` row
 * or a remembered registry sighting. Fields are whatever we currently know;
 * nulls are the parts still to be filled in later (the "details added later" of
 * the progressive-plate idea). `source` tells the caller which store answered so
 * it can link by `vehicleId` (canonical) or `registryId` (staged).
 */
export interface KnownPlate {
  source: 'vehicle' | 'registry';
  plate: string;
  unitNumber: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  vehicleId: string | null;   // set when source === 'vehicle'
  registryId: string | null;  // set when source === 'registry'
  /** Non-null when the matched fleet vehicle is ARCHIVED (out of the fleet — e.g. sold/auctioned).
   *  Recognition still finds it (a plate is a global identity), but callers must not treat an
   *  archived match as a LIVE duplicate. Always null for a registry sighting. */
  archivedAt: string | null;
}

/**
 * Canonical plate form for comparison + storage: trimmed, upper-cased, inner
 * whitespace stripped — so "abc 123", "ABC123", and " abc123 " all match.
 */
export function normalizePlate(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

type VehicleLike = Pick<Vehicle, 'id' | 'licensePlate' | 'unitNumber' | 'make' | 'model' | 'year' | 'color' | 'archivedAt'>;

/**
 * Resolve the best-known identity for a (normalized) plate. A real fleet
 * `vehicles` row always wins over a staged registry sighting — the registry is
 * only consulted when the plate isn't in the canonical fleet. Pure: the caller
 * supplies the already-loaded vehicles list and (optionally) the registry entry
 * found by a cross-date lookup. Returns null when the plate is unknown to both.
 */
export function pickKnownVehicle(
  plate: string,
  vehicles: VehicleLike[],
  registryEntry: VehicleRegistryEntry | null,
): KnownPlate | null {
  const v = vehicles.find(x => normalizePlate(x.licensePlate) === plate);
  if (v) {
    return {
      source: 'vehicle', plate,
      unitNumber: v.unitNumber, make: v.make, model: v.model, year: v.year, color: v.color,
      vehicleId: v.id, registryId: null,
      archivedAt: v.archivedAt ?? null,
    };
  }
  if (registryEntry?.plate && normalizePlate(registryEntry.plate) === plate) {
    return {
      source: 'registry', plate,
      unitNumber: registryEntry.unitNumber ?? null,
      make:  registryEntry.make  ?? null,
      model: registryEntry.model ?? null,
      year:  registryEntry.year  ?? null,
      color: registryEntry.color ?? null,
      vehicleId: registryEntry.vehicleId ?? null,
      registryId: registryEntry.id,
      archivedAt: null, // a staged registry sighting is never an archived fleet vehicle
    };
  }
  return null;
}

/**
 * Human-readable one-liner for a resolved plate — "Unit 1234567 · 2023 Toyota
 * Camry", or "" when only the bare plate is known (the caller shows a fallback
 * like "recognized from a previous log"). Shared by every plate-entry surface.
 */
export function describeKnownPlate(m: KnownPlate): string {
  const veh = [m.year, m.make, m.model].filter(Boolean).join(' ');
  return [m.unitNumber ? `Unit ${m.unitNumber}` : '', veh].filter(Boolean).join(' · ');
}
