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
    const channel = supabase
      .channel('lot-bay-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lot_bay' }, payload => {
        setBay(bayFromRow(payload.new as BayRow));
        readLog();
      })
      .subscribe();
    const tick = setInterval(() => setNowMs(Date.now()), 30_000);
    // A phone that slept in a pocket missed the realtime pushes; read fresh when it wakes.
    const onVisible = () => { if (document.visibilityState === 'visible') read(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [withLog]);

  const setBayNow = useCallback((next: LotBay) => { setBay(next); setNowMs(Date.now()); }, []);

  return { bay, log, loaded, nowMs, setBay: setBayNow };
}
