// Lot Lookout: the one way to send a write to api/lot.ts (the only writer, migration 151), for a signed-in FG session.
// ⭐ The file kept its name from when it also held the shared PIN, for the drivers' airport page (retired 2026-10-29)
// and the /lot/erin count page (retired 2026-11-05: *"It's unused and just keeping the read-only"*). The PIN went with
// them: FG's session is the only door now.
import { supabase } from '../lib/supabase';
import { isNetworkBlip } from '../lib/networkBlip';

export interface LotPost { ok: boolean; status: number; error?: string; json: Record<string, unknown> }

/** `token`: the signed-in FG session, api/lot.ts's only door. */
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

/** The FG door: the signed-in session (the Erin pill, the bay log, the crew line). */
export async function postLotSignedIn(body: Record<string, unknown>): Promise<LotPost> {
  const { data, error } = await supabase.auth.getSession().catch((e: unknown) => ({ data: { session: null }, error: e }));
  const token = data.session?.access_token;
  // ⚠️ NO TOKEN WITH NO SIGNAL IS NOT A WRONG SIGN-IN (Reflection 87, 2026-10-18). A session that needs its hourly
  // refresh can't get one offline, so there is no token; answering 401 made the airport queue DROP every waiting tap,
  // in the one place the queue exists for (the parkade). Offline, or a refresh that failed on the network, answers like
  // no signal (status 0): the taps wait, and the next try has signal to refresh with.
  if (!token) {
    const offline = (typeof navigator !== 'undefined' && navigator.onLine === false) || isNetworkBlip(error);
    return offline
      ? { ok: false, status: 0, error: 'No signal. The tap did not save.', json: {} }
      : { ok: false, status: 401, error: 'Sign in to FG again.', json: {} };
  }
  return postLot(body, token);
}
