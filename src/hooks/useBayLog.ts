// Lot Lookout's bay log (migration 161): today's cars, live, and (signed in) the three writes: Start, an exit, an exit's
// Undo. Read straight from Supabase (SELECT is open, so the read-only /lot/view needs no PIN); writes go through
// api/lot.ts, the one writer, for a signed-in FG session only. Ticket: docs/ticket-lot-lookout-bay-log.md.
//
// A write that fails SAYS so (CLAUDE.md, "a write that fails must SAY so"): each returns the error text, or null when it
// landed, and the list only changes from what the server saved.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { BAY_LOG_COLUMNS, type BayExit, type BayLogRow } from '../lib/lotBayLog';
import { businessDateOf } from '../lib/shiftDay';
import { withSubmitLock } from '../lib/submitLock';
import { postLotSignedIn } from './useLotPin';

export interface BayLogState {
  rows: BayLogRow[];
  loaded: boolean;
  error: string | null;
  start: (vehicleId: string) => Promise<string | null>;
  exit: (id: number, exit: BayExit) => Promise<string | null>;
  undoExit: (id: number) => Promise<string | null>;
}

let channelSeq = 0;

/** Close a car's bay row as held, from the hold form once the hold has SAVED (never before: backing out of the form
 *  leaves the car in the bay). Null when it closed, else what went wrong. No hook: the form needs no live list. */
export async function exitBayCarAsHeld(id: number, kind: 'mhold' | 'bhold', by: string): Promise<string | null> {
  const r = await withSubmitLock(`bay:exit:${id}`, () => postLotSignedIn({ action: 'bayExit', id, exit: kind, by }));
  return !r || r.ok ? null : r.error ?? 'The bay log did not save.';
}

/** Today's cars, PLUS any car still in the bay from an earlier day. ⚠️ Without the second half, a car left in at the
 *  04:00 cutover vanished from every screen while migration 161's one-car index kept refusing every Start: an empty
 *  bay that could never be filled, with nothing to tap (found at /reflect, 2026-10-29, before it ever happened). */
function fetchDay(day: string) {
  return supabase.from('lot_bay_log').select(BAY_LOG_COLUMNS).or(`shift_day.eq.${day},exit.is.null`).order('started_at');
}

/** `by`: his initials, the label every FG lot write carries (a Clean's +1 lands on Erin St's count as his, not "Lot").
 *  Read-only callers leave it out. */
export function useBayLog(by = 'FG'): BayLogState {
  const [rows, setRows] = useState<BayLogRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const read = () => {
      void fetchDay(businessDateOf(new Date())).then(({ data, error: e }) => {
        if (cancelled) return;
        // No table yet (before migration 161): the log stays empty rather than putting an error on his screen.
        setError(e && e.code !== '42P01' ? 'The bay log did not load.' : null);
        if (!e) setRows((data ?? []) as BayLogRow[]);
        setLoaded(true);
      });
    };
    read();
    // One channel name per hook (useLotBay's lesson): the top bar's start button and the module may both be mounted.
    let joined = false;
    const channel = supabase
      .channel(`lot-bay-log-${channelSeq++}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lot_bay_log' }, read)
      .subscribe(status => { if (status === 'SUBSCRIBED') { if (joined) read(); joined = true; } });
    const onVisible = () => { if (document.visibilityState === 'visible') read(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', read);
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', read);
    };
  }, []);

  /** Send one write; keep the saved row; say what went wrong otherwise. */
  const send = useCallback(async (body: Record<string, unknown>): Promise<string | null> => {
    const r = await postLotSignedIn({ ...body, by });
    if (!r.ok) return r.error ?? 'The bay log did not save. Try again.';
    const saved = r.json.row as BayLogRow | undefined;
    if (saved) setRows(prev => [...prev.filter(x => x.id !== saved.id), saved].sort((a, b) => a.started_at.localeCompare(b.started_at)));
    return null;
  }, [by]);

  // Both mint or settle a row, so a double tap in one frame must not send twice (CLAUDE.md, "the submit lock").
  // A locked-out second tap resolves undefined: nothing to say, the first tap is already on its way.
  const start = useCallback(async (vehicleId: string) =>
    (await withSubmitLock('bay:start', () => send({ action: 'bayStart', vehicleId }))) ?? null, [send]);
  const exit = useCallback(async (id: number, kind: BayExit) =>
    (await withSubmitLock(`bay:exit:${id}`, () => send({ action: 'bayExit', id, exit: kind }))) ?? null, [send]);
  const undoExit = useCallback((id: number) => send({ action: 'bayExitUndo', id }), [send]);

  return { rows, loaded, error, start, exit, undoExit };
}
