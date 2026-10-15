// Lot Lookout, write side, for the public /lot page: every tap sent through api/lot.ts (the only writer —
// migration 151). Shows the tap at once, then puts it back and says so if the save fails: a board that silently
// disagrees with the lot is worse than no board. The PIN and initials live in useLotPin.
import { useCallback, useRef } from 'react';
import { resolveTap, type LastTap, type LotState } from '../lib/lotLookout';
import type { LotBoard } from './useLotBoard';
import { postLot, useLotPin } from './useLotPin';

export function useLotTaps(board: LotBoard, toast: (msg: string) => void) {
  const { pin, by, setBy, unlock, forgetPin, fail } = useLotPin(toast);
  const lastTap = useRef<LastTap | null>(null);

  const tapStall = useCallback(async (stall: string, tapped: LotState) => {
    const s = board.stalls.find(x => x.stall === stall);
    if (!s) return;
    const now = Date.now();
    const who = by || 'Lot';
    const action = resolveTap(lastTap.current, stall, tapped, s.state, now);
    if (action.kind === 'undo') {
      const { prev } = lastTap.current!;
      lastTap.current = null;
      board.patchStall(stall, prev);
      const r = await postLot({ pin, action: 'undo', stall, prev: { state: prev.state, by: prev.tappedBy, at: prev.tappedAt }, by: who });
      if (!r.ok) { board.patchStall(stall, { state: tapped, tappedBy: who, tappedAt: new Date(now).toISOString() }); fail(r); return; }
      toast(`Undone · ${stall} back to ${prev.state ?? 'not looked at'}`);
      return;
    }
    const { state } = action;
    const prev = { state: s.state, tappedBy: s.tappedBy, tappedAt: s.tappedAt };
    lastTap.current = { stall, state, atMs: now, prev };
    board.patchStall(stall, { state, tappedBy: who, tappedAt: new Date(now).toISOString() });
    const r = await postLot({ pin, action: 'stall', stall, state, by: who });
    if (!r.ok) { board.patchStall(stall, prev); lastTap.current = null; fail(r); return; }
    const misparked = state === 'dirty' && s.run !== 'N';
    toast(prev.state === state ? `${stall} still ${state} · looked at now`
      : misparked ? `${stall} dirty · return in a clean stall`
      : state === 'taken' ? `${stall} taken · hold again to free it`
      : prev.state === 'taken' ? `${stall} open again` : `${stall} marked ${state} · tap again to undo`);
  }, [board, by, pin, fail, toast]);

  const tapAisle = useCallback(async (delta: 1 | -1) => {
    const before = board.aisle;
    const cars = Math.max(0, before.cars + delta);
    board.setAisle({ cars, tappedBy: by || 'Lot', tappedAt: new Date().toISOString() });
    const r = await postLot({ pin, action: 'aisle', delta, by: by || 'Lot' });
    if (!r.ok) { board.setAisle(before); fail(r); }
  }, [board, by, pin, fail]);

  return { pin, by, setBy, unlock, forgetPin, tapStall, tapAisle };
}
