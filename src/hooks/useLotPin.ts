// Lot Lookout: the PIN and initials this phone remembers, and the one way to send a write (api/lot.ts, the only
// writer — migration 151). Shared by the airport board's taps (useLotTaps) and Erin St's count (useBayTaps), so
// one PIN and one set of initials cover both pages on a phone.
import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';

const PIN_KEY = 'lot_pin';
const BY_KEY = 'lot_by';

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

  const setBy = useCallback((v: string) => { const t = v.toUpperCase().slice(0, 3); setByState(t); writeLocal(BY_KEY, t); }, []);
  const forgetPin = useCallback(() => { setPinState(''); writeLocal(PIN_KEY, ''); }, []);

  /** Try a PIN against the server before remembering it. */
  const unlock = useCallback(async (tryPin: string): Promise<string | null> => {
    const r = await postLot({ pin: tryPin, action: 'check' });
    if (!r.ok) return r.error ?? 'That PIN is not right.';
    setPinState(tryPin);
    writeLocal(PIN_KEY, tryPin);
    return null;
  }, []);

  /** A failed write: a wrong PIN is forgotten so the page asks again; every failure is said out loud. */
  const fail = useCallback((r: { status: number; error?: string }) => {
    if (r.status === 401) forgetPin();
    toast(r.error ?? 'The tap did not save.');
  }, [forgetPin, toast]);

  return { pin, by, setBy, unlock, forgetPin, fail };
}
