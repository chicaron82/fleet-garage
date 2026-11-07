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
  /** `odometer`: the reading logged from the bay card as the car left. `pull: false`: Clean only, Next up's car waits. */
  exit: (id: number, exit: BayExit, odometer?: number, pull?: false) => Promise<string | null>;
  undoExit: (id: number) => Promise<string | null>;
  /** ↩ Back to Next up: the car in the bay goes back in line, no exit logged. `replace`: he said yes to bumping the car
   *  that was there. (docs/ticket-bay-clean-only-and-back-to-next-up.md) */
  bump: (id: number, replace: boolean) => Promise<string | null>;
  /** A car cleaned while he was off the floor, straight onto the list as a Clean (migration 165), and its Undo.
   *  `add` answers the new row's id so the note's Undo can name it, or null for a second tap the lock turned away.
   *  (docs/ticket-bay-add-a-car-cleaned.md) */
  add: (vehicleId: string) => Promise<{ error: string } | { id: number } | null>;
  undoAdd: (id: number) => Promise<string | null>;
  /** His delete (2026-11-06, docs/ticket-bay-remove-a-row.md): a finished row off today's list, the count back with it. */
  remove: (id: number) => Promise<string | null>;
  /** The exit landed but Next up's car could not come in. Said until the next write. */
  nextIssue: string | null;
  /** His note on a finished row (null clears it), and "Same as the … hold" (migration 164). Either answers the saved
   *  row, so an earlier day's list can take it too; today's list takes it here. */
  editRow: (body: { action: 'bayNote'; id: number; note: string | null } | { action: 'bayLinkHold'; id: number; holdId: string }) =>
    Promise<{ error: string } | { row: BayLogRow }>;
}

let channelSeq = 0;

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
  const [nextIssue, setNextIssue] = useState<string | null>(null);

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
    // An exit may bring the next car in; its Undo takes that car back out (migration 163).
    const landed = [r.json.row, r.json.next].filter(Boolean) as BayLogRow[];
    const gone = new Set<number>([...landed.map(x => x.id), ...(typeof r.json.removedId === 'number' ? [r.json.removedId] : [])]);
    if (gone.size) setRows(prev => [...prev.filter(x => !gone.has(x.id)), ...landed].sort((a, b) => a.started_at.localeCompare(b.started_at)));
    setNextIssue(typeof r.json.nextError === 'string' ? r.json.nextError : null);
    return null;
  }, [by]);

  // Both mint or settle a row, so a double tap in one frame must not send twice (CLAUDE.md, "the submit lock").
  // A locked-out second tap resolves undefined: nothing to say, the first tap is already on its way.
  const start = useCallback(async (vehicleId: string) =>
    (await withSubmitLock('bay:start', () => send({ action: 'bayStart', vehicleId }))) ?? null, [send]);
  const exit = useCallback(async (id: number, kind: BayExit, odometer?: number, pull?: false) =>
    (await withSubmitLock(`bay:exit:${id}`, () => send({ action: 'bayExit', id, exit: kind, ...(odometer ? { odometer } : {}), ...(pull === false ? { pull } : {}) }))) ?? null, [send]);
  const undoExit = useCallback((id: number) => send({ action: 'bayExitUndo', id }), [send]);
  // Same lock as the exits: it settles the same row, so an exit and a bump in one frame must not both go.
  const bump = useCallback(async (id: number, replace: boolean) =>
    (await withSubmitLock(`bay:exit:${id}`, () => send({ action: 'bayBumpToNextUp', id, replace }))) ?? null, [send]);

  // Not through `send`, which answers only an error: the note's Undo needs the new row's id. Its Undo answers removedId,
  // which `send` already takes off the list.
  const add = useCallback(async (vehicleId: string) => (await withSubmitLock('bay:add', async () => {
    const r = await postLotSignedIn({ action: 'bayAdd', vehicleId, by });
    if (!r.ok) return { error: r.error ?? 'The car did not go on the list. Try again.' };
    const row = r.json.row as BayLogRow;
    setRows(prev => [...prev.filter(x => x.id !== row.id), row].sort((a, b) => a.started_at.localeCompare(b.started_at)));
    return { id: row.id };
  })) ?? null, [by]);
  const undoAdd = useCallback((id: number) => send({ action: 'bayAddUndo', id }), [send]);
  // Answers removedId, which `send` takes off the list. Locked like an exit: it settles the same row.
  const remove = useCallback(async (id: number) =>
    (await withSubmitLock(`bay:exit:${id}`, () => send({ action: 'bayRemove', id }))) ?? null, [send]);

  // Never through `send`: that adds whatever row comes back, and a note on an EARLIER day's row must not land on today's
  // list. Here a saved row only replaces one today's list already holds.
  const editRow = useCallback<BayLogState['editRow']>(async body => {
    const r = await postLotSignedIn({ ...body, by });
    if (!r.ok) return { error: r.error ?? 'That did not save. Try again.' };
    const row = r.json.row as BayLogRow;
    setRows(prev => prev.map(x => (x.id === row.id ? row : x)));
    return { row };
  }, [by]);

  return { rows, loaded, error, start, exit, undoExit, bump, add, undoAdd, remove, nextIssue, editRow };
}
