// Lot Lookout, Erin St, read side: the bay's count, live, and (for the bay page) today's list of changes. Read
// straight from Supabase (migration 153 allows SELECT to the browser's keys); writes go through useBayTaps.
//
// ⚠️ Live only because migration 153 adds lot_bay to `supabase_realtime`. lot_bay_taps is not in it: the list is
// re-read whenever the count changes, which is the only time it can have grown.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { bayFromRow, bayTapFromRow, type BayRow, type LotBay, type LotBayTap } from '../lib/lotBay';
import { startOfShiftDayISO } from '../lib/shiftDay';

export interface LotBayState {
  bay: LotBay | null;
  log: LotBayTap[];
  loaded: boolean;
  /** Ticks every 30 s so "as of" ages and the 30-min amber arrives without a tap. */
  nowMs: number;
  /** Show a write at once, before the realtime echo. */
  setBay: (next: LotBay) => void;
}

const LOG_ROWS = 8;
let channelSeq = 0;

function fetchBay() {
  return supabase.from('lot_bay')
    .select('cleans, cleans_by, cleans_at, dirties, dirties_by, dirties_at, used, used_on').eq('id', 1).maybeSingle();
}
function fetchLog() {
  return supabase.from('lot_bay_taps').select('id, kind, value, prev, tapped_by, tapped_at')
    .gte('tapped_at', startOfShiftDayISO()).order('tapped_at', { ascending: false }).limit(LOG_ROWS);
}

export function useLotBay({ withLog = false }: { withLog?: boolean } = {}): LotBayState {
  const [bay, setBay] = useState<LotBay | null>(null);
  const [log, setLog] = useState<LotBayTap[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const readLog = () => {
      if (withLog) void fetchLog().then(({ data }) => { if (!cancelled) setLog((data ?? []).map(bayTapFromRow)); });
    };
    const read = () => {
      void fetchBay().then(({ data, error }) => {
        if (cancelled) return;
        // No row, or no table yet (before migration 153): the count stays hidden rather than showing an error.
        setBay(!error && data ? bayFromRow(data) : null);
        setLoaded(true);
        setNowMs(Date.now());
      });
      readLog();
    };
    read();
    // ⚠️ One channel name PER HOOK. supabase.channel() hands back the existing channel for a name it has seen, so
    // since the Erin pill (2026-10-16) keeps a count in the top bar while My Day's card or the module keeps another,
    // a shared name would have added listeners after subscribe and the first to unmount would have closed both.
    // ⚠️ A push sent while the socket was down is never replayed. Aaron, 2026-10-18, airplane-mode test on his own phone:
    // his queued tap landed the moment signal came back, My Day (mounted fresh) showed it, and the top bar's squares,
    // already mounted and still rejoining, stayed hollow. So read the row whenever the channel (re)subscribes and
    // whenever the phone says it is back online, not only when the page comes back into view.
    let joined = false;
    const channel = supabase
      .channel(`lot-bay-live-${channelSeq++}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lot_bay' }, payload => {
        setBay(bayFromRow(payload.new as BayRow));
        readLog();
      })
      // The first SUBSCRIBED follows the read above; every later one is a rejoin after a drop.
      .subscribe(status => { if (status === 'SUBSCRIBED') { if (joined) read(); joined = true; } });
    const tick = setInterval(() => setNowMs(Date.now()), 30_000);
    // A phone that slept in a pocket missed the realtime pushes; read fresh when it wakes.
    const onVisible = () => { if (document.visibilityState === 'visible') read(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', read);
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', read);
    };
  }, [withLog]);

  const setBayNow = useCallback((next: LotBay) => { setBay(next); setNowMs(Date.now()); }, []);

  return { bay, log, loaded, nowMs, setBay: setBayNow };
}
