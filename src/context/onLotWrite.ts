import { supabase, writeWithRefresh } from '../lib/supabase';
import type { Vehicle } from '../types';
import { nextOnLotObservation, type OnLotObservation } from '../lib/onLotObservation';

/**
 * Records whether a held car was ON THE LOT, with the moment he looked (migration 142).
 *
 * ⭐ Aaron, 2026-09-12: *"if it's present on the lot tick the box. else unchecked its either been
 * rented out between my shifts or sent to the bodyshop."* FG cannot derive this — he is its only
 * writer and writes when a car reaches him, so an ACTIVE hold means "held when I last saw it", never
 * "held continuously since". LUR527 proved the cost: hail-flagged Sep 2, released for rent with no
 * release logged, 291 km driven, back on the 8th, and the only trace was the odometer moving under
 * an active hold.
 *
 * ⚠️ TAKES THE CURRENT OBSERVATION, not a target boolean — the one deliberate deviation from its
 * sibling `winterTiresWrite`. Winter tires are two-state so the caller can pass `!fitted`; this is
 * THREE-state (present / looked-and-absent / never looked), and the flip rule belongs in the tested
 * pure function rather than in a `!` inside JSX.
 *
 * ⚠️ Latest-wins and the timestamp ALWAYS moves, even when the state repeats: re-confirming a car is
 * still there is a new look, and the whole value of the field is the date on it.
 *
 * Returns false when nothing was written, so no caller can report a success that did not happen.
 */
export function makeRecordOnLot(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
}) {
  const { setAllVehicles } = deps;

  return async (vehicleId: string, current: OnLotObservation): Promise<boolean> => {
    const next = nextOnLotObservation(current);
    const { data, error } = await writeWithRefresh(() =>
      supabase.from('vehicles')
        .update({ on_lot_present: next.present, on_lot_checked_at: next.checkedAt })
        .eq('id', vehicleId)
        .select('id')
    );
    if (error || !data?.length) return false;
    setAllVehicles(prev => prev.map(v =>
      (v.id === vehicleId ? { ...v, onLotPresent: next.present, onLotCheckedAt: next.checkedAt } : v)));
    return true;
  };
}
