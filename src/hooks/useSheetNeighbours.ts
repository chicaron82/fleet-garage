// The car's readings either side of the sheet day, read once the car is picked, so he can judge a typed odo before he
// saves it (Aaron, 2026-11-10: *"show the odo reading before the date i'm entering for ... this way i can determine if
// the odo is plausible and guard against an odo that's higher than the later date if its been entered"*).
// From odometer_readings (migration 168), live rows only. `loading` until both answer; a read that fails is `failed`,
// never "no readings" (a search that could not run is not a search that found nothing).
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { sheetDayBounds, type Neighbour } from '../lib/sheetDay';

export interface SheetNeighbours { before: Neighbour | null; after: Neighbour | null; state: 'loading' | 'ready' | 'failed' }

const LOADING: SheetNeighbours = { before: null, after: null, state: 'loading' };

export function useSheetNeighbours(vehicleId: string | null, day: string): SheetNeighbours {
  const [got, setGot] = useState<{ key: string; value: SheetNeighbours } | null>(null);
  const key = `${vehicleId}|${day}`;

  useEffect(() => {
    if (!vehicleId || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    let live = true;
    const b = sheetDayBounds(day);
    const base = () => supabase.from('odometer_readings').select('km, read_at').eq('vehicle_id', vehicleId).is('voided_at', null);
    void Promise.all([
      base().lt('read_at', b.start).order('read_at', { ascending: false }).limit(1),
      base().gte('read_at', b.end).order('read_at', { ascending: true }).limit(1),
    ]).then(([pre, post]) => {
      if (!live) return;
      const one = (r: typeof pre) => {
        const x = r.data?.[0] as { km: number; read_at: string } | undefined;
        return x ? { km: x.km, at: x.read_at } : null;
      };
      setGot({ key: `${vehicleId}|${day}`, value: pre.error || post.error
        ? { before: null, after: null, state: 'failed' }
        : { before: one(pre), after: one(post), state: 'ready' } });
    });
    return () => { live = false; };
  }, [vehicleId, day]);

  return got && got.key === key ? got.value : LOADING;
}
