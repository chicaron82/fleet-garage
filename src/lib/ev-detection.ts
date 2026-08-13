import { supabase } from './supabase';
import type { EvAssetStatus } from '../types';

export interface TeslaDetectionResult {
  isTesla: boolean;
  lastCable: EvAssetStatus | null;
  lastAdapter: EvAssetStatus | null;
  vehicle?: {
    id: string;
    make: string;
    model: string;
    year: number;
    color: string;
  };
}

export interface TeslaVehicleRow {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
}

export interface EvStatusRow {
  ev_cable_status: string | null;
  ev_adapter_status: string | null;
}

export function isTeslaMake(make: string | null | undefined): boolean {
  return (make ?? '').toLowerCase() === 'tesla';
}

/** The vehicle record stores each EV asset as a nullable boolean; every UI that edits one speaks
 *  `EvAssetStatus`. Shared rather than re-declared per screen — two copies of a converter is how
 *  two screens end up disagreeing about what `null` means. `null` stays null: never assessed. */
export const toEvStatus = (b: boolean | null | undefined): EvAssetStatus | null =>
  b == null ? null : b ? 'present' : 'missing';

/** The EV-kit status to surface at scan time (tag in hand), from the vehicle's canonical asset
 *  record. Mirrors evDispatchWarning's honesty: only a known-`false` counts as MISSING; a `null`
 *  (never assessed) is claimed neither way — so "complete" requires BOTH assets confirmed present,
 *  never fabricated off an unchecked one. Returns null for non-Teslas AND for a Tesla with nothing
 *  worth surfacing (partial/unassessed, none missing) — the scan card shows a line only when non-null.
 *  It's a LAST-SEEN status (the last recorded state), not a live check — the copy says so. */
export type EvScanStatus =
  | { kind: 'complete' }
  | { kind: 'missing'; missing: ('cable' | 'adapter')[] };

export function evAssetScanStatus(v: {
  isTesla?: boolean | null;
  make?: string | null;
  hasMobileCable?: boolean | null;
  hasJ1772Adapter?: boolean | null;
}): EvScanStatus | null {
  if (!v.isTesla && !isTeslaMake(v.make)) return null;
  const missing: ('cable' | 'adapter')[] = [];
  if (v.hasMobileCable === false) missing.push('cable');
  if (v.hasJ1772Adapter === false) missing.push('adapter');
  if (missing.length > 0) return { kind: 'missing', missing };
  if (v.hasMobileCable === true && v.hasJ1772Adapter === true) return { kind: 'complete' };
  return null; // partially/never assessed, none known-missing → nothing honest to surface
}

/**
 * Pure resolution of a Tesla detection result from a vehicle row and (when the
 * vehicle is a Tesla) the latest EV-status trip row. No I/O — `detectTeslaByPlate`
 * fetches the rows and delegates here. `lastTrip` is ignored for non-Teslas.
 */
export function classifyTesla(
  vehicle: TeslaVehicleRow | null,
  lastTrip: EvStatusRow | null,
): TeslaDetectionResult {
  if (!vehicle) return { isTesla: false, lastCable: null, lastAdapter: null };

  const info = { id: vehicle.id, make: vehicle.make, model: vehicle.model, year: vehicle.year, color: vehicle.color };

  if (!isTeslaMake(vehicle.make)) {
    return { isTesla: false, lastCable: null, lastAdapter: null, vehicle: info };
  }

  return {
    isTesla: true,
    lastCable:   (lastTrip?.ev_cable_status   as EvAssetStatus) ?? null,
    lastAdapter: (lastTrip?.ev_adapter_status as EvAssetStatus) ?? null,
    vehicle: info,
  };
}

export async function detectTeslaByPlate(plate: string): Promise<TeslaDetectionResult> {
  const trimmed = plate.trim();
  if (!trimmed) return { isTesla: false, lastCable: null, lastAdapter: null };

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('id, make, model, year, color')
    .ilike('license_plate', trimmed)
    .maybeSingle();

  if (!vehicle) return classifyTesla(null, null);

  // Only the EV-status query is gated on Tesla; fetch it lazily.
  let lastTrip: EvStatusRow | null = null;
  if (isTeslaMake(vehicle.make as string)) {
    const { data } = await supabase
      .from('vsa_trips')
      .select('ev_cable_status, ev_adapter_status')
      .ilike('vehicle_plate', trimmed)
      .not('ev_cable_status', 'is', null)
      .order('depart_time', { ascending: false })
      .limit(1)
      .maybeSingle();
    lastTrip = data as EvStatusRow | null;
  }

  return classifyTesla(vehicle as TeslaVehicleRow, lastTrip);
}

export interface VehicleSearchResult {
  license_plate: string;
  make: string;
  model: string;
  year: number;
  color: string;
}

export async function searchVehicles(query: string): Promise<VehicleSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const { data } = await supabase
    .from('vehicles')
    .select('license_plate, make, model, year, color')
    .ilike('license_plate', `${trimmed}%`)
    .limit(5);

  return (data as VehicleSearchResult[]) || [];
}
