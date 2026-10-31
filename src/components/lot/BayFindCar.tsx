// The empty bay's Find a car, IN the card. Aaron, 2026-10-29, on "Bumped. Bring the ASAP car in.": *"i'm already in the
// module. i feel like instead of opening up a floating search. that button should be the input search box that fuzzy
// searches. if i were elsewhere then it's fine."* Ticket: docs/ticket-bay-find-a-car-inline-search.md.
//
// • The same VehicleLookup the popup uses (contains-match on plate or unit, O read as 0), with Recent under it, in flow.
// • Picking a car stays here: its odo, then Start cleaning, the beat the popup ends on (OdometerCapture + ScanBayStart).
//   Since 2026-10-31 the car shows as the popup shows it, header and damage map (BayCarHeader), and the odo is
//   optional (docs/ticket-bay-log-first-shift-friction.md).
// • ⚠️ No autoFocus: a keyboard up on every empty bay would cover Erin St's count each time a car leaves.
// • A key FG cannot place opens the full popup with it, never a dead end (register, Lost & Found and the rest live there).
import { useState } from 'react';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useLookupRecents } from '../../hooks/useLookupRecents';
import type { BayLogState } from '../../hooks/useBayLog';
import { vehicleForPick } from '../../lib/lotBayLog';
import { VehicleLookup } from '../shared/VehicleLookup';
import { OdometerCapture } from '../shared/OdometerCapture';
import { ScanBayStart } from '../scan-router/ScanBayStart';
import { BayCarHeader } from './BayCarHeader';

/** `onOpenCar`: the header's tap, to the car's record. */
export function BayFindCar({ bay, onMore, onOpenCar }: { bay: BayLogState; onMore: () => void; onOpenCar: (vehicleId: string) => void }) {
  const { vehicles, archivedVehicles, recordOdometer, clearOdometer, correctOdometer } = useVehicleHoldContext();
  const { recents, record } = useLookupRecents(true);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [missed, setMissed] = useState<string | null>(null);
  // Looked up live, so the odo he just saved shows on the card and opens Start without a re-pick.
  const fleet = [...vehicles, ...archivedVehicles];
  const car = pickedId ? fleet.find(v => v.id === pickedId) ?? null : null;

  if (car) {
    return (
      <div className="space-y-3 text-left">
        {/* The popup's own header and damage map (BayCarHeader): Unit #, codes, status, and where the damage is. */}
        <BayCarHeader vehicle={car} onOpen={() => onOpenCar(car.id)} aside={
          <button type="button" onClick={() => setPickedId(null)}
            className="shrink-0 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer">
            Different car
          </button>
        } />
        <OdometerCapture isUs={car.isUs} vehicleId={car.id} resetKey={car.id} currentKm={car.odometer} currentAt={car.odometerAt}
          onSave={recordOdometer} onClear={clearOdometer} onCorrect={correctOdometer} />
        {/* Started: the module's own list gets the row, so this card turns into "In the bay" by itself. */}
        <ScanBayStart vehicle={car} bayLog={bay} onOpenBay={() => {}} />
      </div>
    );
  }

  return (
    <div className="space-y-2 text-left">
      <VehicleLookup inlineResults recents={recents} placeholder="Plate or unit"
        onPick={c => {
          const found = vehicleForPick(fleet, 'vehicle' in c ? { plate: c.vehicle.license_plate, unit: c.vehicle.unit_number } : c);
          setMissed(found ? null : 'typed' in c ? c.typed : c.vehicle.license_plate);
          if (found) { setPickedId(found.id); void record(found.id); }
        }} />
      {missed && (
        <button type="button" onClick={onMore}
          className="w-full rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-left text-xs text-amber-900 dark:text-amber-200 cursor-pointer">
          <span className="font-semibold">{missed}</span> isn&apos;t a car in FG. Open 🔍 Find a car to register it or look again →
        </button>
      )}
    </div>
  );
}
