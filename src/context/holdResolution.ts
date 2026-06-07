import { supabase, writeWithRefresh } from '../lib/supabase';
import { pushNotification } from '../lib/garage-uploads';
import { deriveHoldStatus, factsFromHold, toVehicleStatus } from '../lib/vehicle-status';
import type { Hold, Vehicle } from '../types';

// Hold-resolution ops that move a hold out of ACTIVE and reconcile the vehicle
// status. Extracted from useVehicleOperations to keep it under the 330-line cap;
// each factory closes over the same shared state the hook owns.
interface ResolutionDeps {
  holds: Hold[];
  allVehicles: Vehicle[];
  setAllHolds: React.Dispatch<React.SetStateAction<Hold[]>>;
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
}

// Mark an exception-released vehicle as physically returned. Hardcodes the
// vehicle to RETURNED and fires the "re-evaluation required" alarm to managers —
// the return of a real held vehicle, not an error correction.
export function makeMarkReturned({ holds, allVehicles, setAllHolds, setAllVehicles }: ResolutionDeps) {
  return async (holdId: string) => {
    const returnedAt = new Date().toISOString();
    const hold = holds.find(h => h.id === holdId);
    // Throw like addRelease/markRepaired so confirmReturn's caller can tell a
    // vanished hold from a successful return, instead of a silent no-op.
    if (!hold) throw new Error(`Hold not found: ${holdId}`);
    // Primary write — throw on failure so the caller (useReEval.confirmReturn)
    // can surface it rather than flipping local state on a write that didn't land.
    const { error } = await writeWithRefresh(() =>
      supabase.from('holds').update({ status: 'RETURNED' }).eq('id', holdId)
    );
    if (error) throw new Error(`Failed to mark returned: ${(error as { message?: string }).message}`);
    if (hold.release) await writeWithRefresh(() =>
      supabase.from('releases').update({ actual_return: returnedAt }).eq('id', hold.release!.id)
    );
    const { error: vehErr } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({ status: 'RETURNED' }).eq('id', hold.vehicleId)
    );
    const unitForReturn = allVehicles.find(v => v.id === hold.vehicleId)?.unitNumber ?? hold.vehicleId;
    await pushNotification(hold.branchId, ['Branch Manager', 'Operations Manager'], '🔁',
      `Exception vehicle ${unitForReturn} has returned. Re-evaluation required.`, 'urgent', { vehicleId: hold.vehicleId });
    setAllHolds(prev => prev.map(h => h.id !== holdId ? h : {
      ...h, status: 'RETURNED',
      release: h.release ? { ...h.release, actualReturn: returnedAt } : undefined,
    }));
    if (!vehErr) setAllVehicles(prev => prev.map(v => v.id !== hold.vehicleId ? v : { ...v, status: 'RETURNED' }));
  };
}

// Clear a sale/auction flag logged in error (plates pulled off rentable backlog
// that was never actually a sale car). Voids the sale_car hold — RETURNED drops
// it out of both the active and the open-exception branches of the status
// cascade, so the vehicle derives back to clear/rentable — closes any short-term
// auction release, and pings management for awareness (not the re-evaluation
// alarm markReturned fires).
export function makeClearSaleHold({ holds, allVehicles, setAllHolds, setAllVehicles }: ResolutionDeps) {
  return async (holdId: string, clearedByName: string) => {
    const hold = holds.find(h => h.id === holdId);
    if (!hold) throw new Error(`Hold not found: ${holdId}`);
    const clearedAt = new Date().toISOString();
    // Primary write — throw on failure like the sibling ops so the caller can
    // surface it instead of flipping local state on a write that didn't land.
    const { error } = await writeWithRefresh(() =>
      supabase.from('holds').update({ status: 'VOIDED' }).eq('id', holdId)
    );
    if (error) throw new Error(`Failed to clear sale flag: ${(error as { message?: string }).message}`);
    if (hold.release) await writeWithRefresh(() =>
      supabase.from('releases').update({ actual_return: clearedAt }).eq('id', hold.release!.id)
    );
    // Derive the corrected vehicle status from the remaining holds (shared cascade)
    // — lands on clear unless a separate genuine hold still grounds the vehicle.
    const projectedHolds = holds
      .filter(h => h.vehicleId === hold.vehicleId)
      .map(h => h.id === holdId
        ? { ...h, status: 'VOIDED' as const, release: h.release ? { ...h.release, actualReturn: clearedAt } : undefined }
        : h);
    const newVehicleStatus = toVehicleStatus(deriveHoldStatus(projectedHolds.map(factsFromHold)));
    const { error: vehErr } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({ status: newVehicleStatus }).eq('id', hold.vehicleId)
    );
    const unit = allVehicles.find(v => v.id === hold.vehicleId)?.unitNumber ?? hold.vehicleId;
    await pushNotification(hold.branchId, ['Branch Manager', 'Operations Manager'], 'ℹ️',
      `Sale/auction flag cleared on unit ${unit} (logged in error) by ${clearedByName}.`, 'info', { vehicleId: hold.vehicleId });
    setAllHolds(prev => prev.map(h => h.id !== holdId ? h : {
      ...h, status: 'VOIDED',
      release: h.release ? { ...h.release, actualReturn: clearedAt } : undefined,
    }));
    if (!vehErr) setAllVehicles(prev => prev.map(v => v.id !== hold.vehicleId ? v : { ...v, status: newVehicleStatus }));
  };
}
