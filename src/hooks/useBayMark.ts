// What Find a car says about a car the bay marked M or B and nobody flagged yet (2026-11-03, the one-tap hold exit;
// docs/ticket-bay-on-deck-trip-clean-quick-holds.md). Read once per car: the car's LATEST finished bay row, against the
// holds FG already has live, so flagging the hold clears the line on the spot. Null while loading, for a car with no bay
// row, and for anything that fails to read: the status line FG would show anyway stands.
import { useEffect, useState } from 'react';
import { useVehicleHoldContext } from '../context/VehicleHoldContext';
import { supabase } from '../lib/supabase';
import { bayMarkOf, type BayLogRow, type BayMark } from '../lib/lotBayLog';
import { shiftDateStr } from '../lib/shiftDay';

type LastRow = Pick<BayLogRow, 'vehicle_id' | 'exit' | 'started_at' | 'exited_at' | 'hold_id' | 'shift_day'>;

export function useBayMark(vehicleId: string | null | undefined): BayMark | null {
  const { holds } = useVehicleHoldContext();
  const [last, setLast] = useState<{ id: string; row: LastRow | null } | null>(null);

  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;
    void Promise.resolve(
      supabase.from('lot_bay_log').select('vehicle_id, exit, started_at, exited_at, hold_id, shift_day').eq('vehicle_id', vehicleId)
        .not('exited_at', 'is', null).order('exited_at', { ascending: false }).limit(1),
    ).then(({ data, error }) => {
      if (!cancelled) setLast({ id: vehicleId, row: error ? null : ((data?.[0] as LastRow | undefined) ?? null) });
    }).catch(() => { if (!cancelled) setLast({ id: vehicleId, row: null }); });
    return () => { cancelled = true; };
  }, [vehicleId]);

  // A row read for the car before this one never speaks for this one.
  if (!vehicleId || last?.id !== vehicleId) return null;
  return bayMarkOf(last.row, holds, shiftDateStr());
}
