import { supabase, writeWithRefresh } from './supabase';
import { enqueueOfflineAction } from './offlineQueue';
import type { Database } from '../types/database.types';

type VsaTripInsert = Database['public']['Tables']['vsa_trips']['Insert'];
type VsaTripUpdate = Database['public']['Tables']['vsa_trips']['Update'];

/**
 * Attempts a Supabase write to `vsa_trips`; falls back to the offline queue on
 * network errors. Returns { ok: true } on success (online or queued), or
 * { ok: false } on a real (non-network) failure.
 *
 * Shared by the VSA trip Write-First handlers (useDriverLiveTrip.handleStart,
 * TripStartForm.handleStartTripWith) — see ARCHITECTURE.md. The architecture
 * regression suite recognizes `await writeOrEnqueue('insert', ...)` as a valid
 * write-first call, so keep this awaited before any live-state setter.
 */
export async function writeOrEnqueue(
  action: 'insert' | 'update',
  payload: Record<string, unknown>,
  eqField?: string,
  eqValue?: string,
): Promise<{ ok: boolean }> {
  if (!navigator.onLine) {
    enqueueOfflineAction({ table: 'vsa_trips', action, payload, eqField, eqValue });
    return { ok: true };
  }
  const res = action === 'insert'
    ? await writeWithRefresh(() => supabase.from('vsa_trips').insert(payload as unknown as VsaTripInsert))
    : await writeWithRefresh(() => {
        let q = supabase.from('vsa_trips').update(payload as unknown as VsaTripUpdate);
        if (eqField && eqValue !== undefined) q = q.eq(eqField, eqValue);
        return q;
      });
  if (!res.error) return { ok: true };
  const isNetworkErr = !navigator.onLine || res.error.message?.includes('Fetch') || !res.error.code;
  if (isNetworkErr) {
    enqueueOfflineAction({ table: 'vsa_trips', action, payload, eqField, eqValue });
    return { ok: true };
  }
  return { ok: false };
}
