// The Geotab install watchlist check, for the client scan surfaces (My Day scan-router + Airport
// Flip). A plate on the list must be HELD until a Geotab telematics unit is installed — the same
// condition Effie surfaces server-side (api/_lib/effieExecutors → isGeotabPending). Until now that
// check lived ONLY in Effie's lookup, so a geotab-pending car scanned at either visual scanner
// read as clear. This exposes the same query (geotab_watchlist, MB-corrected plate, not yet
// installed) to the client so the scanners catch it too. RLS-scoped client — reads what the crew
// can read (trusted-crew allow-all).
import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { correctManitobaPrefix } from '../../api/_lib/platePrefix';

/** Returns a checker: given a scanned plate, resolves true when it's on the Geotab install
 *  watchlist and NOT yet installed (still pending → hold until installed). */
export function useGeotabPending() {
  return useCallback(async (rawPlate: string): Promise<boolean> => {
    const plate = correctManitobaPrefix(rawPlate);
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
