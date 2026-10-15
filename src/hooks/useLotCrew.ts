// Lot Lookout crew: today's crew from GET /api/lot, refreshed every minute (shift windows open and close on their
// own) and when the phone wakes. `signedIn` sends the FG session, which is what gets names back and lets `mark`
// change anyone's state; without it the page gets numbers only (the read-only /lot/view).
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { CrewPayload, CrewState } from '../lib/lotCrew';
import { postLot } from './useLotPin';

async function sessionToken(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

async function fetchCrew(signedIn: boolean): Promise<CrewPayload | null> {
  try {
    const token = signedIn ? await sessionToken() : undefined;
    const res = await fetch('/api/lot', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    return res.ok ? ((await res.json()) as CrewPayload) : null;
  } catch {
    return null;
  }
}

export function useLotCrew({ signedIn = false }: { signedIn?: boolean } = {}) {
  const [crew, setCrew] = useState<CrewPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    const read = () => { void fetchCrew(signedIn).then(c => { if (!cancelled && c) setCrew(c); }); };
    read();
    const tick = setInterval(read, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') read(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; clearInterval(tick); document.removeEventListener('visibilitychange', onVisible); };
  }, [signedIn]);

  /** Set (or clear back to the default) the state for these people. Returns an error to show, or null. */
  const mark = useCallback(async (users: string[], state: CrewState | 'clear', by: string): Promise<string | null> => {
    const token = await sessionToken();
    if (!token) return 'Sign in to FG again.';
    const r = await postLot({ action: 'crew', users, state, by }, token);
    if (!r.ok) return r.error ?? 'The crew did not save.';
    setCrew(r.json.crew as CrewPayload);
    return null;
  }, []);

  return { crew, mark };
}
