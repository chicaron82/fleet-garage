import { useState } from 'react';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { carsHiddenFromHolds } from '../../lib/hiddenHolds';

/**
 * The tripwire for a hold the Holds list cannot show: a car with an active hold whose status still
 * reads Clear (lib/hiddenHolds). Names the car and fixes it in one tap by re-deriving its status from
 * its holds — the same `syncVehicleStatus` the vehicle page already runs on open.
 * ⚠️ A fix that doesn't land SAYS so; it never pretends.
 */
export function HiddenHoldsAlert({ onSelectVehicle }: { onSelectVehicle: (vehicleId: string) => void }) {
  const { vehicles, holds, syncVehicleStatus } = useVehicleHoldContext();
  const [failed, setFailed] = useState<string | null>(null);
  const [fixing, setFixing] = useState<string | null>(null);
  const hidden = carsHiddenFromHolds(vehicles, holds);
  if (hidden.length === 0) return null;

  const fix = async (vehicleId: string) => {
    setFixing(vehicleId);
    setFailed(null);
    const ok = await syncVehicleStatus(vehicleId);
    if (!ok) setFailed(vehicleId);
    setFixing(null);
  };

  return (
    <div role="alert" className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700/50 rounded-xl px-4 py-3 text-sm text-red-800 dark:text-red-300">
      <p className="font-medium">
        ⚠️ {hidden.length === 1 ? '1 car has' : `${hidden.length} cars have`} an active hold but {hidden.length === 1 ? 'reads' : 'read'} Clear, so {hidden.length === 1 ? "it's" : "they're"} missing from this list
      </p>
      <ul className="mt-2 space-y-1.5">
        {hidden.map(v => (
          <li key={v.id} className="flex items-center gap-2">
            <button onClick={() => onSelectVehicle(v.id)} className="underline font-mono cursor-pointer">
              {v.licensePlate || v.unitNumber}
            </button>
            <button
              onClick={() => fix(v.id)}
              disabled={fixing === v.id}
              className="ml-auto px-2.5 py-1 rounded-md border border-red-300 dark:border-red-700 text-xs font-medium cursor-pointer disabled:opacity-60"
            >
              {fixing === v.id ? 'Fixing…' : 'Fix'}
            </button>
            {failed === v.id && <span className="text-xs">Didn't save — try again</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
