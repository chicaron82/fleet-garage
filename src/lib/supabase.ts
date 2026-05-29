import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient<Database>(url, key, {
  auth: {
    // Disable navigator lock — avoids lock conflicts from React Strict Mode's double-mount
    lock:               (_name, _acquireTimeout, fn) => fn(),
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: false, // PWA — no OAuth redirects
  },
});

function isAuthError(error: unknown): boolean {
  if (!error) return false;
  const err = error as { status?: number; message?: string; code?: string };
  return (
    err.status === 401 ||
    err.code === 'PGRST301' ||
    err.message?.toLowerCase().includes('jwt') === true ||
    err.message?.toLowerCase().includes('not authenticated') === true ||
    err.message?.toLowerCase().includes('invalid token') === true
  );
}

/**
 * Wraps any Supabase write operation with a single auto-refresh retry on auth errors.
 * Use instead of calling supabase.from(...).insert/update/upsert/delete directly.
 * If the refresh token is also expired, the original error is returned and
 * onAuthStateChange emits SIGNED_OUT — the user is signed out cleanly.
 *
 * Accepts PromiseLike (not full Promise) so Supabase's PostgrestFilterBuilder
 * works without explicit awaiting before passing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function writeWithRefresh<R extends { data: any; error: any }>(
  operation: () => PromiseLike<R>
): Promise<R> {
  const result = await operation();
  if (!result.error || !isAuthError(result.error)) return result;
  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) return result;
  return operation();
}
