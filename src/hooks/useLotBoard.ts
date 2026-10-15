// Lot Lookout, read side: the board, live. Used by the public /lot page AND by FG (My Day), so both read
// exactly the same rows. Reads go straight to Supabase (migration 151 allows SELECT to the browser's keys);
// writes never do — see useLotTaps and api/lot.ts.
//
// ⚠️ Silent unless lot_stalls / lot_aisle are in the `supabase_realtime` publication (migration 151 adds them):
// a channel on a table outside it subscribes happily and never fires (same trap as useOverflowSends).
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { stallFromRow, type LotAisle, type LotStall } from '../lib/lotLookout';

export interface LotBoard {
  stalls: LotStall[];
  aisle: LotAisle;
  loaded: boolean;
  error: string | null;
  /** Ticks every 30 s so "12 min ago" and the 2-hour fade move without a tap. */
  nowMs: number;
  /** Apply a write locally before the realtime echo lands (the tapper sees it instantly). */
  patchStall: (stall: string, next: Partial<LotStall>) => void;
  setAisle: (next: LotAisle) => void;
  reload: () => Promise<void>;
}

const EMPTY_AISLE: LotAisle = { cars: 0, tappedBy: null, tappedAt: null };

function readBoard() {
  return Promise.all([
    supabase.from('lot_stalls').select('stall, run, num, state, tapped_by, tapped_at'),
    supabase.from('lot_aisle').select('cars, tapped_by, tapped_at').eq('id', 1).maybeSingle(),
  ]).then(([s, a]) => ({ s, a }));
}
type BoardRead = Awaited<ReturnType<typeof readBoard>>;

export function useLotBoard(): LotBoard {
  const [stalls, setStalls] = useState<LotStall[]>([]);
  const [aisle, setAisle] = useState<LotAisle>(EMPTY_AISLE);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const apply = useCallback((r: BoardRead) => {
    if (r.s.error || r.a.error) {
      setError('The lot board could not load. Check the signal and pull to refresh.');
      setLoaded(true);
      return;
    }
    setStalls((r.s.data ?? []).map(stallFromRow));
    setAisle(r.a.data ? { cars: r.a.data.cars, tappedBy: r.a.data.tapped_by, tappedAt: r.a.data.tapped_at } : EMPTY_AISLE);
    setError(null);
    setLoaded(true);
  }, []);

  const reload = useCallback(() => readBoard().then(apply), [apply]);

  useEffect(() => {
    let cancelled = false;
    void readBoard().then(r => { if (!cancelled) apply(r); });
    const channel = supabase
      .channel('lot-lookout-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lot_stalls' }, payload => {
        const row = stallFromRow(payload.new as Parameters<typeof stallFromRow>[0]);
        setStalls(prev => prev.map(s => (s.stall === row.stall ? row : s)));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lot_aisle' }, payload => {
        const r = payload.new as { cars: number; tapped_by: string | null; tapped_at: string | null };
        setAisle({ cars: r.cars, tappedBy: r.tapped_by, tappedAt: r.tapped_at });
      })
      .subscribe();
    const tick = setInterval(() => setNowMs(Date.now()), 30_000);
    // A phone that slept in a pocket missed the realtime pushes; read the board fresh when it wakes.
    const onVisible = () => { if (document.visibilityState === 'visible') { setNowMs(Date.now()); void readBoard().then(r => { if (!cancelled) apply(r); }); } };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [apply]);

  const patchStall = useCallback((stall: string, next: Partial<LotStall>) => {
    setStalls(prev => prev.map(s => (s.stall === stall ? { ...s, ...next } : s)));
    setNowMs(Date.now());
  }, []);

  return { stalls, aisle, loaded, error, nowMs, patchStall, setAisle, reload };
}
