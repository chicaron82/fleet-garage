// Lot Lookout, Erin St, write side: +1 / −1 on cleans ready, and the typed dirty count, sent through api/lot.ts.
// Same promise as the airport board: the number changes at once, and if the save fails it goes back and says so.
//
// A −1 within 5 s of this phone's own +1 is a slip being fixed, not a clean being used (isCleansFix).
import { useCallback, useRef } from 'react';
import { bayFromRow, isCleansFix, usedToday, type BayRow } from '../lib/lotBay';
import { businessDateOf } from '../lib/shiftDay';
import type { LotBayState } from './useLotBay';
import { postLot, useLotPin } from './useLotPin';

export function useBayTaps(state: LotBayState, toast: (msg: string) => void) {
  const { pin, by, setBy, unlock, forgetPin, fail } = useLotPin(toast);
  const lastPlusAt = useRef<number | null>(null);

  const tapCleans = useCallback(async (delta: 1 | -1) => {
    const before = state.bay;
    if (!before) return;
    if (delta === -1 && before.cleans === 0) { toast('Already at 0 cleans'); return; }
    const now = Date.now();
    const fix = delta === -1 && isCleansFix(lastPlusAt.current, now);
    lastPlusAt.current = delta === 1 ? now : null;
    const who = by || 'Lot';
    const at = new Date(now).toISOString();
    const used = usedToday(before, now) + (delta === -1 && !fix ? 1 : 0);
    state.setBay({ ...before, cleans: before.cleans + delta, cleansBy: who, cleansAt: at,
      ...(delta === -1 && !fix ? { used, usedOn: businessDateOf(new Date(now)) } : {}) });
    const r = await postLot({ pin, action: 'cleans', delta, fix, by: who });
    if (!r.ok) { state.setBay(before); lastPlusAt.current = null; fail(r); return; }
    const saved = bayFromRow(r.json.bay as BayRow);
    state.setBay(saved);
    toast(delta === 1 ? `${saved.cleans} ready · −1 within 5 s fixes a slip`
      : fix ? `Fixed · back to ${saved.cleans}, not counted as used`
      : `${saved.cleans} ready · ${usedToday(saved, now)} used today`);
  }, [state, by, pin, fail, toast]);

  /** Returns true when the count saved, so the box can clear. */
  const setDirties = useCallback(async (count: number): Promise<boolean> => {
    const before = state.bay;
    if (!before) return false;
    const who = by || 'Lot';
    state.setBay({ ...before, dirties: count, dirtiesBy: who, dirtiesAt: new Date().toISOString() });
    const r = await postLot({ pin, action: 'dirties', count, by: who });
    if (!r.ok) { state.setBay(before); fail(r); return false; }
    state.setBay(bayFromRow(r.json.bay as BayRow));
    toast(`Dirties: ${count}`);
    return true;
  }, [state, by, pin, fail, toast]);

  return { pin, by, setBy, unlock, forgetPin, tapCleans, setDirties };
}
