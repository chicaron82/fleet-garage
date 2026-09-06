// Cross-device continuity for the closing inventory sheet (docs/ticket-closing-inventory-sync.md).
//
// `useClosingInventory` keeps localStorage as the instant/offline fast-path cache; THIS adds
// Supabase as the SHARED source of truth, so 24 cars scanned on the phone at the yard are there when
// he opens FG on his PC at home. Aaron, 2026-09-06: *"these should be available. the value of FG is
// being able to use it on anything."*
//
// Mirrors airportFlipSync (migration 108 → 137) deliberately — same problem, and the flip's version
// is the one that already survived a real defect.
//
// ⚠️ Reconciliation is PER ROW (`mergeEntries`), not last-write-wins on the payload. The `at` stamp
// here is only a freshness hint; the merge never trusts it wholesale. Shift-day expiry still lives
// in the `day` stamp (cutover 04:00) — a stale-day payload reads as nothing.
import { supabase, writeWithRefresh } from './supabase';
import { normalizeEntry } from './closingInventoryStore';
import type { InventoryEntry } from './closingInventory';

export interface ServerSheet { day: string; entries: InventoryEntry[]; at: number; }

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/** The signed-in user's server-stored sheet — null if none/unreachable (offline / not signed in),
 *  so the caller falls back to the localStorage cache. Rows are healed to the current shape. */
export async function loadServerSheet(): Promise<ServerSheet | null> {
  try {
    const uid = await currentUserId();
    if (!uid) return null;
    const { data, error } = await supabase
      .from('closing_inventories')
      .select('sheet')
      .eq('user_id', uid)
      .maybeSingle();
    if (error || !data) return null;
    const p = data.sheet as { day?: string; entries?: Partial<InventoryEntry>[]; at?: number };
    return { day: p.day ?? '', entries: (p.entries ?? []).map(normalizeEntry), at: p.at ?? 0 };
  } catch {
    return null;
  }
}

/** Upsert the sheet to the server. Best-effort by design — localStorage remains the offline cache,
 *  so a failed sync can never cost him a scanned car. One row per user, keyed by user_id. */
export async function saveServerSheet(day: string, entries: InventoryEntry[], at: number): Promise<void> {
  try {
    const uid = await currentUserId();
    if (!uid) return;
    await writeWithRefresh(() => supabase.from('closing_inventories').upsert(
      { user_id: uid, sheet: { day, entries, at } as unknown as never, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    ));
  } catch {
    /* offline / transient — the localStorage cache still holds the sheet */
  }
}
