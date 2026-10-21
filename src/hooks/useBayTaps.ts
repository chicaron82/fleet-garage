// Lot Lookout, Erin St, write side: every change to the count, sent through api/lot.ts. Same promise as the airport
// board: the number changes at once, and if the save fails it goes back and says so.
//
// A −1 within 5 s of this phone's own +1 is a slip being fixed, not a clean being used (isCleansFix). It still works,
// it just stopped announcing itself: Aaron, 2026-10-16, *"i didn't quite understand the toast when i tapped quickly
// from 3 to 6"*. Every +1 used to say "−1 within 5 s fixes a slip". Now a note says the count, nothing else.
//
// The quick taps (2026-10-16, his layout for the Erin pill's sheet; ticket-lot-lookout-too-slow-on-the-fly.md): set,
// zero, drain, fill and dirties ±1. Set, zero, drain and fill hand the note an Undo, which puts the row back.
//
// Two ways in, one writer: the public /lot/erin page sends the shared PIN (useBayTaps); FG sends the signed-in
// session instead (useBayTapsSignedIn — Aaron, 2026-10-15: *"May I suggest adding the cleans steppers here"*).
import { useCallback, useRef } from 'react';
import { bayFromRow, isCleansFix, usedToday, type BayRow, type LotBay } from '../lib/lotBay';
import { businessDateOf } from '../lib/shiftDay';
import type { LotBayState } from './useLotBay';
import { postLot, postLotSignedIn, useLotPin, type LotPost } from './useLotPin';

type Send = (body: Record<string, unknown>) => Promise<LotPost>;
/** A note, and (for a quick tap) what its Undo does. Pages without an Undo just show the note. */
export type BayToast = (msg: string, undo?: () => void) => void;
export type BayField = 'cleans' | 'dirties';

