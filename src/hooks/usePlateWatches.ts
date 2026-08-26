import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { normalizeWatchPlate, type PlateWatch } from '../lib/plateWatch';

// Plates to stop on at scan time (migration 128) — including cars FG has no record of.
//
// Sibling to useGeotabPending, which asks the same SHAPE of question ("is this plate on a list?")
// for one specific reason: a Geotab unit isn't installed yet. This is the general form — a plate
// goes on the list for whatever reason a human writes, including a whiteboard note about a car FG
// has never seen. Kept separate rather than merged: the geotab list is maintained by an external
// process and cleared by an install, this one is his own board and cleared by his own tap.
//
// Loads the LIVE list once and keeps it in memory. It is small (usually zero or one), and the scan
// path must not wait on a round-trip to decide whether to shout.

interface Row {
  id: string; plate: string; reason: string;
  created_at: string; resolved_at: string | null;
}

const toWatch = (r: Row): PlateWatch => ({
  id: r.id, plate: r.plate, reason: r.reason,
  createdAt: r.created_at, resolvedAt: r.resolved_at,
});

export function usePlateWatches() {
  const [loaded, setLoaded] = useState<PlateWatch[] | null>(null);
  const [reloads, setReloads] = useState(0);

  // Same shape as useVehicleSightings: nothing set synchronously in the effect body
  // (react-hooks/set-state-in-effect), and a cancelled guard so a late response cannot paint a
  // board he has already changed. `reloads` is the re-fetch trigger — bumping it re-runs the
  // effect rather than having two code paths that write the same state.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from('plate_watches')
        .select('id, plate, reason, created_at, resolved_at')
        .is('resolved_at', null)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      setLoaded(((data ?? []) as Row[]).map(toWatch));
    }
    void load();
    return () => { cancelled = true; };
  }, [reloads]);

  const watches = loaded ?? [];
  const loading = loaded === null;
  const reload = useCallback(() => { setReloads(n => n + 1); }, []);

  /** Put a plate on the board. Returns false when it didn't land, so nothing can claim it did. */
  const addWatch = useCallback(async (rawPlate: string, reason: string): Promise<boolean> => {
    const plate = normalizeWatchPlate(rawPlate);
    if (!plate) return false;
    const { data: who } = await supabase.auth.getUser();
    const { error } = await supabase.from('plate_watches').insert({
      plate, reason: reason.trim(), created_by: who?.user?.id ?? null,
    });
    if (error) return false;
    reload();
    return true;
  }, [reload]);

  /** ⭐ Clearing is an EVENT, not a delete — a timestamp can be audited and undone, a missing row
   *  cannot say who acted or when. Same argument as holds.zones_reviewed_at. */
  const clearWatch = useCallback(async (id: string): Promise<boolean> => {
    const { data: who } = await supabase.auth.getUser();
    const { error } = await supabase.from('plate_watches')
      .update({ resolved_at: new Date().toISOString(), resolved_by: who?.user?.id ?? null })
      .eq('id', id);
    if (error) return false;
    reload();
    return true;
  }, [reload]);

  return { watches, loading, addWatch, clearWatch, reload };
}
