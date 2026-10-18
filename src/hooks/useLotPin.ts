// Lot Lookout: the PIN and initials this phone remembers, and the one way to send a write (api/lot.ts, the only
// writer — migration 151). Shared by the airport readings (useAirportTaps) and Erin St's count (useBayTaps), so
// one PIN and one set of initials cover both pages on a phone.
import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';

const PIN_KEY = 'lot_pin';
const BY_KEY = 'lot_by';
/** Set when the PIN was taken on trust with no signal (2026-10-18): checked by the first write that reaches the server. */
const UNCHECKED_KEY = 'lot_pin_unchecked';

function readLocal(key: string): string {
  try { return localStorage.getItem(key) ?? ''; } catch { return ''; }
}
function writeLocal(key: string, value: string): void {
  try { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key); } catch { /* private mode: the phone just asks again */ }
}

export interface LotPost { ok: boolean; status: number; error?: string; json: Record<string, unknown> }

/** `token`: a signed-in FG session, which api/lot.ts accepts in place of the PIN (FG's own My Day card). */
export async function postLot(body: Record<string, unknown>, token?: string): Promise<LotPost> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch('/api/lot', { method: 'POST', headers, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, error: typeof json.error === 'string' ? json.error : undefined, json };
  } catch {
    return { ok: false, status: 0, error: 'No signal. The tap did not save.', json: {} };
  }
}

/** The FG door: the signed-in session stands in for the PIN (My Day's card and the Lot Lookout module). */
export async function postLotSignedIn(body: Record<string, unknown>): Promise<LotPost> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, status: 401, error: 'Sign in to FG again.', json: {} };
  return postLot(body, token);
}

export function useLotPin(toast: (msg: string) => void) {
  const [pin, setPinState] = useState(() => readLocal(PIN_KEY));
  const [by, setByState] = useState(() => readLocal(BY_KEY));
  const [pinUnchecked, setUnchecked] = useState(() => readLocal(UNCHECKED_KEY) === '1');

  const setBy = useCallback((v: string) => { const t = v.toUpperCase().slice(0, 3); setByState(t); writeLocal(BY_KEY, t); }, []);
  const remember = useCallback((p: string, unchecked: boolean) => {
    setPinState(p); writeLocal(PIN_KEY, p);
    setUnchecked(unchecked); writeLocal(UNCHECKED_KEY, unchecked ? '1' : '');
  }, []);
  const forgetPin = useCallback(() => remember('', false), [remember]);
  /** A write reached the server with this PIN, so it is right. */
  const pinWorked = useCallback(() => { setUnchecked(false); writeLocal(UNCHECKED_KEY, ''); }, []);

  /** Try a PIN against the server before remembering it.
   *  ⭐ NO SIGNAL = TAKEN ON TRUST (Aaron, 2026-10-15, in the parkade: *"I couldn't log in with the pin while I was
   *  there earlier so couldn't tap anything ... logged in once I left"*). The phone keeps it as unchecked and lets the
   *  driver tap; the taps wait on the phone, and the first one that reaches the server checks it. A wrong PIN then
   *  answers 401: the PIN is forgotten, the waiting taps are dropped, and the page asks again. */
  const unlock = useCallback(async (tryPin: string): Promise<string | null> => {
    const r = await postLot({ pin: tryPin, action: 'check' });
    if (r.status === 0) { remember(tryPin, true); return null; }
    if (!r.ok) return r.error ?? 'That PIN is not right.';
    remember(tryPin, false);
    return null;
  }, [remember]);

  /** A failed write: a wrong PIN is forgotten so the page asks again; every failure is said out loud. */
  const fail = useCallback((r: { status: number; error?: string }) => {
    if (r.status === 401) forgetPin();
    toast(r.error ?? 'The tap did not save.');
  }, [forgetPin, toast]);

  return { pin, by, setBy, unlock, forgetPin, fail, pinUnchecked, pinWorked };
}
