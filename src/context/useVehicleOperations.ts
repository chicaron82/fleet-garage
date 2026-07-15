import { supabase, writeWithRefresh } from '../lib/supabase';
import { uploadPhoto, pushNotification, NOTIFY_MGMT, NOTIFY_MGMT_WIDE } from '../lib/garage-uploads';
import { deriveHoldStatus, factsFromHold, toVehicleStatus } from '../lib/vehicle-status';
import { makeClearSaleHold, makeMarkReturned, makeMarkRepaired, makeCloseException, makeMarkRepairedBatch, makeMarkIssueRepaired } from './holdResolution';
import { makeVoidHold, makeDeleteHold, makeDeleteHoldPhoto, makeEditHoldDescription } from './holdEditing';
import { makeUpdateVehicleEVAssets } from './evAssetWrite';
import { makeUpdateVehicleFields } from './vehicleFieldsWrite';
import { makeReleaseUnitNumber } from './identityReconcile';
import { withSubmitLock } from '../lib/submitLock';
import type {
  Vehicle, Hold, Release,
  HoldType, DetailReason, MechanicalSubType, BranchId, VehicleStatus,
} from '../types';

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
  ): Promise<string> => {
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
  };

  // The EV-asset write (profile + stamp + unified log) lives in ./evAssetWrite
  // to keep this file under the line cap.
  const updateVehicleEVAssets = makeUpdateVehicleEVAssets({ userId, setAllVehicles });

  // Keytag-backfill write (the partial→backfill half of keytag-scan): applies FILLS
  // only, never conflicts. See ./vehicleFieldsWrite.
  const updateVehicleFields = makeUpdateVehicleFields({ setAllVehicles });

  // Reconcile a unit# conflict at registration: release the number from the
  // record it was on so it can land on the one being added. See ./identityReconcile.
  const releaseUnitNumber = makeReleaseUnitNumber({ setAllVehicles });

  const addHold = async (
    vehicleId: string,
    damageDescription: string,
    notes: string,
    flaggedById: string,
    photos?: string[],
    holdTypes: HoldType[] = ['damage'],
    detailReason?: DetailReason,
    mechanicalSubType?: MechanicalSubType | null,
    linkedHoldId?: string,
    flaggedSource?: string | null, // null = hand-flagged; 'effie' when written through Effie
  ) => {
    // Double-submit guard at the convergence point: every addHold caller (six and
    // counting) is protected here, not per-form. Keyed per vehicle — a re-entrant
    // flag for the same vehicle while the first is in flight is dropped. Returns the
    // created hold id + final uploaded photo URLs so callers can compose follow-ups
    // (e.g. pinning a card photo); a dropped re-entrant call resolves `undefined`.
    return withSubmitLock(`hold:${vehicleId}`, async () => {
      const holdId = crypto.randomUUID();
      const flaggedAt = new Date().toISOString();
      const branchId = (activeBranch === 'ALL' ? 'YWG' : activeBranch) as BranchId;

      const photoUrls = (await Promise.all(
        (photos ?? []).map(b => b.startsWith('data:') ? uploadPhoto(b, holdId) : Promise.resolve(b))
      )).filter((url): url is string => url !== null);

      const { error } = await writeWithRefresh(() =>
        supabase.from('holds').insert({
          id: holdId, vehicle_id: vehicleId,
          hold_type: holdTypes[0], hold_types: holdTypes,
          detail_reason: detailReason ?? null,
          mechanical_sub_type: mechanicalSubType ?? null,
          damage_description: damageDescription,
          flagged_by_id:          flaggedById,
          flagged_by_name:        userName,
          flagged_by_employee_id: userEmployeeId,
          flagged_source:         flaggedSource ?? null,
          flagged_at:             flaggedAt,
          notes, photos: photoUrls, status: 'ACTIVE',
          linked_hold_id: linkedHoldId ?? null,
          branch_id: branchId,
        })
      );
      if (error) throw new Error(`Failed to add hold: ${(error as { message?: string }).message}`);

      const unitForHold = allVehicles.find(v => v.id === vehicleId)?.unitNumber ?? vehicleId;
      await pushNotification(branchId, NOTIFY_MGMT, '🔴',
        `Hold flagged on unit ${unitForHold}: ${damageDescription}`, 'warning', { vehicleId });

      // The hold insert is the source of truth for "the hold exists", so the hold
      // is added locally unconditionally below. The vehicle status flip is a derived
      // follow-up: gate its optimistic update on the write so a failed `vehicles`
      // update (no realtime channel — won't self-heal) can't diverge from the DB.
      const { error: vehErr } = await writeWithRefresh(() =>
        supabase.from('vehicles').update({ status: 'HELD' }).eq('id', vehicleId)
      );

      const newHold: Hold = {
        id: holdId, vehicleId, holdTypes, holdType: holdTypes[0], resolvedTypes: [], detailReason, mechanicalSubType, linkedHoldId,
        damageDescription, flaggedById,
        flaggedByName: userName, flaggedByEmployeeId: userEmployeeId,
        flaggedAt, notes, photos: photoUrls, status: 'ACTIVE', branchId,
      };
      // Idempotent local add: never show two copies of the same hold id (e.g. a
      // realtime echo arriving alongside this optimistic insert).
      setAllHolds(prev => prev.some(h => h.id === holdId) ? prev : [newHold, ...prev]);
      if (!vehErr) setAllVehicles(prev => prev.map(v => v.id === vehicleId ? { ...v, status: 'HELD' } : v));

      return { holdId, photoUrls };
    });
  };

  const addRelease = async (holdId: string, release: Omit<Release, 'id'>) => {
    // Keyed per hold — `hold.release` is singular downstream, so a double-submit
    // here is data corruption (two release rows on one hold), not just a UX dupe.
    await withSubmitLock(`release:${holdId}`, async () => {
      const hold = holds.find(h => h.id === holdId);
      if (!hold) throw new Error(`Hold not found: ${holdId}`);

      const releaseId = crypto.randomUUID();
      const newRelease: Release = { ...release, id: releaseId };
      // Project the post-release hold set and derive the vehicle status from the
      // shared cascade (lib/vehicle-status) so the read and write paths agree.
      const projectedHolds = holds
        .filter(h => h.vehicleId === hold.vehicleId)
        .map(h => h.id === holdId ? { ...h, status: 'RELEASED' as const, release: newRelease } : h);
      const newVehicleStatus = toVehicleStatus(deriveHoldStatus(projectedHolds.map(factsFromHold)));

      const { error } = await writeWithRefresh(() =>
        supabase.from('releases').insert({
          id: releaseId, hold_id: holdId,
          approved_by_id: release.approvedById, approved_at: release.approvedAt,
          release_type: release.releaseType ?? 'EXCEPTION',
          release_method: release.releaseMethod ?? 'standard',
          override_authorization: release.overrideAuthorization ?? null,
          reason: release.reason,
          expected_return: release.expectedReturn ?? null,
          actual_return: release.actualReturn ?? null,
          notes: release.notes,
        })
      );
      if (error) throw new Error(`Failed to add release: ${(error as { message?: string }).message}`);

      await writeWithRefresh(() =>
        supabase.from('holds').update({ status: 'RELEASED' }).eq('id', holdId)
      );

      const unitForRelease = allVehicles.find(v => v.id === hold.vehicleId)?.unitNumber ?? hold.vehicleId;
      await pushNotification(hold.branchId, ['VSA', 'Lead VSA', 'CSR', 'HIR'], '✅',
        `Unit ${unitForRelease} released — ${release.releaseType === 'EXCEPTION' ? 'on exception' : 'pre-existing'}`, 'success', { vehicleId: hold.vehicleId });

      const { error: vehErr } = await writeWithRefresh(() =>
        supabase.from('vehicles').update({ status: newVehicleStatus }).eq('id', hold.vehicleId)
      );

      setAllHolds(prev => prev.map(h => h.id !== holdId ? h : { ...h, status: 'RELEASED', release: newRelease }));
      // Gate the derived vehicle-status flip on its write (vehicles has no realtime
      // self-heal). The fleet view derives status from holds regardless; this keeps
      // the stored status from diverging when the follow-up update fails.
      if (!vehErr) setAllVehicles(prev => prev.map(v => v.id !== hold.vehicleId ? v : { ...v, status: newVehicleStatus }));
    });
  };

  const addPhotosToHold = async (holdId: string, newPhotos: string[]) => {
    const hold = holds.find(h => h.id === holdId);
    if (!hold) return;
    const uploadedUrls = (await Promise.all(newPhotos.map(b => uploadPhoto(b, holdId))))
      .filter((url): url is string => url !== null);
    if (uploadedUrls.length === 0) return;
    const merged = [...(hold.photos ?? []), ...uploadedUrls];
    await writeWithRefresh(() =>
      supabase.from('holds').update({ photos: merged }).eq('id', holdId)
    );
    setAllHolds(prev => prev.map(h => h.id !== holdId ? h : { ...h, photos: merged }));
  };

  // Hold-resolution ops live in ./holdResolution to keep this file under the cap.
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
