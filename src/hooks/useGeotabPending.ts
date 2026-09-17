// The Geotab install watchlist check, for the client scan surfaces (My Day scan-router + Airport
// Flip). A plate on the list must be HELD until a Geotab telematics unit is installed — the same
// condition Effie surfaces server-side (api/_lib/effie/vehicleExecutors → isGeotabPending). Until now that
// check lived ONLY in Effie's lookup, so a geotab-pending car scanned at either visual scanner
// read as clear. This exposes the same query (geotab_watchlist, MB-corrected plate, not yet
// installed) to the client so the scanners catch it too. RLS-scoped client — reads what the crew
// can read (trusted-crew allow-all).
import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { correctManitobaPlate } from '../../api/_lib/platePrefix';

/** Returns a checker: given a scanned plate, resolves true when it's on the Geotab install
 *  watchlist and NOT yet installed (still pending → hold until installed). */
export function useGeotabPending() {
  return useCallback(async (rawPlate: string): Promise<boolean> => {
    const plate = correctManitobaPlate(rawPlate);
    if (!plate) return false;
    const { data } = await supabase
      .from('geotab_watchlist')
      .select('plate')
      .eq('plate', plate)
      .is('installed_at', null)
      .maybeSingle();
    return !!data;
  }, []);
}

/**
 * ⭐⭐⭐ EVERY PENDING PLATE AT ONCE — the shield the auto-archive needs.
 *
 * The per-plate checker above answers "is THIS car pending?" at scan time. The Fleet view's
 * auto-archive needs the opposite shape: the whole set, before it decides anything, because on
 * 2026-09-16 it archived **10 of his 15 pending geotab cars** and he reported it as *"I think FG
 * archived my geotab watchlist."* Nothing was lost — the view simply drops archived vehicles.
 *
 * ⚠️⚠️ RETURNS null ON FAILURE, DELIBERATELY, AND THE CALLER MUST STAND DOWN ON null. An empty Set
 * and a failed query look identical to a filter, and "protect nothing" is exactly the bug. This is
 * the same discipline the effect already applies to `history.error`: a query that failed must never
 * read as "nothing matched".
 */
export async function fetchGeotabPendingPlates(): Promise<ReadonlySet<string> | null> {
  const { data, error } = await supabase
    .from('geotab_watchlist')
    .select('plate')
    .is('installed_at', null);
  if (error || !data) return null;
  return new Set(data.map(r => String(r.plate).trim().toUpperCase()));
}

/** Stamp a plate as installed on the geotab watchlist. Called from the geotab burn-off (the
 *  "✅ Geotab installed" action) alongside resolving the hold, so the watchlist table — and every
 *  reader of it (Effie's `isGeotabPending`, the scanner badge) — stays in lockstep with the resolved
 *  exception. Without this the two drift: the hold says done, the table still says pending. */
export async function markGeotabInstalled(rawPlate: string, userId: string): Promise<void> {
  const plate = correctManitobaPlate(rawPlate);
  if (!plate) return;
  await supabase
    .from('geotab_watchlist')
    .update({ installed_at: new Date().toISOString(), installed_by: userId })
    .eq('plate', plate)
    .is('installed_at', null);
}
