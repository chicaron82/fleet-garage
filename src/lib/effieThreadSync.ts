// Cross-device continuity for Effie's chat thread (docs/ticket-effie-thread-cross-device.md).
// effieThread.ts keeps the localStorage layer as the instant/offline fast-path cache; THIS adds
// Supabase as the SHARED source of truth, so a thread started on one device is picked up on the
// next (sequential handoff — start at home, continue on the phone at work, settle in back home).
// Mirrors the user_preferences pattern (migration 015): localStorage for speed/offline, server for
// cross-device. Text turns only — the same packed { at, messages } wrapper + 12h TTL are reused, so
// a stale thread doesn't resurface no matter which layer it came from.
import { supabase, writeWithRefresh } from './supabase';
import { packThread, unpackWrapped, unpackWrappedStamped, type StoredMessage, type StampedThread } from './effieThread';

interface Wrapped { at: number; messages: StoredMessage[]; }

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/** The signed-in user's server-stored thread — null if none, stale (>12h), or unreachable
 *  (offline / not signed in). The caller falls back to the localStorage cache. */
export async function loadServerThread(): Promise<StoredMessage[] | null> {
  try {
    const uid = await currentUserId();
    if (!uid) return null;
    const { data, error } = await supabase
      .from('effie_threads')
      .select('thread')
      .eq('user_id', uid)
      .maybeSingle();
    if (error || !data) return null;
    return unpackWrapped(data.thread as unknown as Partial<Wrapped>, Date.now());
  } catch {
    return null;
  }
}

/** Like loadServerThread but keeps the `at` — the mount + focus-rehydrate layers compare it against
 *  the on-screen thread's `at` to decide whether to adopt (live-sync). */
export async function loadServerThreadStamped(): Promise<StampedThread | null> {
  try {
    const uid = await currentUserId();
    if (!uid) return null;
    const { data, error } = await supabase
      .from('effie_threads')
      .select('thread')
      .eq('user_id', uid)
      .maybeSingle();
    if (error || !data) return null;
    return unpackWrappedStamped(data.thread as unknown as Partial<Wrapped>, Date.now());
  } catch {
    return null;
  }
}

/** Upsert the thread to the server (best-effort — localStorage remains the offline cache, so a
 *  failed sync never loses the chat). An emptied thread deletes the row, so clearing the chat on
 *  one device clears it everywhere. */
export async function saveServerThread(messages: StoredMessage[], at: number = Date.now()): Promise<void> {
  try {
    const uid = await currentUserId();
    if (!uid) return;
    const wrapped = JSON.parse(packThread(messages, at)) as Wrapped;
    if (wrapped.messages.length === 0) {
      await writeWithRefresh(() => supabase.from('effie_threads').delete().eq('user_id', uid));
      return;
    }
    await writeWithRefresh(() => supabase.from('effie_threads').upsert(
      { user_id: uid, thread: wrapped as unknown as never, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    ));
  } catch {
    /* offline / transient — the localStorage cache still holds the thread */
  }
}
