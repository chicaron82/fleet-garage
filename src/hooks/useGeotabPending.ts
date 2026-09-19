// The Geotab install watchlist check, for the client scan surfaces (My Day scan-router + Airport
// Flip). A plate on the list must be HELD until a Geotab telematics unit is installed — the same
// condition Effie surfaces server-side (api/_lib/effie/vehicleExecutors → isGeotabPending). Until now that
// check lived ONLY in Effie's lookup, so a geotab-pending car scanned at either visual scanner
// read as clear. This exposes the same query (geotab_watchlist, MB-corrected plate, not yet
// installed) to the client so the scanners catch it too. RLS-scoped client — reads what the crew
// can read (trusted-crew allow-all).
import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { plateCandidates } from '../../api/_lib/platePrefix';

/** Returns a checker: given a scanned plate, resolves true when it's on the Geotab install
 *  watchlist and NOT yet installed (still pending → hold until installed). */
export function useGeotabPending() {
  return useCallback(async (rawPlate: string): Promise<boolean> => {
    // ⭐ Raw first, then the correction (ticket-plate-correction-resolves-first).
    const candidates = plateCandidates(rawPlate);
    if (candidates.length === 0) return false;
    const { data } = await supabase
      .from('geotab_watchlist')
      .select('plate')
      .in('plate', candidates)
      .is('installed_at', null);
    return (data ?? []).length > 0;
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
  // ⚠️⚠️ THIS ONE WRITES, SO IT LOOKS BEFORE IT STAMPS. It used to stamp the CORRECTED plate blind, so a
  // plate the corrector rewrote into another watchlist entry would have marked the WRONG car installed
  // and left the real one pending forever. Now: find which candidate is actually pending — the plate
  // as given wins over its correction — and stamp exactly that row, or nothing.
  // (2026-09-19, docs/ticket-plate-correction-resolves-first.md)
  const candidates = plateCandidates(rawPlate);
  if (candidates.length === 0) return;
  const { data } = await supabase
    .from('geotab_watchlist')
    .select('plate')
    .in('plate', candidates)
    .is('installed_at', null);
  const pending = new Set((data ?? []).map(r => String(r.plate)));
  const plate = candidates.find(c => pending.has(c));
  if (!plate) return;
  await supabase
    .from('geotab_watchlist')
    .update({ installed_at: new Date().toISOString(), installed_by: userId })
    .eq('plate', plate)
    .is('installed_at', null);
}
