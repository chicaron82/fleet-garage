import { useCallback, useState } from 'react';
import { newVehicleToRegisterOnScan } from '../lib/resolveKeytagScan';
import type { useAuth } from '../context/AuthContext';
import type { useVehicleHoldContext } from '../context/VehicleHoldContext';
import type { KeytagRead } from '../../api/_lib/keytagRead';

/**
 * Auto-register a NEW vehicle from a movement key-tag scan, so a trip isn't logged as an orphan
 * against a plate FG doesn't know (LUR315, 2026-07-15 — a scanned trip whose car never landed in
 * the fleet). Known cars and too-partial reads no-op (newVehicleToRegisterOnScan returns null);
 * registration is NON-BLOCKING — a failed add never stops the trip from starting. Returns the
 * confirmation toast message + the scan handler to pass down as TripForm's onScanRead.
 */
export function useRegisterOnScan(deps: {
  vehicles: ReturnType<typeof useVehicleHoldContext>['vehicles'];
  addVehicle: ReturnType<typeof useVehicleHoldContext>['addVehicle'];
  user: ReturnType<typeof useAuth>['user'];
}) {
  const { vehicles, addVehicle, user } = deps;
  const [registerToast, setRegisterToast] = useState<string | null>(null);

  const handleScanRead = useCallback(async (read: KeytagRead) => {
    const nv = newVehicleToRegisterOnScan(read, vehicles);
    if (!nv || !user) return;
    try {
      await addVehicle({
        unitNumber: nv.unitNumber, licensePlate: nv.plate, make: nv.make, model: nv.model,
        year: nv.year, color: nv.color, branchId: user.branchId, isTesla: nv.make === 'Tesla',
        hasMobileCable: null, hasJ1772Adapter: null, status: 'CLEAR',
      });
      setRegisterToast(`✨ Registered ${nv.plate} · ${nv.year} ${nv.make} ${nv.model}`);
      setTimeout(() => setRegisterToast(null), 3000);
    } catch { /* non-blocking: the trip can still start without the fleet record */ }
  }, [vehicles, addVehicle, user]);

  return { registerToast, handleScanRead };
}
