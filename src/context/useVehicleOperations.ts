import { supabase, writeWithRefresh } from '../lib/supabase';
import { pushNotification, NOTIFY_MGMT_WIDE } from '../lib/garage-uploads';
import { deriveHoldStatus, factsFromHold, toVehicleStatus } from '../lib/vehicle-status';
import { makeClearSaleHold, makeMarkReturned, makeMarkRepaired, makeCloseException, makeMarkRepairedBatch, makeMarkIssueRepaired } from './holdResolution';
import { makeVoidHold, makeDeleteHold, makeDeleteHoldPhoto, makeEditHoldDescription } from './holdEditing';
import { makeAddHold, makeAddRelease, makeAddPhotosToHold } from './holdWrite';
import { makeUpdateVehicleEVAssets } from './evAssetWrite';
import { makeUpdateVehicleFields } from './vehicleFieldsWrite';
import { makeRecordKeyCount } from './keyCountWrite';
import { makeAttachKeytagPhoto } from './keytagPhotoWrite';
import { makeReleaseUnitNumber } from './identityReconcile';
import { withSubmitLock } from '../lib/submitLock';
import type { Vehicle, Hold, BranchId, VehicleStatus } from '../types';

interface VehicleOperationsProps {
  allVehicles: Vehicle[];
  holds: Hold[];
  activeBranch: string;
  userId: string;
  userName: string;
  userEmployeeId: string;
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  setAllHolds: React.Dispatch<React.SetStateAction<Hold[]>>;
}

