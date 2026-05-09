import { supabase } from './supabase';
import type { EvAssetStatus } from '../types';

export interface TeslaDetectionResult {
  isTesla: boolean;
  lastCable: EvAssetStatus | null;
  lastAdapter: EvAssetStatus | null;
  vehicle?: {
    make: string;
    model: string;
    year: number;
    color: string;
  };
}

export async function detectTeslaByPlate(plate: string): Promise<TeslaDetectionResult> {
  const trimmed = plate.trim();
  if (!trimmed) return { isTesla: false, lastCable: null, lastAdapter: null };

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('make, model, year, color')
    .ilike('license_plate', trimmed)
    .maybeSingle();

  if (!vehicle) {
    return { isTesla: false, lastCable: null, lastAdapter: null };
  }

  const isTesla = (vehicle.make as string)?.toLowerCase() === 'tesla';

  if (!isTesla) {
    return {
      isTesla: false,
      lastCable: null,
      lastAdapter: null,
      vehicle: {
        make: vehicle.make as string,
        model: vehicle.model as string,
        year: vehicle.year as number,
        color: vehicle.color as string,
      }
    };
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
    vehicle: {
      make: vehicle.make as string,
      model: vehicle.model as string,
      year: vehicle.year as number,
      color: vehicle.color as string,
    }
  };
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
