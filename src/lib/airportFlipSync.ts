// Cross-device continuity for the Airport Flip list (docs/July/ticket-flip-cross-device.md).
// useAirportFlip keeps localStorage as the instant/offline fast-path cache; THIS adds Supabase as the
// SHARED source of truth, so returns captured on the phone at the airport show up on the computer at
// home. Mirrors effieThreadSync (migration 096 → 108). Last-write-wins by the payload's `at` stamp —
// correct for one operator on sequential devices. Shift-day expiry still lives in the `day` stamp.
import { supabase, writeWithRefresh } from './supabase';
import { normalizeFlipRow, type FlipRow } from './airportFlip';

export interface ServerFlips { day: string; rows: FlipRow[]; at: number; }

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/** The signed-in user's server-stored flip payload — null if none/unreachable (offline / not signed
 *  in), so the caller falls back to the localStorage cache. Rows are healed to the current shape. */
export async function loadServerFlips(): Promise<ServerFlips | null> {
  try {
    const uid = await currentUserId();
    if (!uid) return null;
    const { data, error } = await supabase
      .from('airport_flips')
      .select('flips')
      .eq('user_id', uid)
      .maybeSingle();
    if (error || !data) return null;
    const p = data.flips as { day?: string; rows?: Partial<FlipRow>[]; at?: number };
    return { day: p.day ?? '', rows: (p.rows ?? []).map(normalizeFlipRow), at: p.at ?? 0 };
  } catch {
    return null;
  }
}

/** Upsert the flip list to the server (best-effort — localStorage remains the offline cache, so a
 *  failed sync never loses a flip). One row per user, keyed by user_id. */
export async function saveServerFlips(day: string, rows: FlipRow[], at: number): Promise<void> {
  try {
    const uid = await currentUserId();
    if (!uid) return;
    await writeWithRefresh(() => supabase.from('airport_flips').upsert(
      { user_id: uid, flips: { day, rows, at } as unknown as never, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    ));
  } catch {
    /* offline / transient — the localStorage cache still holds the list */
  }
}
