import { supabase, writeWithRefresh } from '../lib/supabase';
import { pushNotification, NOTIFY_MGMT_WIDE } from '../lib/garage-uploads';
import { deriveHoldStatus, factsFromHold, toVehicleStatus, openSaleCarHolds } from '../lib/vehicle-status';
import type { Vehicle, Hold } from '../types';

// Archive / restore — moved verbatim out of useVehicleOperations (2026-10-21) when the part-repair
// wire pushed that file past the line cap. Same closure, same writes; only the address changed.
interface Deps {
  allVehicles: Vehicle[];
  holds: Hold[];
  activeBranch: string;
  userId: string;
  userName: string;
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  setAllHolds: React.Dispatch<React.SetStateAction<Hold[]>>;
}

export function makeArchiveOps({ allVehicles, holds, activeBranch, userId, userName, setAllVehicles, setAllHolds }: Deps) {
  const archiveVehicle = async (vehicleId: string) => {
    const now = new Date().toISOString();
    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({ archived_at: now, archived_by_id: userId }).eq('id', vehicleId)
    );
    if (error) return;
    // Void the vehicle's still-active holds — archiving removes it from the working
    // set, so a lingering ACTIVE hold would orphan: age forever, never actionable,
    // and inflate "held too long". VOIDED is the right terminal state (it neither
    // counts nor breaks a streak). Unarchiving does NOT resurrect them — re-flag if
    // the vehicle ever returns with a real issue.
    await writeWithRefresh(() =>
      supabase.from('holds').update({ status: 'VOIDED' }).eq('vehicle_id', vehicleId).eq('status', 'ACTIVE')
    );
    setAllVehicles(prev => prev.map(v =>
      v.id === vehicleId ? { ...v, archivedAt: now, archivedById: userId } : v
    ));
    setAllHolds(prev => prev.map(h =>
      h.vehicleId === vehicleId && h.status === 'ACTIVE' ? { ...h, status: 'VOIDED' as const } : h
    ));
    const vehicle = allVehicles.find(v => v.id === vehicleId);
    await pushNotification(
      vehicle?.branchId ?? (activeBranch === 'ALL' ? 'YWG' : activeBranch),
      NOTIFY_MGMT_WIDE,
      '📦',
      `Unit ${vehicle?.unitNumber ?? vehicleId} archived by ${userName}.`,
      'info',
      { vehicleId },
    );
  };

  const restoreVehicle = async (vehicleId: string) => {
    // Un-archive INTO CIRCULATION: management put a sale/auction car back, which reverses ONLY the
    // sale intent — NOT the car's real condition. So we void just the still-open sale_car holds
    // (auction's off, and they're what pinned the car at AUCTION_SHORT_TERM) and PRESERVE every other
    // hold, then RE-DERIVE the status from what survives. An accepted PRE_EXISTING scratch stays →
    // the car returns PRE_EXISTING, never a lying CLEAR (erasing a still-true condition would recreate
    // the exact old-damage-amnesia FG exists to kill). We do NOT resurrect the holds archiving voided
    // — a real ACTIVE issue on return is one deliberate re-flag.
    const vehHolds = holds.filter(h => h.vehicleId === vehicleId);
    const cancelIds = openSaleCarHolds(vehHolds).map(h => h.id);
    const survivors = vehHolds.filter(h => !cancelIds.includes(h.id));
    const newStatus = toVehicleStatus(deriveHoldStatus(survivors.map(factsFromHold)));
    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({ archived_at: null, archived_by_id: null, status: newStatus }).eq('id', vehicleId)
    );
    if (error) return;
    if (cancelIds.length) {
      await writeWithRefresh(() =>
        supabase.from('holds').update({ status: 'VOIDED' }).eq('vehicle_id', vehicleId).in('id', cancelIds)
      );
    }
    setAllVehicles(prev => prev.map(v =>
      v.id === vehicleId ? { ...v, archivedAt: undefined, archivedById: undefined, status: newStatus } : v
    ));
    setAllHolds(prev => prev.map(h =>
      cancelIds.includes(h.id) ? { ...h, status: 'VOIDED' as const } : h
    ));
    const vehicle = allVehicles.find(v => v.id === vehicleId);
    await pushNotification(
      vehicle?.branchId ?? (activeBranch === 'ALL' ? 'YWG' : activeBranch),
      NOTIFY_MGMT_WIDE,
      '🔄',
      `Unit ${vehicle?.unitNumber ?? vehicleId} restored to active service.`,
      'info',
      { vehicleId },
    );
  };

  return { archiveVehicle, restoreVehicle };
}
