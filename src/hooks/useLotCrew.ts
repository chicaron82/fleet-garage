// Lot Lookout crew: today's crew from GET /api/lot, refreshed every minute (shift windows open and close on their
// own) and when the phone wakes. `signedIn` sends the FG session, which is what gets names back; without it the page
// gets numbers only (the read-only /lot/view). Since 2026-10-24 the crew is the schedule: nothing here marks anyone.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { CrewPayload } from '../lib/lotCrew';
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

/** The last answer, per door, for as long as the app is open: IN MEMORY ONLY, never on the phone (it holds names).
 *  ⭐ Aaron, 2026-10-18 17:00: each screen remounted and fetched the crew afresh, so it flickered for a second; now it
 *  starts from what the app already knew, and the fetch only confirms it. */
const lastCrew = new Map<boolean, CrewPayload>();

export function useLotCrew({ signedIn = false }: { signedIn?: boolean } = {}) {
  const [crew, setCrewState] = useState<CrewPayload | null>(() => lastCrew.get(signedIn) ?? null);
  const setCrew = useCallback((c: CrewPayload) => { lastCrew.set(signedIn, c); setCrewState(c); }, [signedIn]);

  useEffect(() => {
    let cancelled = false;
    const read = () => { void fetchCrew(signedIn).then(c => { if (!cancelled && c) setCrew(c); }); };
    read();
    const tick = setInterval(read, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') read(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; clearInterval(tick); document.removeEventListener('visibilitychange', onVisible); };
  }, [signedIn, setCrew]);

  /** Leave someone off the crew line, or bring them back (migration 155). Remembered across days. */
  const leaveOff = useCallback(async (user: string, off: boolean, by: string): Promise<string | null> => {
    const token = await sessionToken();
    if (!token) return 'Sign in to FG again.';
    const r = await postLot({ action: 'leaveOff', user, off, by }, token);
    if (!r.ok) return r.error ?? 'That did not save.';
    setCrew(r.json.crew as CrewPayload);
    return null;
  }, [setCrew]);

  return { crew, leaveOff, loaded: crew != null };
}
