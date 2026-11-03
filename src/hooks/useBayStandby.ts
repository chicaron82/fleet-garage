// The bay log's Next up (migration 163): the one car lined up behind the car in the bay. Read straight from Supabase;
// writes go through api/lot.ts for a signed-in FG session. Every exit pulls it in on the server. Aaron, 2026-11-02:
// *"since we generally work with another vehicle lined up"*. Ticket: docs/ticket-bay-odo-in-card-and-next-up.md.
//
// Never on the read-only /lot/view: this hook is only mounted where he works.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { businessDateOf } from '../lib/shiftDay';
import { withSubmitLock } from '../lib/submitLock';
import { postLotSignedIn } from './useLotPin';

export interface BayStandbyRow { vehicle_id: string; plate: string; unit_number: string | null; car: string | null; shift_day: string }

export interface BayStandbyState {
  standby: BayStandbyRow | null;
  loaded: boolean;
  /** Line this car up. Null when it landed, else what went wrong. */
  load: (vehicleId: string) => Promise<string | null>;
  clear: () => Promise<string | null>;
}

let channelSeq = 0;

/** Yesterday's plate is not today's Next up: the server won't start it, so no screen shows it. */
function live(row: BayStandbyRow | null): BayStandbyRow | null {
  return row && row.shift_day === businessDateOf(new Date()) ? row : null;
}

export function useBayStandby(by = 'FG'): BayStandbyState {
  const [standby, setStandby] = useState<BayStandbyRow | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const read = () => {
      void supabase.from('lot_bay_standby').select('vehicle_id, plate, unit_number, car, shift_day').eq('id', 1).maybeSingle().then(({ data, error }) => {
        if (cancelled) return;
        if (!error) setStandby(live(data));
        setLoaded(true);
      });
    };
    read();
    const channel = supabase
      .channel(`lot-bay-standby-${channelSeq++}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lot_bay_standby' }, read)
      .subscribe();
    const onVisible = () => { if (document.visibilityState === 'visible') read(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const send = useCallback(async (body: Record<string, unknown>): Promise<string | null> => {
    const r = await postLotSignedIn({ ...body, by });
    if (!r.ok) return r.error ?? 'On deck did not save. Try again.';
    setStandby(live((r.json.standby ?? null) as BayStandbyRow | null));
    return null;
  }, [by]);

  const load = useCallback(async (vehicleId: string) =>
    (await withSubmitLock('bay:standby', () => send({ action: 'bayStandbySet', vehicleId }))) ?? null, [send]);
  const clear = useCallback(async () =>
    (await withSubmitLock('bay:standby', () => send({ action: 'bayStandbyClear' }))) ?? null, [send]);

  return { standby, loaded, load, clear };
}