function useBayWriter(state: LotBayState, toast: BayToast, send: Send, by: string, fail: (r: LotPost) => void) {
  const lastPlusAt = useRef<number | null>(null);
  const plusTookDirty = useRef(false);
  // Quick taps answer out of order over a bad signal; only the newest tap's answer may set the number.
  const seq = useRef(0);

  /** Show `next` at once, send `body`, keep the saved row. Returns the saved count, or null when it did not save. */
  const write = useCallback(async (body: Record<string, unknown>, next: (b: LotBay, at: string) => LotBay): Promise<LotBay | null> => {
    const before = state.bay;
    if (!before) return null;
    const mine = ++seq.current;
    state.setBay(next(before, new Date().toISOString()));
    const r = await send({ ...body, by });
    if (!r.ok) {
      if (mine === seq.current) state.setBay(before);
      fail(r);
      return null;
    }
    const saved = bayFromRow(r.json.bay as BayRow);
    if (mine === seq.current) state.setBay(saved);
    return saved;
  }, [state, by, send, fail]);

  /** An Undo for a quick tap: the row as it was before, for the count the tap changed. */
  const undoTo = useCallback((before: LotBay, field: BayField) => () => {
    const to = { cleans: before.cleans, dirties: before.dirties, used: before.used, usedOn: before.usedOn };
    void write({ action: 'bayUndo', field, to }, () => before).then(s => { if (s) toast('Undone'); });
  }, [write, toast]);

  const tapCleans = useCallback(async (delta: 1 | -1) => {
    const before = state.bay;
    if (!before) return;
    if (delta === -1 && before.cleans === 0) { toast('Already at 0 cleans'); return; }
    const now = Date.now();
    const fix = delta === -1 && isCleansFix(lastPlusAt.current, now);
    // A clean +1 takes a dirty (2026-10-21, ticket-erin-clean-plus-takes-a-dirty); the slip fix gives it back only if
    // that +1 really took one, so a fix never invents a dirty.
    const giveDirty = fix && plusTookDirty.current;
    lastPlusAt.current = delta === 1 ? now : null;
    plusTookDirty.current = false;
    const counted = delta === -1 && !fix;
    const dirtyMove = delta === 1 ? ((before.dirties ?? 0) > 0 ? -1 : 0) : giveDirty ? 1 : 0;
    const saved = await write({ action: 'cleans', delta, fix, giveDirty }, (b, at) => ({
      ...b, cleans: b.cleans + delta, cleansBy: by, cleansAt: at,
      ...(dirtyMove ? { dirties: (b.dirties ?? 0) + dirtyMove, dirtiesBy: by, dirtiesAt: at } : {}),
      ...(counted ? { used: usedToday(b, now) + 1, usedOn: businessDateOf(new Date(now)) } : {}),
    }));
    if (!saved) { lastPlusAt.current = null; return; }
    if (delta === 1) plusTookDirty.current = (saved.dirties ?? 0) < (before.dirties ?? 0);
    // Both numbers, so he sees the dirty moved without his touching it.
    toast(saved.dirties == null ? `${saved.cleans} cleans` : `${saved.cleans} cleans · ${saved.dirties} dirties`);
  }, [state, write, by, toast]);

  const stepDirties = useCallback(async (delta: 1 | -1) => {
    const before = state.bay;
    if (!before) return;
    if (delta === -1 && (before.dirties ?? 0) === 0) { toast('Already at 0 dirties'); return; }
    const saved = await write({ action: 'dirtiesStep', delta }, (b, at) => ({ ...b, dirties: (b.dirties ?? 0) + delta, dirtiesBy: by, dirtiesAt: at }));
    if (saved) toast(`${saved.dirties ?? 0} dirties`);
  }, [state, write, by, toast]);

  /** Type either count to what's on the lot (0 is the zero button). A correction: never counted as used. */
  const setCount = useCallback(async (field: BayField, count: number): Promise<boolean> => {
    const before = state.bay;
    if (!before) return false;
    const body = field === 'cleans' ? { action: 'cleansSet', count } : { action: 'dirties', count };
    const saved = await write(body, (b, at) => field === 'cleans'
      ? { ...b, cleans: count, cleansBy: by, cleansAt: at }
      : { ...b, dirties: count, dirtiesBy: by, dirtiesAt: at });
    if (!saved) return false;
    const was = field === 'cleans' ? before.cleans : before.dirties;
    toast(count === 0 && was ? `${field === 'cleans' ? 'Cleans' : 'Dirties'} zeroed (was ${was})` : `Set to ${count} ${field}`,
      undoTo(before, field));
    return true;
  }, [state, write, by, toast, undoTo]);

  /** Kept for the PIN page and the strip: the typed dirty count. */
  const setDirties = useCallback((count: number) => setCount('dirties', count), [setCount]);

  /** Cleans sent up with the `n` drivers on now. Counted as used; stops at 0. */
  const drain = useCallback(async (n: number) => {
    const before = state.bay;
    if (!before || n < 1) return;
    if (before.cleans === 0) { toast('No cleans to send up'); return; }
    const took = Math.min(n, before.cleans);
    const now = Date.now();
    const saved = await write({ action: 'drain', n }, (b, at) => ({
      ...b, cleans: b.cleans - took, cleansBy: by, cleansAt: at, used: usedToday(b, now) + took, usedOn: businessDateOf(new Date(now)),
    }));
    if (saved) toast(`Drained ${took}${took < n ? ` (only ${before.cleans} on the lot)` : ''} · ${saved.cleans} cleans`, undoTo(before, 'cleans'));
  }, [state, write, by, toast, undoTo]);

  /** The same drivers' dirties, back at the bay. */
  const fill = useCallback(async (n: number) => {
    const before = state.bay;
    if (!before || n < 1) return;
    const saved = await write({ action: 'fill', n }, (b, at) => ({ ...b, dirties: (b.dirties ?? 0) + n, dirtiesBy: by, dirtiesAt: at }));
    if (saved) toast(`Filled ${n} · ${saved.dirties ?? 0} dirties`, undoTo(before, 'dirties'));
  }, [state, write, by, toast, undoTo]);

  return { tapCleans, stepDirties, setCount, setDirties, drain, fill };
}

/** The public /lot/erin page: the shared PIN and the initials this phone remembers. */
export function useBayTaps(state: LotBayState, toast: BayToast) {
  const { pin, by, setBy, unlock, forgetPin, fail, pinWorked } = useLotPin(toast);
  // Any write that gets through proves a PIN taken on trust (Reflection 87): before, only an AIRPORT tap cleared it, so
  // a driver who only tapped Erin's count kept seeing "your PIN is checked when there is" on the airport page.
  const send = useCallback<Send>(async body => {
    const r = await postLot({ pin, ...body });
    if (r.ok) pinWorked();
    return r;
  }, [pin, pinWorked]);
  const writer = useBayWriter(state, toast, send, by || 'Lot', fail);
  return { pin, by, setBy, unlock, forgetPin, ...writer };
}

/** FG itself (the Erin pill, My Day's card, the module): the signed-in session stands in for the PIN. */
export function useBayTapsSignedIn(state: LotBayState, toast: BayToast, by: string) {
  const fail = useCallback((r: LotPost) => toast(r.error ?? 'The tap did not save.'), [toast]);
  return useBayWriter(state, toast, postLotSignedIn, by || 'FG', fail);
}
