// The reading before the car's current one, and the take-back to it (migration 170). Aaron, 2026-11-14: *"a way to
// undo the incorrect odo so yesterday's can be entered."* docs/November/ticket-odo-take-back-newest.md.
//
// The car's record catches up through the vehicles realtime feed (VehicleHoldContext), the same as any other write.
// A read that fails is `failed`, never "nothing before it": a search that could not run is not a search that found nothing.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { PriorReading, TakeBackResult } from '../lib/odometerTakeBack';

export interface PriorState { prior: PriorReading | null; state: 'loading' | 'ready' | 'failed' }

const LOADING: PriorState = { prior: null, state: 'loading' };

export function usePriorReading(vehicleId: string | null, currentKm: number | null | undefined, currentAt: string | null | undefined): PriorState {
  const key = `${vehicleId}|${currentKm}|${currentAt}`;
  const [got, setGot] = useState<{ key: string; value: PriorState } | null>(null);

  useEffect(() => {
    if (!vehicleId || currentKm == null || !currentAt) return;
    let live = true;
    void supabase.from('odometer_readings').select('km, read_at').eq('vehicle_id', vehicleId).is('voided_at', null)
      .lt('read_at', currentAt).order('read_at', { ascending: false }).limit(1)
      .then(({ data, error }) => {
        if (!live) return;
        const x = data?.[0] as { km: number; read_at: string } | undefined;
        setGot({ key: `${vehicleId}|${currentKm}|${currentAt}`,
          value: error ? { prior: null, state: 'failed' } : { prior: x ? { km: x.km, at: x.read_at } : null, state: 'ready' } });
      });
    return () => { live = false; };
  }, [vehicleId, currentKm, currentAt]);

  if (!vehicleId || currentKm == null || !currentAt) return { prior: null, state: 'ready' };
  return got && got.key === key ? got.value : LOADING;
}

/** Takes the car's newest reading back, guarded server-side on it still being the current. null = the call failed. */
export function useTakeBackOdometer() {
  return useCallback(async (vehicleId: string, km: number, at: string): Promise<TakeBackResult | null> => {
    const { data, error } = await supabase.rpc('take_back_odometer', { p_vehicle: vehicleId, p_km: km, p_at: at });
    return error || !data ? null : (data as unknown as TakeBackResult);
  }, []);
}
