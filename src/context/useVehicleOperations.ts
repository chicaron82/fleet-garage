import { supabase, writeWithRefresh } from '../lib/supabase';
import { uploadPhoto, pushNotification } from '../lib/garage-uploads';
import type {
  Vehicle, Hold, Release, Repair, VehicleStatus,
  HoldType, DetailReason, MechanicalSubType, BranchId,
} from '../types';

interface VehicleOperationsProps {
  allVehicles: Vehicle[];
  holds: Hold[];
  activeBranch: string;
  userId: string;
  userName: string;
  setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  setAllHolds: React.Dispatch<React.SetStateAction<Hold[]>>;
}

export function useVehicleOperations({
  allVehicles,
  holds,
  activeBranch,
  userId,
  userName,
  setAllVehicles,
  setAllHolds,
}: VehicleOperationsProps) {

  const addVehicle = async (vehicle: Omit<Vehicle, 'id' | 'status' | 'branchId'> & { branchId?: string }): Promise<string> => {
    const id = `veh-${Date.now()}`;
    const branchId = (vehicle.branchId ?? (activeBranch === 'ALL' ? 'YWG' : activeBranch)) as BranchId;
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
        status:            'HELD',
        is_tesla:          vehicle.isTesla ?? false,
        has_mobile_cable:  vehicle.hasMobileCable ?? null,
        has_j1772_adapter: vehicle.hasJ1772Adapter ?? null,
      })
    );
    if (error) throw new Error(`Failed to add vehicle: ${(error as { message?: string }).message}`);
    await pushNotification(branchId, ['Branch Manager', 'Operations Manager', 'City Manager'], '🚗',
      `New vehicle registered: ${vehicle.unitNumber} (${vehicle.year} ${vehicle.make} ${vehicle.model})`, 'info', { vehicleId: id });
    const newVehicle: Vehicle = { ...vehicle, id, status: 'HELD', branchId };
    setAllVehicles(prev => [newVehicle, ...prev]);
    return id;
  };

  const updateVehicleEVAssets = async (vehicleId: string, hasMobileCable: boolean, hasJ1772Adapter: boolean) => {
    await writeWithRefresh(() =>
      supabase.from('vehicles').update({
        has_mobile_cable:  hasMobileCable,
        has_j1772_adapter: hasJ1772Adapter,
      }).eq('id', vehicleId)
    );
    setAllVehicles(prev => prev.map(v =>
      v.id === vehicleId ? { ...v, hasMobileCable, hasJ1772Adapter } : v
    ));
  };

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
  ) => {
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
        flagged_by_id: flaggedById,
        flagged_at:    flaggedAt,
        notes, photos: photoUrls, status: 'ACTIVE',
        linked_hold_id: linkedHoldId ?? null,
        branch_id: branchId,
      })
    );
    if (error) throw new Error(`Failed to add hold: ${(error as { message?: string }).message}`);

    const unitForHold = allVehicles.find(v => v.id === vehicleId)?.unitNumber ?? vehicleId;
    await pushNotification(branchId, ['Branch Manager', 'Operations Manager'], '🔴',
      `Hold flagged on unit ${unitForHold}: ${damageDescription}`, 'warning', { vehicleId });

    await writeWithRefresh(() =>
      supabase.from('vehicles').update({ status: 'HELD' }).eq('id', vehicleId)
    );

    const newHold: Hold = {
      id: holdId, vehicleId, holdTypes, holdType: holdTypes[0], detailReason, mechanicalSubType, linkedHoldId,
      damageDescription, flaggedById,
      flaggedByName: '', flaggedByEmployeeId: '',
      flaggedAt, notes, photos: photoUrls, status: 'ACTIVE', branchId,
    };
    setAllHolds(prev => [newHold, ...prev]);
    setAllVehicles(prev => prev.map(v => v.id === vehicleId ? { ...v, status: 'HELD' } : v));
  };

  const addRelease = async (holdId: string, release: Omit<Release, 'id'>) => {
    const hold = holds.find(h => h.id === holdId);
    if (!hold) throw new Error(`Hold not found: ${holdId}`);

    const releaseId = crypto.randomUUID();
    const newRelease: Release = { ...release, id: releaseId };
    const otherUnresolvedHolds = holds.filter(
      h => h.id !== holdId && h.vehicleId === hold.vehicleId && h.status !== 'REPAIRED'
    );
    const newVehicleStatus: VehicleStatus =
      otherUnresolvedHolds.some(h => h.status === 'ACTIVE')
        ? 'HELD'
        : otherUnresolvedHolds.some(h => h.release?.releaseType === 'PRE_EXISTING')
          ? 'PRE_EXISTING'
          : release.releaseType === 'PRE_EXISTING' ? 'PRE_EXISTING' : 'OUT_ON_EXCEPTION';

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

    await writeWithRefresh(() =>
      supabase.from('vehicles').update({ status: newVehicleStatus }).eq('id', hold.vehicleId)
    );

    setAllHolds(prev => prev.map(h => h.id !== holdId ? h : { ...h, status: 'RELEASED', release: newRelease }));
    setAllVehicles(prev => prev.map(v => v.id !== hold.vehicleId ? v : { ...v, status: newVehicleStatus }));
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

  const markRepaired = async (holdId: string, repair: Omit<Repair, 'id'>) => {
    const hold = holds.find(h => h.id === holdId);
    if (!hold) throw new Error(`Hold not found: ${holdId}`);
    const repairId = crypto.randomUUID();
    const newRepair: Repair = { ...repair, id: repairId };
    await writeWithRefresh(() =>
      supabase.from('repairs').insert({
        id: repairId, hold_id: holdId,
        repaired_by_id: repair.repairedById, repaired_at: repair.repairedAt, notes: repair.notes,
        outcome: repair.outcome,
      })
    );
    await writeWithRefresh(() =>
      supabase.from('holds').update({ status: 'REPAIRED' }).eq('id', holdId)
    );
    const otherUnresolvedHolds = holds.filter(
      h => h.id !== holdId && h.vehicleId === hold.vehicleId && h.status !== 'REPAIRED'
    );
    const newVehicleStatus: VehicleStatus =
      otherUnresolvedHolds.some(h => h.status === 'ACTIVE')
        ? 'HELD'
        : otherUnresolvedHolds.some(h => h.release?.releaseType === 'PRE_EXISTING')
          ? 'PRE_EXISTING'
          : otherUnresolvedHolds.some(h => h.release)
            ? 'OUT_ON_EXCEPTION'
            : 'CLEAR';
    await writeWithRefresh(() =>
      supabase.from('vehicles').update({ status: newVehicleStatus }).eq('id', hold.vehicleId)
    );
    setAllVehicles(prev => prev.map(v => v.id !== hold.vehicleId ? v : { ...v, status: newVehicleStatus }));
    setAllHolds(prev => prev.map(h => h.id !== holdId ? h : { ...h, status: 'REPAIRED', repair: newRepair }));
  };

  const markReturned = async (holdId: string) => {
    const returnedAt = new Date().toISOString();
    const hold = holds.find(h => h.id === holdId);
    if (!hold) return;
    await writeWithRefresh(() =>
      supabase.from('holds').update({ status: 'RETURNED' }).eq('id', holdId)
    );
    if (hold.release) await writeWithRefresh(() =>
      supabase.from('releases').update({ actual_return: returnedAt }).eq('id', hold.release!.id)
    );
    await writeWithRefresh(() =>
      supabase.from('vehicles').update({ status: 'RETURNED' }).eq('id', hold.vehicleId)
    );
    const unitForReturn = allVehicles.find(v => v.id === hold.vehicleId)?.unitNumber ?? hold.vehicleId;
    await pushNotification(hold.branchId, ['Branch Manager', 'Operations Manager'], '🔁',
      `Exception vehicle ${unitForReturn} has returned. Re-evaluation required.`, 'urgent', { vehicleId: hold.vehicleId });
    setAllHolds(prev => prev.map(h => h.id !== holdId ? h : {
      ...h, status: 'RETURNED',
      release: h.release ? { ...h.release, actualReturn: returnedAt } : undefined,
    }));
    setAllVehicles(prev => prev.map(v => v.id !== hold.vehicleId ? v : { ...v, status: 'RETURNED' }));
  };

  const archiveVehicle = async (vehicleId: string) => {
    const now = new Date().toISOString();
    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({ archived_at: now, archived_by_id: userId }).eq('id', vehicleId)
    );
    if (error) return;
    setAllVehicles(prev => prev.map(v =>
      v.id === vehicleId ? { ...v, archivedAt: now, archivedById: userId } : v
    ));
    const vehicle = allVehicles.find(v => v.id === vehicleId);
    await pushNotification(
      vehicle?.branchId ?? (activeBranch === 'ALL' ? 'YWG' : activeBranch),
      ['Branch Manager', 'Operations Manager', 'City Manager'],
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
    setAllVehicles(prev => prev.map(v =>
      v.id === vehicleId ? { ...v, archivedAt: undefined, archivedById: undefined } : v
    ));
    const vehicle = allVehicles.find(v => v.id === vehicleId);
    await pushNotification(
      vehicle?.branchId ?? (activeBranch === 'ALL' ? 'YWG' : activeBranch),
      ['Branch Manager', 'Operations Manager', 'City Manager'],
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
    const hasActiveNonSaleCar    = vehicleHolds.some(h => h.status === 'ACTIVE' && !h.holdTypes.includes('sale_car'));
    const hasActiveSaleCar       = vehicleHolds.some(h => h.status === 'ACTIVE' && h.holdTypes.includes('sale_car'));
    const hasPreExRelease        = vehicleHolds.some(h => h.release?.releaseType === 'PRE_EXISTING');
    const hasReleasedSaleCar     = vehicleHolds.some(h => h.status === 'RELEASED' && h.holdTypes.includes('sale_car') && h.release);
    const hasOtherRelease        = vehicleHolds.some(h => h.status === 'RELEASED' && h.release && !h.holdTypes.includes('sale_car'));
    const correctStatus: VehicleStatus =
      hasActiveNonSaleCar  ? 'HELD' :
      hasActiveSaleCar     ? 'SALE_CAR' :
      hasPreExRelease      ? 'PRE_EXISTING' :
      hasReleasedSaleCar   ? 'AUCTION_SHORT_TERM' :
      hasOtherRelease      ? 'OUT_ON_EXCEPTION' :
                             'CLEAR';
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

  const directEditVehicleIdentity = async (vehicleId: string, unit: string | null, plate: string) => {
    const { error } = await writeWithRefresh(() =>
      supabase.from('vehicles').update({
        unit_number:          unit,
        license_plate:        plate,
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
    addHold,
    addRelease,
    addPhotosToHold,
    markRepaired,
    markReturned,
    archiveVehicle,
    restoreVehicle,
    syncVehicleStatus,
    setCoverPhoto,
    markVehicleEditPending,
    directEditVehicleIdentity,
    applyVehicleIdentity,
  };
}
