// Lot Lookout, Erin St, write side: +1 / −1 on cleans ready, and the typed dirty count, sent through api/lot.ts.
// Same promise as the airport board: the number changes at once, and if the save fails it goes back and says so.
//
// A −1 within 5 s of this phone's own +1 is a slip being fixed, not a clean being used (isCleansFix).
//
// Two ways in, one writer: the public /lot/erin page sends the shared PIN (useBayTaps); FG's My Day card sends the
// signed-in FG session instead (useBayTapsSignedIn — Aaron, 2026-10-15: *"May I suggest adding the cleans steppers
// here and tap to update the dirties?"*).
import { useCallback, useRef } from 'react';
import { bayFromRow, isCleansFix, usedToday, type BayRow } from '../lib/lotBay';
import { businessDateOf } from '../lib/shiftDay';
import type { LotBayState } from './useLotBay';
import { postLot, postLotSignedIn, useLotPin, type LotPost } from './useLotPin';

type Send = (body: Record<string, unknown>) => Promise<LotPost>;

function useBayWriter(state: LotBayState, toast: (msg: string) => void, send: Send, by: string, fail: (r: LotPost) => void) {
  const lastPlusAt = useRef<number | null>(null);

  const tapCleans = useCallback(async (delta: 1 | -1) => {
    const before = state.bay;
    if (!before) return;
    if (delta === -1 && before.cleans === 0) { toast('Already at 0 cleans'); return; }
    const now = Date.now();
    const fix = delta === -1 && isCleansFix(lastPlusAt.current, now);
    lastPlusAt.current = delta === 1 ? now : null;
    const at = new Date(now).toISOString();
    const used = usedToday(before, now) + (delta === -1 && !fix ? 1 : 0);
    state.setBay({ ...before, cleans: before.cleans + delta, cleansBy: by, cleansAt: at,
      ...(delta === -1 && !fix ? { used, usedOn: businessDateOf(new Date(now)) } : {}) });
    const r = await send({ action: 'cleans', delta, fix, by });
    if (!r.ok) { state.setBay(before); lastPlusAt.current = null; fail(r); return; }
    const saved = bayFromRow(r.json.bay as BayRow);
    state.setBay(saved);
    toast(delta === 1 ? `${saved.cleans} ready · −1 within 5 s fixes a slip`
      : fix ? `Fixed · back to ${saved.cleans}, not counted as used`
      : `${saved.cleans} ready · ${usedToday(saved, now)} used today`);
  }, [state, by, send, fail, toast]);

  /** Returns true when the count saved, so the box can clear. */
  const setDirties = useCallback(async (count: number): Promise<boolean> => {
    const before = state.bay;
    if (!before) return false;
    state.setBay({ ...before, dirties: count, dirtiesBy: by, dirtiesAt: new Date().toISOString() });
    const r = await send({ action: 'dirties', count, by });
    if (!r.ok) { state.setBay(before); fail(r); return false; }
    state.setBay(bayFromRow(r.json.bay as BayRow));
    toast(`Dirties: ${count}`);
    return true;
  }, [state, by, send, fail, toast]);

  return { tapCleans, setDirties };
}

/** The public /lot/erin page: the shared PIN and the initials this phone remembers. */
export function useBayTaps(state: LotBayState, toast: (msg: string) => void) {
  const { pin, by, setBy, unlock, forgetPin, fail } = useLotPin(toast);
  const send = useCallback<Send>(body => postLot({ pin, ...body }), [pin]);
  const writer = useBayWriter(state, toast, send, by || 'Lot', fail);
  return { pin, by, setBy, unlock, forgetPin, ...writer };
}

/** FG's own My Day card: the signed-in session stands in for the PIN; `by` comes from the FG account. */
export function useBayTapsSignedIn(state: LotBayState, toast: (msg: string) => void, by: string) {
  const fail = useCallback((r: LotPost) => toast(r.error ?? 'The tap did not save.'), [toast]);
  return useBayWriter(state, toast, postLotSignedIn, by || 'FG', fail);
}
