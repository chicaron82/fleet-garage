import { useMemo } from 'react';
import { useVehicleHoldContext } from '../context/VehicleHoldContext';
import { evDispatchWarning } from '../lib/evDispatch';

/**
 * Resolve a trip's entered plate to a fleet vehicle and flag a Tesla whose
 * canonical EV kit is known-missing (or carries an open not-dispatchable hold),
 * so the warning surfaces before the run starts. Null when nothing to flag.
 */
export function useEvDispatchWarning(vehiclePlate: string) {
  const { vehicles, holds } = useVehicleHoldContext();
  return useMemo(() => {
    const p = vehiclePlate.trim().toUpperCase();
    if (!p) return null;
    return evDispatchWarning(vehicles.find(v => v.licensePlate.toUpperCase() === p), holds);
  }, [vehiclePlate, vehicles, holds]);
}
