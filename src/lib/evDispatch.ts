import type { Vehicle, Hold } from '../types';
import { isTeslaMake } from './ev-detection';

export interface EvDispatchWarning {
  /** Assets the vehicle's canonical record marks missing (known `false`, not just unassessed). */
  missing: ('cable' | 'adapter')[];
  /** An open missing-accessories hold — the "not dispatchable" flag. */
  notDispatchable: boolean;
}

/**
 * Heads-up for dispatching a Tesla whose EV kit is known-missing. Reads the
 * vehicle's *canonical* asset record (the unified truth updated by every check),
 * not the last trip row — so a washbay/check-in finding surfaces at dispatch even
 * if the last trip didn't record it. Only a known-`missing` (false) counts;
 * `null` ("not assessed") is a nudge to check, not a dispatch warning. Returns
 * null when there's nothing to flag (non-Tesla, all present/unassessed, no hold).
 */
export function evDispatchWarning(
  vehicle: Vehicle | undefined,
  holds: Hold[],
): EvDispatchWarning | null {
  if (!vehicle) return null;
  if (!vehicle.isTesla && !isTeslaMake(vehicle.make)) return null;

  const missing: ('cable' | 'adapter')[] = [];
  if (vehicle.hasMobileCable === false) missing.push('cable');
  if (vehicle.hasJ1772Adapter === false) missing.push('adapter');

  const notDispatchable = holds.some(
    h => h.vehicleId === vehicle.id
      && h.status === 'ACTIVE'
      && (h.holdTypes ?? []).includes('missing_accessories'),
  );

  if (missing.length === 0 && !notDispatchable) return null;
  return { missing, notDispatchable };
}
