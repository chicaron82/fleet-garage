import type { Vehicle } from '../types';

/**
 * Find an active vehicle that already carries this unit number — a *different*
 * record than the one being registered/edited. Unit numbers are fleet-wide, so a
 * match on a different record means the number has drifted onto the wrong vehicle
 * (a mistype, a swapped car, the same vehicle entered twice). Catching it at
 * registration is what stops the same unit# getting stapled to two records.
 *
 * Case-insensitive. Blank input never conflicts; archived records are ignored
 * (a retired vehicle isn't a live collision); `excludeId` skips the record under
 * edit so it never conflicts with itself.
 */
export function findUnitConflict(
  unit: string,
  vehicles: Vehicle[],
  excludeId?: string,
): Vehicle | undefined {
  const u = unit.trim().toLowerCase();
  if (!u) return undefined;
  return vehicles.find(
    v => v.id !== excludeId
      && !v.archivedAt
      && v.unitNumber?.toLowerCase() === u,
  );
}