export function useVehicleOperations({
  allVehicles,
  holds,
  activeBranch,
  userId,
  userName,
  userEmployeeId,
  setAllVehicles,
  setAllHolds,
}: VehicleOperationsProps) {

  const addVehicle = async (
    vehicle: Omit<Vehicle, 'id' | 'status' | 'branchId'> & { branchId?: string; status?: VehicleStatus },
  ): Promise<string | undefined> => {
    // Double-submit guard at the convergence point, keyed on the plate — the scan
    // flows (trip-scan auto-register, overflow stack-scan) can fire a same-plate
    // register twice before React re-renders the vehicles list, and each insert
    // would mint its own UUID. A dropped re-entrant call resolves undefined (the
    // first call is doing the work) — same contract as addHold/addRelease.
    return withSubmitLock(`vehicle:${vehicle.licensePlate.trim().toUpperCase()}`, async () => {
      const id = crypto.randomUUID();
      const branchId = (vehicle.branchId ?? (activeBranch === 'ALL' ? 'YWG' : activeBranch)) as BranchId;
      // Registration defaults to HELD (register-to-flag flow); a caller can pass a
      // status explicitly — e.g. the EV quick-add lands a transfer Tesla as CLEAR.
      const status = vehicle.status ?? 'HELD';
      const { error } = await writeWithRefresh(() =>
        supabase.from('vehicles').insert({
          id,
          unit_number:       vehicle.unitNumber,
          license_plate:     vehicle.licensePlate,
          make:              vehicle.make,
          model:             vehicle.model,
          year:              vehicle.year,
          color:             vehicle.color,
          rental_class:      vehicle.rentalClass ?? null,
          key_count:         vehicle.keyCount ?? null,
          keytag_photo_url:  vehicle.keytagPhotoUrl ?? null,
          branch_id:         branchId,
          status,
          is_tesla:          vehicle.isTesla ?? false,
          has_mobile_cable:  vehicle.hasMobileCable ?? null,
          has_j1772_adapter: vehicle.hasJ1772Adapter ?? null,
        })
      );
      if (error) throw new Error(`Failed to add vehicle: ${(error as { message?: string }).message}`);
      await pushNotification(branchId, NOTIFY_MGMT_WIDE, '🚗',
        `New vehicle registered: ${vehicle.unitNumber} (${vehicle.year} ${vehicle.make} ${vehicle.model})`, 'info', { vehicleId: id });
      const newVehicle: Vehicle = { ...vehicle, id, status, branchId };
      setAllVehicles(prev => [newVehicle, ...prev]);
      return id;
    });
  };

  // The EV-asset write (profile + stamp + unified log) lives in ./evAssetWrite
  // to keep this file under the line cap.
  const updateVehicleEVAssets = makeUpdateVehicleEVAssets({ userId, setAllVehicles });

  // Keytag-backfill write (the partial→backfill half of keytag-scan): applies FILLS
  // only, never conflicts. See ./vehicleFieldsWrite.
  const updateVehicleFields = makeUpdateVehicleFields({ setAllVehicles });
  const recordKeyCount = makeRecordKeyCount({ setAllVehicles });
  const attachKeytagPhoto = makeAttachKeytagPhoto({ setAllVehicles });

  // Reconcile a unit# conflict at registration: release the number from the
  // record it was on so it can land on the one being added. See ./identityReconcile.
  const releaseUnitNumber = makeReleaseUnitNumber({ setAllVehicles });

  // Hold WRITE ops (create-shaped) live in ./holdWrite; resolution ops in
  // ./holdResolution — both extracted to keep this file under the cap.
  const holdWriteDeps = { holds, allVehicles, activeBranch, userName, userEmployeeId, setAllVehicles, setAllHolds };
  const addHold         = makeAddHold(holdWriteDeps);
  const addRelease      = makeAddRelease(holdWriteDeps);
  const addPhotosToHold = makeAddPhotosToHold(holdWriteDeps);

  const markRepaired  = makeMarkRepaired({ holds, allVehicles, setAllHolds, setAllVehicles });
  const markReturned   = makeMarkReturned({ holds, allVehicles, setAllHolds, setAllVehicles });
  const clearSaleHold  = makeClearSaleHold({ holds, allVehicles, setAllHolds, setAllVehicles });
  const voidHold        = makeVoidHold({ holds, allVehicles, setAllHolds, setAllVehicles });
  const deleteHold      = makeDeleteHold({ holds, allVehicles, setAllHolds, setAllVehicles });
  const deleteHoldPhoto = makeDeleteHoldPhoto({ holds, allVehicles, setAllHolds, setAllVehicles });
  const editHoldDescription = makeEditHoldDescription({ holds, allVehicles, setAllHolds, setAllVehicles });
  const closeException = makeCloseException({ holds, allVehicles, setAllHolds, setAllVehicles });
  const markRepairedBatch = makeMarkRepairedBatch({ holds, allVehicles, setAllHolds, setAllVehicles });
  const markIssueRepaired = makeMarkIssueRepaired({ holds, allVehicles, setAllHolds, setAllVehicles });

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
    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({ archived_at: null, archived_by_id: null }).eq('id', vehicleId)
    );
    if (error) return;
    // Restore the holds archiving voided — unarchive resumes the vehicle's paused
    // holds (VOIDED → ACTIVE), the mirror of archiveVehicle. Only VOIDED reactivates;
    // resolved holds (RELEASED/REPAIRED/RETURNED) stay closed. Note: a hold voided
    // deliberately before archiving also reactivates — a returning vehicle surfaces
    // its full open slate, and a genuine mis-flag is one tap to re-void.
    await writeWithRefresh(() =>
      supabase.from('holds').update({ status: 'ACTIVE' }).eq('vehicle_id', vehicleId).eq('status', 'VOIDED')
    );
    setAllVehicles(prev => prev.map(v =>
      v.id === vehicleId ? { ...v, archivedAt: undefined, archivedById: undefined } : v
    ));
    setAllHolds(prev => prev.map(h =>
      h.vehicleId === vehicleId && h.status === 'VOIDED' ? { ...h, status: 'ACTIVE' as const } : h
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

  const syncVehicleStatus = async (vehicleId: string) => {
    const vehicle = allVehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;
    const vehicleHolds = holds.filter(h => h.vehicleId === vehicleId && h.status !== 'REPAIRED');
    const correctStatus = toVehicleStatus(deriveHoldStatus(vehicleHolds.map(factsFromHold)));
    if (vehicle.status === correctStatus) return;
    await writeWithRefresh(() =>
      supabase.from('vehicles').update({ status: correctStatus }).eq('id', vehicleId)
    );
    setAllVehicles(prev => prev.map(v => v.id !== vehicleId ? v : { ...v, status: correctStatus }));
  };

  const setCoverPhoto = async (vehicleId: string, url: string | null) => {
    await writeWithRefresh(() =>
      supabase.from('vehicles').update({ cover_photo_url: url }).eq('id', vehicleId)
    );
    setAllVehicles(prev => prev.map(v => v.id !== vehicleId ? v : { ...v, coverPhotoUrl: url ?? undefined }));
  };

  const markVehicleEditPending = (vehicleId: string, patch: { unit: string | null; plate: string; by: string; at: string; note: string }) => {
    setAllVehicles(prev => prev.map(v => v.id !== vehicleId ? v : {
      ...v,
      editSuggestedUnit: patch.unit,
      editSuggestedPlate: patch.plate,
      editSuggestedBy: patch.by,
      editSuggestedAt: patch.at,
      editSuggestionNote: patch.note,
      editStatus: 'pending',
    }));
  };

  const directEditVehicleIdentity = async (
    vehicleId: string,
    unit: string | null,
    plate: string,
    // Optional: a human correcting the make/model/year/colour they mis-selected at
    // registration. This is a deliberate OVERWRITE (unlike the keytag backfill, which only
    // fills blanks) — a person typing the right value is exactly the "human resolves it"
    // path the backfill rule defers to. Omitted → unit/plate-only edit, as before.
    identity?: { make: string; model: string; year: number; color: string },
  ) => {
    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({
        unit_number:          unit,
        license_plate:        plate,
        ...(identity ? { make: identity.make, model: identity.model, year: identity.year, color: identity.color } : {}),
        edit_status:          null,
        edit_suggested_unit:  null,
        edit_suggested_plate: null,
        edit_suggested_by:    null,
        edit_suggested_at:    null,
        edit_suggestion_note: null,
        edit_reviewed_by:     null,
        edit_reviewed_at:     null,
      }).eq('id', vehicleId)
    );
    if (error) return;
    setAllVehicles(prev => prev.map(v => v.id !== vehicleId ? v : {
      ...v, unitNumber: unit, licensePlate: plate, editStatus: null,
      ...(identity ? { make: identity.make, model: identity.model, year: identity.year, color: identity.color } : {}),
    }));
  };

  const applyVehicleIdentity = async (vehicleId: string, unit: string | null, plate: string) => {
    const now = new Date().toISOString();
    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({
        unit_number:      unit,
        license_plate:    plate,
        edit_status:      'approved',
        edit_reviewed_by: userId,
        edit_reviewed_at: now,
      }).eq('id', vehicleId)
    );
    if (error) return;
    setAllVehicles(prev => prev.map(v => v.id !== vehicleId ? v : {
      ...v, unitNumber: unit, licensePlate: plate,
      editStatus: 'approved', editReviewedBy: userId, editReviewedAt: now,
    }));
  };

  return {
    addVehicle,
    updateVehicleEVAssets,
    updateVehicleFields,
    recordKeyCount,
    attachKeytagPhoto,
    releaseUnitNumber,
    addHold,
    addRelease,
    addPhotosToHold,
    markRepaired,
    markRepairedBatch,
    markIssueRepaired,
    markReturned,
    clearSaleHold,
    voidHold,
    deleteHold,
    deleteHoldPhoto,
    editHoldDescription,
    closeException,
    archiveVehicle,
    restoreVehicle,
    syncVehicleStatus,
    setCoverPhoto,
    markVehicleEditPending,
    directEditVehicleIdentity,
    applyVehicleIdentity,
  };
}
