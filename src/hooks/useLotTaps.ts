// Lot Lookout, write side, for the airport board: every tap sent through api/lot.ts (the only writer —
// migration 151). Shows the tap at once, then puts it back and says so if the save fails: a board that silently
// disagrees with the lot is worse than no board. The PIN and initials live in useLotPin.
//
// Two ways in, one writer, the same split as Erin St's count (useBayTaps): the public /lot page sends the shared PIN
// (useLotTaps); FG's Lot Lookout module sends the signed-in session (useLotTapsSignedIn — Aaron, 2026-10-15:
// *"What do you think of having lot outlook as an FG module?"*).
import { useCallback, useRef } from 'react';
import { resolveTap, type LastTap, type LotState } from '../lib/lotLookout';
import type { LotBoard } from './useLotBoard';
import { postLot, postLotSignedIn, useLotPin, type LotPost } from './useLotPin';

type Send = (body: Record<string, unknown>) => Promise<LotPost>;

function useStallWriter(board: LotBoard, toast: (msg: string) => void, send: Send, who: string, fail: (r: LotPost) => void) {
  const lastTap = useRef<LastTap | null>(null);

  const tapStall = useCallback(async (stall: string, tapped: LotState) => {
    const s = board.stalls.find(x => x.stall === stall);
    if (!s) return;
    const now = Date.now();
    const action = resolveTap(lastTap.current, stall, tapped, s.state, now);
    if (action.kind === 'undo') {
      const { prev } = lastTap.current!;
      lastTap.current = null;
      board.patchStall(stall, prev);
      const r = await send({ action: 'undo', stall, prev: { state: prev.state, by: prev.tappedBy, at: prev.tappedAt }, by: who });
      if (!r.ok) { board.patchStall(stall, { state: tapped, tappedBy: who, tappedAt: new Date(now).toISOString() }); fail(r); return; }
      toast(`Undone · ${stall} back to ${prev.state ?? 'not looked at'}`);
      return;
    }
    const { state } = action;
    const prev = { state: s.state, tappedBy: s.tappedBy, tappedAt: s.tappedAt };
    lastTap.current = { stall, state, atMs: now, prev };
    board.patchStall(stall, { state, tappedBy: who, tappedAt: new Date(now).toISOString() });
    const r = await send({ action: 'stall', stall, state, by: who });
    if (!r.ok) { board.patchStall(stall, prev); lastTap.current = null; fail(r); return; }
    const misparked = state === 'dirty' && s.run !== 'N';
    toast(prev.state === state ? `${stall} still ${state} · looked at now`
      : misparked ? `${stall} dirty · return in a clean stall`
      : state === 'taken' ? `${stall} taken · hold again to free it`
      : prev.state === 'taken' ? `${stall} open again` : `${stall} marked ${state} · tap again to undo`);
  }, [board, who, send, fail, toast]);

  const tapAisle = useCallback(async (delta: 1 | -1) => {
    const before = board.aisle;
    const cars = Math.max(0, before.cars + delta);
    board.setAisle({ cars, tappedBy: who, tappedAt: new Date().toISOString() });
    const r = await send({ action: 'aisle', delta, by: who });
    if (!r.ok) { board.setAisle(before); fail(r); }
  }, [board, who, send, fail]);

  return { tapStall, tapAisle };
}

/** The public /lot page: the shared PIN and the initials this phone remembers. */
export function useLotTaps(board: LotBoard, toast: (msg: string) => void) {
  const { pin, by, setBy, unlock, forgetPin, fail } = useLotPin(toast);
  const send = useCallback<Send>(body => postLot({ pin, ...body }), [pin]);
  const writer = useStallWriter(board, toast, send, by || 'Lot', fail);
  return { pin, by, setBy, unlock, forgetPin, ...writer };
}

/** FG's Lot Lookout module: the signed-in session stands in for the PIN; `by` comes from the FG account. */
export function useLotTapsSignedIn(board: LotBoard, toast: (msg: string) => void, by: string) {
  const fail = useCallback((r: LotPost) => toast(r.error ?? 'The tap did not save.'), [toast]);
  return useStallWriter(board, toast, postLotSignedIn, by || 'FG', fail);
}
