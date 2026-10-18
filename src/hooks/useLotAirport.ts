// Lot Lookout, airport, read side: the two readings and the aisle flag (migration 157), live. Read by the drivers' /lot
// page, /lot/view, FG's top bar, My Day's card and the Lot Lookout module, so every surface reads the same row. Reads go
// straight to Supabase (SELECT is open); writes never do — see useAirportTaps and api/lot.ts.
//
// ⚠️ `channel` must be unique per surface. The realtime client hands back the EXISTING channel when asked for a name it
// already has, so two surfaces sharing one name share one channel, and the first to unmount kills both (found on the
// Erin pill, 2026-10-16). The top bar is mounted on every screen, beside whichever surface is open.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AIRPORT_WRITTEN_EVENT, EMPTY_READINGS, readingsFromRow, type AirportReadings, type AirportRowShape } from '../lib/lotAirport';

export interface LotAirport {
  readings: AirportReadings;
  loaded: boolean;
  error: string | null;
  /** Ticks every 30 s so "12m" moves without a tap. */
  nowMs: number;
  /** Take the row a write answered with, in case its realtime echo is slow or lost. */
  setLocal: (next: (r: AirportReadings) => AirportReadings) => void;
}

const COLS = 'cleans, cleans_by, cleans_at, returns, returns_by, returns_at, aisle, aisle_by, aisle_at';
const readRow = () => supabase.from('lot_airport').select(COLS).eq('id', 1).maybeSingle();

export function useLotAirport(channel: string): LotAirport {
  const [readings, setReadings] = useState<AirportReadings>(EMPTY_READINGS);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const apply = useCallback((r: Awaited<ReturnType<typeof readRow>>) => {
    if (r.error) {
      setError('The airport readings could not load.');
      setLoaded(true);
      return;
    }
    // No row = migration 157 not run here. Stay not-loaded, so every surface hides instead of showing an error.
    if (!r.data) return;
    setReadings(readingsFromRow(r.data as AirportRowShape));
    setError(null);
    setLoaded(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const read = () => { setNowMs(Date.now()); void readRow().then(r => { if (!cancelled) apply(r); }); };
    read();
    // ⚠️ A push sent while the socket was down is never replayed. Aaron, 2026-10-18, airplane-mode test on his own phone:
    // his queued tap landed the moment signal came back, My Day (mounted fresh) showed it, and the top bar's squares,
    // already mounted and still rejoining, stayed hollow. So read the row whenever the channel (re)subscribes and
    // whenever the phone says it is back online, not only when the page comes back into view.
    let joined = false;
    const ch = supabase
      .channel(channel)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lot_airport' }, payload => {
        setReadings(readingsFromRow(payload.new as AirportRowShape));
      })
      // The first SUBSCRIBED follows the read above; every later one is a rejoin after a drop.
      .subscribe(status => { if (status === 'SUBSCRIBED') { if (joined) read(); joined = true; } });
    const tick = setInterval(() => setNowMs(Date.now()), 30_000);
    // A phone that slept in a pocket missed the pushes; read fresh when it wakes.
    const onVisible = () => { if (document.visibilityState === 'visible') read(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', read);
    window.addEventListener(AIRPORT_WRITTEN_EVENT, read);
    return () => {
      cancelled = true;
      void supabase.removeChannel(ch);
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', read);
      window.removeEventListener(AIRPORT_WRITTEN_EVENT, read);
    };
  }, [apply, channel]);

  const setLocal = useCallback((next: (r: AirportReadings) => AirportReadings) => {
    setReadings(next);
    setNowMs(Date.now());
  }, []);

  return { readings, loaded, error, nowMs, setLocal };
}
