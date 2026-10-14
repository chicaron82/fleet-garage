import { bothEvAssetsPresent, evExceptionHoldsToClose } from '../lib/evExceptionNow';
import { makeUpdateVehicleEVAssets } from './evAssetWrite';
import type { EvSource, Hold, Repair, Vehicle } from '../types';

// The EV-asset write, plus the second half of Aaron's 2026-10-13 ruling: a check that finds BOTH
// the cable and the adapter closes the car's EV-assets exception by itself (see lib/evExceptionNow).
//
// ⭐ Wrapped HERE, around the single write path, rather than in any one form: seven surfaces record an
// EV check (scan card, check-in, driver trip, washbay tab, quick-add, register, vehicle record). A close
// wired into one of them would be the capability gap the line-check station exists to catch.
//
// The close is an ordinary repair (`markRepaired`), so it leaves the same trail his own "Mark repaired /
// done" tap leaves: a `repairs` row naming who did the check and when, the linked earlier exceptions
// closed with it, and the vehicle re-derived. Reopening a mis-tap is the same as for any repair.
//
// ⚠️ The EV write's boolean is still the EV write's answer. If the close fails, the check DID land and
// says so; the hold stays open and the scan card's clause reads "both found · mark it done", which is
// the honest fallback (a write that fails must SAY so, and here the card is what says it).
type UpdateEvAssets = (
  vehicleId: string, hasMobileCable: boolean, hasJ1772Adapter: boolean, source: EvSource, notes?: string,
) => Promise<boolean>;

const SOURCE_WORDS: Record<EvSource, string> = {
  vsa_washbay: 'washbay check', check_in: 'check-in', driver_trip: 'driver trip', management: 'management check',
};

export function closeNoteFor(source: EvSource): string {
  return `Both EV assets present (${SOURCE_WORDS[source] ?? source}) — exception closed automatically.`;
}

export function makeUpdateEvAssetsAndClose(deps: {
  holds: Hold[];
  userId: string;
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  markRepaired: (holdId: string, repair: Omit<Repair, 'id'>) => Promise<void>;
  /** The plain EV write (./evAssetWrite). Injectable for tests only. */
  write?: UpdateEvAssets;
}): UpdateEvAssets {
  const { holds, userId, markRepaired } = deps;
  const write = deps.write ?? makeUpdateVehicleEVAssets({ userId, setAllVehicles: deps.setAllVehicles });
  return async (vehicleId, hasMobileCable, hasJ1772Adapter, source, notes) => {
    const landed = await write(vehicleId, hasMobileCable, hasJ1772Adapter, source, notes);
    if (!landed || !bothEvAssetsPresent({ hasMobileCable, hasJ1772Adapter })) return landed;
    const repairedAt = new Date().toISOString();
    for (const hold of evExceptionHoldsToClose(holds, vehicleId)) {
      try {
        await markRepaired(hold.id, {
          holdId: hold.id, repairedById: userId, repairedAt, notes: closeNoteFor(source), outcome: 'clean',
        });
      } catch (e) {
        console.error('[evAutoClose] both assets present but the exception did not close', hold.id, e);
      }
    }
    return landed;
  };
}
