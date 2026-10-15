// Lot Lookout, write side, for the public /lot page: the PIN and initials this phone remembers, and every tap
// sent through api/lot.ts (the only writer — migration 151). Shows the tap at once, then puts it back and says
// so if the save fails: a board that silently disagrees with the lot is worse than no board.
import { useCallback, useRef, useState } from 'react';
import { resolveTap, type LastTap, type LotState } from '../lib/lotLookout';
import type { LotBoard } from './useLotBoard';

const PIN_KEY = 'lot_pin';
const BY_KEY = 'lot_by';

function readLocal(key: string): string {
  try { return localStorage.getItem(key) ?? ''; } catch { return ''; }
}
function writeLocal(key: string, value: string): void {
  try { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key); } catch { /* private mode: the phone just asks again */ }
}

async function post(body: Record<string, unknown>): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const res = await fetch('/api/lot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: res.ok, status: res.status, error: json.error };
  } catch {
    return { ok: false, status: 0, error: 'No signal. The tap did not save.' };
  }
}

export function useLotTaps(board: LotBoard, toast: (msg: string) => void) {
  const [pin, setPinState] = useState(() => readLocal(PIN_KEY));
  const [by, setByState] = useState(() => readLocal(BY_KEY));
  const lastTap = useRef<LastTap | null>(null);

  const setBy = useCallback((v: string) => { const t = v.toUpperCase().slice(0, 3); setByState(t); writeLocal(BY_KEY, t); }, []);
  const forgetPin = useCallback(() => { setPinState(''); writeLocal(PIN_KEY, ''); }, []);

  /** Try a PIN against the server before remembering it. */
  const unlock = useCallback(async (tryPin: string): Promise<string | null> => {
    const r = await post({ pin: tryPin, action: 'check' });
    if (!r.ok) return r.error ?? 'That PIN is not right.';
    setPinState(tryPin);
    writeLocal(PIN_KEY, tryPin);
    return null;
  }, []);

  const fail = useCallback((r: { status: number; error?: string }) => {
    if (r.status === 401) forgetPin();
    toast(r.error ?? 'The tap did not save.');
  }, [forgetPin, toast]);

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
      const r = await post({ pin, action: 'undo', stall, prev: { state: prev.state, by: prev.tappedBy, at: prev.tappedAt }, by: who });
      if (!r.ok) { board.patchStall(stall, { state: tapped, tappedBy: who, tappedAt: new Date(now).toISOString() }); fail(r); return; }
      toast(`Undone · ${stall} back to ${prev.state ?? 'not looked at'}`);
      return;
    }
    const { state } = action;
    const prev = { state: s.state, tappedBy: s.tappedBy, tappedAt: s.tappedAt };
    lastTap.current = { stall, state, atMs: now, prev };
    board.patchStall(stall, { state, tappedBy: who, tappedAt: new Date(now).toISOString() });
    const r = await post({ pin, action: 'stall', stall, state, by: who });
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
    const r = await post({ pin, action: 'aisle', delta, by: by || 'Lot' });
    if (!r.ok) { board.setAisle(before); fail(r); }
  }, [board, by, pin, fail]);

  return { pin, by, setBy, unlock, forgetPin, tapStall, tapAisle };
}
