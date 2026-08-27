import { supabase, writeWithRefresh } from '../lib/supabase';
import type { Vehicle } from '../types';

/** Records winter tires AS OBSERVED, with the moment he looked.
 *
 * ⚠️ THIS EXISTS BECAUSE I SHIPPED THE FIELD WITH NO WAY TO CHANGE IT. On 2026-08-27 winter tires
 * arrived with a date precisely because they are SEASONAL STATE — a car has them in January and not
 * in July — and then the only writer was the registration form. A field whose entire design point is
 * that it changes twice a year, writable exactly once, at birth.
 *
 * ⭐ The record already RENDERED it. So in one afternoon I built a writer with no reader (lost &
 * found history), a reader with no writer (the Stage's cooking mode), and then this: a reader with a
 * writer that can never fire again. Same shape, third face, found in my own work by a reflect.
 *
 * ⚠️ LATEST-WINS, unlike the VIN's first-good-read-wins. A VIN is immutable, so an early reading is
 * exactly as true as a late one. Tires are the opposite: the newest observation is the only one worth
 * having, and the DATE is what stops it aging into a lie by spring.
 *
 * Returns false when nothing was written, so no caller can report a success that did not happen. */
export function makeRecordWinterTires(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
}) {
  const { setAllVehicles } = deps;

  return async (vehicleId: string, fitted: boolean): Promise<boolean> => {
    const at = new Date().toISOString();
    const { data, error } = await writeWithRefresh(() =>
      supabase.from('vehicles')
        .update({ winter_tires: fitted, winter_tires_at: at })
        .eq('id', vehicleId)
        .select('id')
    );
    if (error || !data?.length) return false;
    setAllVehicles(prev => prev.map(v =>
      (v.id === vehicleId ? { ...v, winterTires: fitted, winterTiresAt: at } : v)));
    return true;
  };
}
