import type { Dispatch, SetStateAction } from 'react';
import { supabase, writeWithRefresh } from '../lib/supabase';
import { deleteDamagePhotos } from '../lib/garage-uploads';
import { deriveHoldStatus, factsFromHold, toVehicleStatus } from '../lib/vehicle-status';
import type { Hold, Vehicle } from '../types';

// Destructive hold-history EDITS — correcting mistakes (a duplicate hold, a wrongly-attached
// photo), distinct from ./holdResolution (which moves a REAL hold through its lifecycle).
// Same shared-state shape + status-reconcile cascade. releases/repairs cascade on a hold delete
// (FK ON DELETE CASCADE). Storage cleanup is best-effort — the DB is the source of truth, an
// orphaned file is recoverable, a blocked correction isn't. See docs/ticket-holds-history-edit.md.
interface EditDeps {
  holds: Hold[];
  allVehicles: Vehicle[];
  setAllHolds: Dispatch<SetStateAction<Hold[]>>;
  setAllVehicles: Dispatch<SetStateAction<Vehicle[]>>;
}

/** Re-derive a vehicle's status from a projected hold set + persist it (shared cascade). */
async function reconcileVehicleStatus(
  vehicleId: string,
  projectedHolds: Hold[],
  setAllVehicles: EditDeps['setAllVehicles'],
): Promise<void> {
  const status = toVehicleStatus(
    deriveHoldStatus(projectedHolds.filter(h => h.vehicleId === vehicleId).map(factsFromHold)),
  );
  const { error } = await writeWithRefresh(() =>
    supabase.from('vehicles').update({ status }).eq('id', vehicleId));
  if (!error) setAllVehicles(prev => prev.map(v => (v.id !== vehicleId ? v : { ...v, status })));
}

/** If a URL is a vehicle's cover photo, clear the cover (a deleted file would render broken). */
async function clearCoverIfMatch(
  vehicleId: string,
  removedUrls: string[],
  allVehicles: Vehicle[],
  setAllVehicles: EditDeps['setAllVehicles'],
): Promise<void> {
  const veh = allVehicles.find(v => v.id === vehicleId);
  if (!veh?.coverPhotoUrl || !removedUrls.includes(veh.coverPhotoUrl)) return;
  await writeWithRefresh(() =>
    supabase.from('vehicles').update({ cover_photo_url: null }).eq('id', vehicleId));
  setAllVehicles(prev => prev.map(v => (v.id !== vehicleId ? v : { ...v, coverPhotoUrl: undefined })));
}

/** VOID a hold (soft) — keep the record, mark it VOIDED, reconcile the vehicle status. For
 *  cancelling a hold that really happened but no longer applies. */
export function makeVoidHold({ holds, setAllHolds, setAllVehicles }: EditDeps) {
  return async (holdId: string): Promise<void> => {
    const hold = holds.find(h => h.id === holdId);
    if (!hold) throw new Error(`Hold not found: ${holdId}`);
    const { error } = await writeWithRefresh(() =>
      supabase.from('holds').update({ status: 'VOIDED' }).eq('id', holdId));
    if (error) throw new Error(`Failed to void hold: ${(error as { message?: string }).message}`);
    setAllHolds(prev => prev.map(h => (h.id !== holdId ? h : { ...h, status: 'VOIDED' as const })));
    await reconcileVehicleStatus(
      hold.vehicleId,
      holds.map(h => (h.id === holdId ? { ...h, status: 'VOIDED' as const } : h)),
      setAllVehicles,
    );
  };
}

/** DELETE a hold (hard) — the row (releases/repairs cascade), its photos from storage, and
 *  reconcile the vehicle status + cover photo. For a mistake / duplicate. */
export function makeDeleteHold({ holds, allVehicles, setAllHolds, setAllVehicles }: EditDeps) {
  return async (holdId: string): Promise<void> => {
    const hold = holds.find(h => h.id === holdId);
    if (!hold) throw new Error(`Hold not found: ${holdId}`);
    const { error } = await writeWithRefresh(() =>
      supabase.from('holds').delete().eq('id', holdId));
    if (error) throw new Error(`Failed to delete hold: ${(error as { message?: string }).message}`);
    void deleteDamagePhotos(hold.photos ?? []); // best-effort storage cleanup
    setAllHolds(prev => prev.filter(h => h.id !== holdId));
    await clearCoverIfMatch(hold.vehicleId, hold.photos ?? [], allVehicles, setAllVehicles);
    await reconcileVehicleStatus(hold.vehicleId, holds.filter(h => h.id !== holdId), setAllVehicles);
  };
}

/** Remove ONE photo from a hold — the array, the storage file, and the cover if it was pinned. */
export function makeDeleteHoldPhoto({ holds, allVehicles, setAllHolds, setAllVehicles }: EditDeps) {
  return async (holdId: string, photoUrl: string): Promise<void> => {
    const hold = holds.find(h => h.id === holdId);
    if (!hold) throw new Error(`Hold not found: ${holdId}`);
    const nextPhotos = (hold.photos ?? []).filter(u => u !== photoUrl);
    const { error } = await writeWithRefresh(() =>
      supabase.from('holds').update({ photos: nextPhotos }).eq('id', holdId));
    if (error) throw new Error(`Failed to remove photo: ${(error as { message?: string }).message}`);
    void deleteDamagePhotos([photoUrl]);
    setAllHolds(prev => prev.map(h => (h.id !== holdId ? h : { ...h, photos: nextPhotos })));
    await clearCoverIfMatch(hold.vehicleId, [photoUrl], allVehicles, setAllVehicles);
  };
}
