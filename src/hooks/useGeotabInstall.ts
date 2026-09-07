import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * When the geotab was installed on this car, and by whom.
 *
 * ⚠️ WHY THIS EXISTS (2026-09-07). Aaron, looking at `LZM553`: *"is it a geotab car, did it get
 * cleared off the list? if so shouldn't it read somewhere that it was marked as installed on x date
 * rather than hiding under 'no action needed' with no date attached?"*
 *
 * FG knew. `geotab_watchlist` held **added 2026-07-10 · installed_at 2026-07-28 · installed_by
 * Aaron** the whole time. ⭐⭐ But the ONLY reader of that table in the entire codebase was
 * `useGeotabPending`, which builds the list of cars still WAITING for an install — so the instant a
 * car is done it drops off that list and its install date becomes unreachable from every screen.
 * **The fact survived; its audience did not.** Tenth instance in two days of knowledge existing and
 * having nowhere to arrive.
 *
 * ⚠️ KEYED BY PLATE, because that is the table's own key — it has no `vehicle_id` column. A geotab
 * car's FG id is synthetic (`geotab-veh-LZM553`), so plate is the only join either side agrees on.
 *
 * Returns null while loading AND when the car was never on the watchlist — a car that never needed
 * a geotab is not a car with a missing install date, and the caller must render nothing for both.
 */
export interface GeotabInstall {
  addedAt: string;
  /** null = still pending. The caller shows "waiting" rather than a date. */
  installedAt: string | null;
  installedBy: string | null;
}

export function useGeotabInstall(plate: string | null | undefined): GeotabInstall | null {
  /**
   * ⭐ THE PLATE IS STORED WITH THE ROW, and that is the whole staleness guard.
   *
   * ⚠️ The first version cleared state synchronously when the plate changed, which the
   * `set-state-in-effect` rule rejects — correctly. Keying the fetched row to the plate it came
   * from is better than the reset it replaced: the value is DERIVED from whether the stored plate
   * still matches the requested one, so one car's install date can never paint onto another's
   * record, not even for the frame between navigating and the next fetch resolving.
   */
  const [state, setState] = useState<{ plate: string; row: GeotabInstall | null } | null>(null);
  const want = plate?.trim().toUpperCase() ?? '';

  useEffect(() => {
    if (!want) return;
    let live = true;
    void supabase
      .from('geotab_watchlist')
      .select('added_at, installed_at, installed_by')
      .eq('plate', want)
      .maybeSingle()
      .then(({ data }) => {
        if (!live) return;
        setState({
          plate: want,
          row: data ? {
            addedAt: data.added_at as string,
            installedAt: (data.installed_at as string | null) ?? null,
            installedBy: (data.installed_by as string | null) ?? null,
          } : null,
        });
      });
    return () => { live = false; };
  }, [want]);

  // Null while loading, on a plateless render, AND when the car was never on the watchlist — a car
  // that never needed a geotab is not a car with a missing install date. The caller renders nothing
  // for all three, which is correct for all three.
  return state && state.plate === want ? state.row : null;
}
