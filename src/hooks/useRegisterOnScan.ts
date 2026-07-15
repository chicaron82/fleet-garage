import { useCallback, useState } from 'react';
import { newVehicleToRegisterOnScan, backfillFieldsOnScan } from '../lib/resolveKeytagScan';
import type { useAuth } from '../context/AuthContext';
import type { useVehicleHoldContext } from '../context/VehicleHoldContext';
import type { KeytagRead } from '../../api/_lib/keytagRead';

/**
 * Sync the fleet from a movement key-tag scan so a trip isn't logged against a car FG doesn't
 * fully know (LUR315, 2026-07-15 — a scanned trip whose car never landed in the fleet):
 * a NEW plate is registered from the read, an ON-RECORD-but-PARTIAL one has its blank fields
 * backfilled (blanks-only, never overwrites — same contract as the drop-n-go). Known/complete
 * cars and too-partial reads no-op; both writes are NON-BLOCKING — a failure never stops the
 * trip. Returns the confirmation toast + the scan handler for TripForm's onScanRead.
 */
export function useRegisterOnScan(deps: {
  vehicles: ReturnType<typeof useVehicleHoldContext>['vehicles'];
  addVehicle: ReturnType<typeof useVehicleHoldContext>['addVehicle'];
  updateVehicleFields: ReturnType<typeof useVehicleHoldContext>['updateVehicleFields'];
  user: ReturnType<typeof useAuth>['user'];
}) {
  const { vehicles, addVehicle, updateVehicleFields, user } = deps;
  const [registerToast, setRegisterToast] = useState<string | null>(null);

  const handleScanRead = useCallback(async (read: KeytagRead) => {
    if (!user) return;
    const flash = (msg: string) => { setRegisterToast(msg); setTimeout(() => setRegisterToast(null), 3000); };

    const nv = newVehicleToRegisterOnScan(read, vehicles);
    if (nv) {
      try {
        await addVehicle({
          unitNumber: nv.unitNumber, licensePlate: nv.plate, make: nv.make, model: nv.model,
          year: nv.year, color: nv.color, branchId: user.branchId, isTesla: nv.make === 'Tesla',
          hasMobileCable: null, hasJ1772Adapter: null, status: 'CLEAR',
        });
        flash(`✨ Registered ${nv.plate} · ${nv.year} ${nv.make} ${nv.model}`);
      } catch { /* non-blocking: the trip can still start without the fleet record */ }
      return;
    }

    const bf = backfillFieldsOnScan(read, vehicles);
    if (bf) {
      try {
        await updateVehicleFields(bf.vehicleId, bf.fills);
        flash(`✨ Updated ${bf.plate} · filled ${bf.fills.map(f => f.field).join(', ')}`);
      } catch { /* non-blocking */ }
    }
  }, [vehicles, addVehicle, updateVehicleFields, user]);

  return { registerToast, handleScanRead };
}
