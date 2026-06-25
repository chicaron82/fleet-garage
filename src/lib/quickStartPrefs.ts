// Per-user quick-start ordering. Durable + cross-device via the profile row
// (`quick_start_order`), with localStorage as a device-local cache so the grid
// paints instantly and survives offline. The server is the source of truth: on
// mount the hook fetches the remote order and reconciles, so an arrangement made
// on one device shows up on the next. A saved order is the user's explicit
// arrangement from the customizer; absence (null) means "schedule-aware default".
import { supabase } from './supabase';

const storageKey = (userId: string) => `fg_quickstart_${userId}`;

// ── localStorage cache (instant first paint, offline fallback) ────────────────

/** Synchronous cache read — feeds the hook's lazy init so the grid paints with
 *  the last-known order before the server round-trip lands. */
export function loadQuickStartOrder(userId: string): string[] | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(userId: string, order: string[]): void {
  try { localStorage.setItem(storageKey(userId), JSON.stringify(order)); } catch { /* unavailable — server still holds it */ }
}

function clearCache(userId: string): void {
  try { localStorage.removeItem(storageKey(userId)); } catch { /* fail silently */ }
}

// ── Supabase (durable, cross-device source of truth) ──────────────────────────

/** Fetch the authoritative order from the profile, syncing the local cache to
 *  match. Throws on a real fetch error so the caller can keep the cached value
 *  (offline) rather than clobber it. */
export async function fetchRemoteOrder(userId: string): Promise<string[] | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('quick_start_order')
    .eq('id', userId)
    .single();
  if (error) throw error;
  const order = data?.quick_start_order ?? null;
  if (order && order.length) writeCache(userId, order);
  else clearCache(userId);
  return order;
}

/** Persist the user's arrangement: cache immediately for instant local echo,
 *  then write through to the profile so it follows them across devices. */
export async function saveQuickStartOrder(userId: string, order: string[]): Promise<void> {
  writeCache(userId, order);
  const { error } = await supabase
    .from('profiles')
    .update({ quick_start_order: order })
    .eq('id', userId);
  if (error) throw error;
}

/** Reset to the schedule-aware default everywhere — clear the cache and null the
 *  profile column. */
export async function clearQuickStartOrder(userId: string): Promise<void> {
  clearCache(userId);
  const { error } = await supabase
    .from('profiles')
    .update({ quick_start_order: null })
    .eq('id', userId);
  if (error) throw error;
}
