import { supabase, writeWithRefresh } from '../lib/supabase';
import { shouldReplaceOdometer } from '../lib/odometer';
import { commitSightingFor } from '../hooks/useVehicleSightings';
import type { Vehicle } from '../types';

/** Records the odometer the airport flip already collects (migrations/123).
 *
 *  ⭐ LATEST WINS — the deliberate opposite of classCodeWrite's first-good-read-wins. A class code
 *  never changes over a car's life, so an early reading is as true as a late one and a later scan
 *  must not clobber it. An odometer only ever moves FORWARD, so the newest reading is always the
 *  best one — and a LOWER number arriving later is a misread or the wrong car, never a fact
 *  (see lib/odometer.shouldReplaceOdometer).
 *
 *  The guard is restated server-side (`odometer.lt.N`) so two near-simultaneous flips can't have the
 *  older one land last. `or=(odometer.is.null,...)` covers the first reading.
 *
 *  Best-effort by contract: a failed write must never cost the flip that triggered it — the counter
 *  copy-out is the operator's actual job, and this is bookkeeping riding along behind it. */
export function makeRecordOdometer(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  currentOdometer: (vehicleId: string) => number | null | undefined;
}) {
  const { setAllVehicles, currentOdometer } = deps;

  return async (vehicleId: string, km: number): Promise<void> => {
    // ⭐ HE WAS AT THE CAR. Reading a dash is not a proxy for presence, it IS presence — you
    // cannot read an odometer from a desk. So a typed-plate lookup's held sighting is redeemed
    // here, BEFORE the value guard: whether the reading is new or matches what's on file, he still
    // walked up and read it. (No-op when nothing is held, so a scanned car — whose sighting was
    // already recorded at the read — can never be double-counted.) Aaron, 2026-08-28.
    commitSightingFor(vehicleId);
    if (!shouldReplaceOdometer(currentOdometer(vehicleId), km)) return;
    const at = new Date().toISOString();
    const { data, error } = await writeWithRefresh(() =>
      supabase
        .from('vehicles')
        .update({ odometer: km, odometer_at: at })
        .eq('id', vehicleId)
        .or(`odometer.is.null,odometer.lt.${km}`)
        .select('id')
    );
    if (error || !data?.length) return; // 0 rows = a higher reading already landed → don't diverge
    setAllVehicles(prev => prev.map(v => (v.id === vehicleId ? { ...v, odometer: km, odometerAt: at } : v)));
  };
}

/**
 * Clear a mis-typed odometer, returning the car to "not logged".
 *
 * ⚠️ THE GUARD ABOVE IS RIGHT ABOUT THE WORLD AND WRONG ABOUT THE USER, and this is the escape it
 * was missing. An odometer only ever moves forward — so `shouldReplaceOdometer` refuses a lower
 * number, correctly, because a lower READING is a misread or the wrong car. But a mis-typed ENTRY
 * needs to come down, and the guard cannot tell those apart: it treats "I typed this on the wrong
 * car" exactly as it treats "this car has fewer km than we thought".
 *
 * Aaron, 2026-08-26, mid-shift: *"I attached an odo reading to the wrong vehicle. how do I clear the
 * one I added to LUR195"* — and the honest answer was that he could not. LUR195 sat at 8,810 km,
 * uncorrectable, until I reached into the database for him.
 *
 * ⭐ A CLEAR RATHER THAN AN OVERRIDE, and that was his call. Letting him type any number would
 * weaken the backwards guard for genuine readings, which is the thing it is genuinely good at. This
 * keeps the guard intact and returns the field to unlogged, from which the next real reading lands
 * normally — one action, no new judgement, no weakened rule.
 *
 * `odometer_at` goes with it. A timestamp for a reading that no longer exists is worse than no
 * timestamp: it would render as "logged, at some point" over an empty value.
 */
export function makeClearOdometer(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
}) {
  const { setAllVehicles } = deps;

  return async (vehicleId: string): Promise<boolean> => {
    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({ odometer: null, odometer_at: null }).eq('id', vehicleId));
    // ⚠️ Reports whether it landed, so nothing upstream can show a cleared field that is still set
    // in the database — the R61/R62 lesson about a success message claiming a write that failed.
    if (error) return false;
    setAllVehicles(prev => prev.map(v => (v.id === vehicleId ? { ...v, odometer: null, odometerAt: null } : v)));
    return true;
  };
}

/**
 * Correct a reading that is already on file — the one write allowed to move an odometer DOWN.
 *
 * ⭐ WHY IT EXISTS (Aaron, 2026-09-01). `LFJ180` sat at 34,028 km while its dash read 28,921:
 * someone had read the TRIP METER (3402.8) and written it on a gas sheet without the decimal, and
 * FG took it as the car's first reading. Nothing caught it — `checkOdometerJump` has no baseline
 * on a first reading — and then `shouldReplaceOdometer` cemented it, because the only direction
 * that repairs a too-high number is the one direction the guard exists to refuse.
 *
 * ⚠️ THIS DOES NOT WEAKEN THAT GUARD, AND THAT WAS HIS RULING (2026-08-26): a free-typing override
 * *"would weaken the backwards guard for genuine readings, which is the thing it is genuinely good
 * at."* So the ordinary path is untouched — `recordOdometer` is still forward-only, a lower number
 * still reads as a suspected misread first, and reaching this function takes a SEPARATE, explicit
 * tap that says what it does. The guard did not learn to doubt itself; a second door was cut.
 *
 * ⚠️ Scoped by vehicle id ONLY — deliberately no `odometer.lt` filter, since going down is the
 * entire point. That makes this the one odometer write with no server-side value guard behind it,
 * which is exactly why it must never be reachable by the same tap as logging a reading.
 *
 * `odometer_at` moves to NOW: he is standing at the dash reading the real number. The old value
 * and the new one both land in `vehicle_changes`, so the correction is one legible row rather than
 * the clear-and-re-enter it replaces (which recorded a "no odometer" state that never existed).
 */
export function makeCorrectOdometer(deps: {
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
}) {
  const { setAllVehicles } = deps;

  return async (vehicleId: string, km: number): Promise<boolean> => {
    if (!Number.isFinite(km) || km <= 0) return false;
    const at = new Date().toISOString();
    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({ odometer: km, odometer_at: at }).eq('id', vehicleId));
    // ⚠️ Reports whether it landed — nothing upstream may show a corrected value the database
    // never took (the R61/R62 lesson, same as makeClearOdometer below).
    if (error) return false;
    setAllVehicles(prev => prev.map(v => (v.id === vehicleId ? { ...v, odometer: km, odometerAt: at } : v)));
    return true;
  };
}
