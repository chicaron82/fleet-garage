import { supabase } from './supabase';
import type { EvAssetStatus } from '../types';

export interface TeslaDetectionResult {
  isTesla: boolean;
  lastCable: EvAssetStatus | null;
  lastAdapter: EvAssetStatus | null;
}

export async function detectTeslaByPlate(plate: string): Promise<TeslaDetectionResult> {
  const trimmed = plate.trim();
  if (!trimmed) return { isTesla: false, lastCable: null, lastAdapter: null };

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('make')
    .ilike('license_plate', trimmed)
    .maybeSingle();

  if (!vehicle || (vehicle.make as string)?.toLowerCase() !== 'tesla') {
    return { isTesla: false, lastCable: null, lastAdapter: null };
  }

  // Most recent trip with EV status recorded for this plate
  const { data: lastTrip } = await supabase
    .from('vsa_trips')
    .select('ev_cable_status, ev_adapter_status')
    .ilike('vehicle_plate', trimmed)
    .not('ev_cable_status', 'is', null)
    .order('depart_time', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    isTesla: true,
    lastCable:   (lastTrip?.ev_cable_status   as EvAssetStatus) ?? null,
    lastAdapter: (lastTrip?.ev_adapter_status as EvAssetStatus) ?? null,
  };
}
