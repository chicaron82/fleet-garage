import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { Vehicle, Hold, Release, Repair, VehicleStatus, HoldType, DetailReason, MechanicalSubType, BranchId } from '../types';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { mapVehicle, mapHold, mapIssue, mapWashbayLog, mapHandoffNote, mapLostFoundItem } from '../lib/garage-mappers';
import { uploadPhoto, pushNotification } from '../lib/garage-uploads';
import { useLostFound, type LostFoundSlice } from './useLostFound';
import { useIssues, type IssuesSlice } from './useIssues';
import { useWashbayHandoff, type WashbayHandoffSlice } from './useWashbayHandoff';

interface GarageContextValue extends LostFoundSlice, IssuesSlice, WashbayHandoffSlice {
  vehicles: Vehicle[];
  holds: Hold[];
  staleHolds: Hold[];
  loading: boolean;
  getVehicle: (id: string) => Vehicle | undefined;
  getVehicleByUnit: (unitNumber: string) => Vehicle | undefined;
  getHoldsForVehicle: (vehicleId: string) => Hold[];
  getActiveHold: (vehicleId: string) => Hold | undefined;
  releaseStreak: (vehicleId: string) => number;
  addVehicle: (vehicle: Omit<Vehicle, 'id' | 'status' | 'branchId'> & { branchId?: string }) => Promise<string>;
  updateVehicleEVAssets: (vehicleId: string, hasMobileCable: boolean, hasJ1772Adapter: boolean) => Promise<void>;
  addHold: (vehicleId: string, damageDescription: string, notes: string, flaggedById: string, photos?: string[], holdTypes?: HoldType[], detailReason?: DetailReason, mechanicalSubType?: MechanicalSubType | null, linkedHoldId?: string) => Promise<void>;
  addRelease: (holdId: string, release: Omit<Release, 'id'>) => Promise<void>;
  addPhotosToHold: (holdId: string, newPhotos: string[]) => Promise<void>;
  markRepaired: (holdId: string, repair: Omit<Repair, 'id'>) => Promise<void>;
  markReturned: (holdId: string) => Promise<void>;
  syncVehicleStatus: (vehicleId: string) => Promise<void>;
  archiveVehicle: (vehicleId: string) => Promise<void>;
  restoreVehicle: (vehicleId: string) => Promise<void>;
  archivedVehicles: Vehicle[];
  setCoverPhoto: (vehicleId: string, url: string | null) => Promise<void>;
  markVehicleEditPending: (vehicleId: string, patch: { unit: string | null; plate: string; by: string; at: string; note: string }) => void;
  applyVehicleIdentity: (vehicleId: string, unit: string | null, plate: string) => Promise<void>;
  directEditVehicleIdentity: (vehicleId: string, unit: string | null, plate: string) => Promise<void>;
  shuttlePlate: string;
  setShuttlePlate: (plate: string) => void;
}

const GarageContext = createContext<GarageContextValue | null>(null);

export function GarageProvider({ children }: { children: React.ReactNode }) {
  const { user, activeBranch } = useAuth();
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  const [allHolds, setAllHolds] = useState<Hold[]>([]);
  const [loading, setLoading] = useState(true);
  const [shuttlePlate, setShuttlePlate] = useState('KUR 261');

  const { setFacilityIssues, ...issuesSlice }         = useIssues(user, activeBranch);
  const { setWashbayLogs, setHandoffNotes, ...washbaySlice } = useWashbayHandoff(user, activeBranch);
  const { setAllLostFoundItems, ...lostFoundSlice }   = useLostFound(user, activeBranch, allVehicles);

  const vehicles = useMemo(() => {
    if (activeBranch === 'ALL') return allVehicles.filter(v => !v.archivedAt);
    return allVehicles.filter(v => v.branchId === activeBranch && !v.archivedAt);
  }, [allVehicles, activeBranch]);

  const archivedVehicles = useMemo(() => {
    if (activeBranch === 'ALL') return allVehicles.filter(v => !!v.archivedAt);
    return allVehicles.filter(v => v.branchId === activeBranch && !!v.archivedAt);
  }, [allVehicles, activeBranch]);

  const holds = useMemo(() => {
    if (activeBranch === 'ALL') return allHolds;
    return allHolds.filter(h => h.branchId === activeBranch);
  }, [allHolds, activeBranch]);

  useEffect(() => {
    async function load() {
      const [{ data: vData }, { data: hData }, { data: iData }, { data: wData }, { data: nData }, { data: lfData }] = await Promise.all([
        supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
        supabase.from('holds').select('*, releases(*), repairs(*)').order('flagged_at', { ascending: false }),
        supabase.from('facility_issues').select('*').order('reported_at', { ascending: false }),
        supabase.from('washbay_logs').select('*').order('date', { ascending: false }).limit(30),
        supabase.from('handoff_notes').select('*').order('logged_at', { ascending: false }).limit(20),
        supabase.from('lost_found').select('*').order('found_at', { ascending: false }).limit(100),
      ]);
      setAllVehicles((vData ?? []).map(mapVehicle));
      setAllHolds((hData ?? []).map(mapHold));
      setFacilityIssues((iData ?? []).map(mapIssue));
      setWashbayLogs((wData ?? []).map(mapWashbayLog));
      setHandoffNotes((nData ?? []).map(mapHandoffNote));
      setAllLostFoundItems((lfData ?? []).map(mapLostFoundItem));
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getVehicle = (id: string) => vehicles.find(v => v.id === id);
  const getVehicleByUnit = (unitNumber: string) =>
    vehicles.find(v => v.unitNumber?.toLowerCase() === unitNumber.toLowerCase());

  function latestActivity(hold: Hold): number {
    if (hold.repair?.repairedAt)  return new Date(hold.repair.repairedAt).getTime();
    if (hold.release?.approvedAt) return new Date(hold.release.approvedAt).getTime();
    return new Date(hold.flaggedAt).getTime();
  }

  const getHoldsForVehicle = (vehicleId: string) =>
    holds.filter(h => h.vehicleId === vehicleId)
         .sort((a, b) => latestActivity(b) - latestActivity(a));

  const getActiveHold = (vehicleId: string) =>
    holds.find(h => h.vehicleId === vehicleId && h.status === 'ACTIVE');

  const releaseStreak = (vehicleId: string): number => {
    const completed = holds
      .filter(h => h.vehicleId === vehicleId && h.status !== 'ACTIVE')
      .sort((a, b) => new Date(b.flaggedAt).getTime() - new Date(a.flaggedAt).getTime());
    let count = 0;
    for (const hold of completed) {
      if (hold.status === 'REPAIRED') break;
      if (hold.release?.releaseType === 'PRE_EXISTING') break;
      if (hold.status === 'RELEASED' || hold.status === 'RETURNED') count++;
    }
    return count;
  };

  const staleHolds = useMemo(() => {
    const now = Date.now();
    return holds.filter(h => {
      if (h.status !== 'ACTIVE') return false;
      return (now - new Date(h.flaggedAt).getTime()) > 48 * 60 * 60 * 1000;
    });
  }, [holds]);

  const addVehicle = async (vehicle: Omit<Vehicle, 'id' | 'status' | 'branchId'> & { branchId?: string }): Promise<string> => {
    const id = `veh-${Date.now()}`;
    const branchId = (vehicle.branchId ?? (activeBranch === 'ALL' ? 'YWG' : activeBranch)) as BranchId;
    const { error } = await supabase.from('vehicles').insert({
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
    });
    if (error) throw new Error(`Failed to add vehicle: ${error.message}`);
    await pushNotification(branchId, ['Branch Manager', 'Operations Manager', 'City Manager'], '🚗',
      `New vehicle registered: ${vehicle.unitNumber} (${vehicle.year} ${vehicle.make} ${vehicle.model})`, 'info', { vehicleId: id });
    const newVehicle: Vehicle = { ...vehicle, id, status: 'HELD', branchId };
    setAllVehicles(prev => [newVehicle, ...prev]);
    return id;
  };

  const updateVehicleEVAssets = async (vehicleId: string, hasMobileCable: boolean, hasJ1772Adapter: boolean) => {
    await supabase.from('vehicles').update({
      has_mobile_cable:  hasMobileCable,
      has_j1772_adapter: hasJ1772Adapter,
    }).eq('id', vehicleId);
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
    const branchId = activeBranch === 'ALL' ? 'YWG' : activeBranch;

    const photoUrls = (await Promise.all(
      (photos ?? []).map(b => b.startsWith('data:') ? uploadPhoto(b, holdId) : Promise.resolve(b))
    )).filter((url): url is string => url !== null);

    const { error } = await supabase.from('holds').insert({
      id: holdId, vehicle_id: vehicleId,
      hold_type: holdTypes[0], hold_types: holdTypes,
      detail_reason: detailReason ?? null,
      mechanical_sub_type: mechanicalSubType ?? null,
      damage_description: damageDescription,
      flagged_by_id: flaggedById, flagged_at: flaggedAt,
      notes, photos: photoUrls, status: 'ACTIVE',
      linked_hold_id: linkedHoldId ?? null,
      branch_id: branchId,
    });
    if (error) throw new Error(`Failed to add hold: ${error.message}`);

    const unitForHold = allVehicles.find(v => v.id === vehicleId)?.unitNumber ?? vehicleId;
    await pushNotification(branchId, ['Branch Manager', 'Operations Manager'], '🔴',
      `Hold flagged on unit ${unitForHold}: ${damageDescription}`, 'warning', { vehicleId });

    await supabase.from('vehicles').update({ status: 'HELD' }).eq('id', vehicleId);

    const newHold: Hold = {
      id: holdId, vehicleId, holdTypes, holdType: holdTypes[0], detailReason, mechanicalSubType, linkedHoldId,
      damageDescription, flaggedById, flaggedAt, notes, photos: photoUrls, status: 'ACTIVE', branchId,
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

    const { error } = await supabase.from('releases').insert({
      id: releaseId, hold_id: holdId,
      approved_by_id: release.approvedById, approved_at: release.approvedAt,
      release_type: release.releaseType ?? 'EXCEPTION',
      release_method: release.releaseMethod ?? 'standard',
      override_authorization: release.overrideAuthorization ?? null,
      reason: release.reason,
      expected_return: release.expectedReturn ?? null,
      actual_return: release.actualReturn ?? null,
      notes: release.notes,
    });
    if (error) throw new Error(`Failed to add release: ${error.message}`);

    await supabase.from('holds').update({ status: 'RELEASED' }).eq('id', holdId);

    const unitForRelease = allVehicles.find(v => v.id === hold.vehicleId)?.unitNumber ?? hold.vehicleId;
    await pushNotification(hold.branchId, ['VSA', 'Lead VSA', 'CSR', 'HIR'], '✅',
      `Unit ${unitForRelease} released — ${release.releaseType === 'EXCEPTION' ? 'on exception' : 'pre-existing'}`, 'success', { vehicleId: hold.vehicleId });

    await supabase.from('vehicles').update({ status: newVehicleStatus }).eq('id', hold.vehicleId);

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
    await supabase.from('holds').update({ photos: merged }).eq('id', holdId);
    setAllHolds(prev => prev.map(h => h.id !== holdId ? h : { ...h, photos: merged }));
  };

  const markRepaired = async (holdId: string, repair: Omit<Repair, 'id'>) => {
    const hold = holds.find(h => h.id === holdId);
    if (!hold) throw new Error(`Hold not found: ${holdId}`);
    const repairId = crypto.randomUUID();
    const newRepair: Repair = { ...repair, id: repairId };
    await supabase.from('repairs').insert({
      id: repairId, hold_id: holdId,
      repaired_by_id: repair.repairedById, repaired_at: repair.repairedAt, notes: repair.notes,
      outcome: repair.outcome,
    });
    await supabase.from('holds').update({ status: 'REPAIRED' }).eq('id', holdId);
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
    await supabase.from('vehicles').update({ status: newVehicleStatus }).eq('id', hold.vehicleId);
    setAllVehicles(prev => prev.map(v => v.id !== hold.vehicleId ? v : { ...v, status: newVehicleStatus }));
    setAllHolds(prev => prev.map(h => h.id !== holdId ? h : { ...h, status: 'REPAIRED', repair: newRepair }));
  };

  const markReturned = async (holdId: string) => {
    const returnedAt = new Date().toISOString();
    const hold = holds.find(h => h.id === holdId);
    if (!hold) return;
    await supabase.from('holds').update({ status: 'RETURNED' }).eq('id', holdId);
    if (hold.release) await supabase.from('releases').update({ actual_return: returnedAt }).eq('id', hold.release.id);
    await supabase.from('vehicles').update({ status: 'RETURNED' }).eq('id', hold.vehicleId);
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
    const { error } = await supabase
      .from('vehicles')
      .update({ archived_at: now, archived_by_id: user!.id })
      .eq('id', vehicleId);
    if (error) return;
    setAllVehicles(prev => prev.map(v =>
      v.id === vehicleId ? { ...v, archivedAt: now, archivedById: user!.id } : v
    ));
    const vehicle = allVehicles.find(v => v.id === vehicleId);
    await pushNotification(
      vehicle?.branchId ?? (activeBranch === 'ALL' ? 'YWG' : activeBranch),
      ['Branch Manager', 'Operations Manager', 'City Manager'],
      '📦',
      `Unit ${vehicle?.unitNumber ?? vehicleId} archived by ${user!.name}.`,
      'info',
      { vehicleId },
    );
  };

  const restoreVehicle = async (vehicleId: string) => {
    const { error } = await supabase
      .from('vehicles')
      .update({ archived_at: null, archived_by_id: null })
      .eq('id', vehicleId);
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
    const correctStatus: VehicleStatus =
      vehicleHolds.some(h => h.status === 'ACTIVE')
        ? 'HELD'
        : vehicleHolds.some(h => h.release?.releaseType === 'PRE_EXISTING')
          ? 'PRE_EXISTING'
          : vehicleHolds.some(h => h.release)
            ? 'OUT_ON_EXCEPTION'
            : 'CLEAR';
    if (vehicle.status === correctStatus) return;
    await supabase.from('vehicles').update({ status: correctStatus }).eq('id', vehicleId);
    setAllVehicles(prev => prev.map(v => v.id !== vehicleId ? v : { ...v, status: correctStatus }));
  };

  const setCoverPhoto = async (vehicleId: string, url: string | null) => {
    await supabase.from('vehicles').update({ cover_photo_url: url }).eq('id', vehicleId);
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
    const { error } = await supabase.from('vehicles').update({
      unit_number:        unit,
      license_plate:      plate,
      edit_status:        null,
      edit_suggested_unit:  null,
      edit_suggested_plate: null,
      edit_suggested_by:    null,
      edit_suggested_at:    null,
      edit_suggestion_note: null,
      edit_reviewed_by:   null,
      edit_reviewed_at:   null,
    }).eq('id', vehicleId);
    if (error) return;
    setAllVehicles(prev => prev.map(v => v.id !== vehicleId ? v : {
      ...v,
      unitNumber: unit,
      licensePlate: plate,
      editStatus: null,
    }));
  };

  const applyVehicleIdentity = async (vehicleId: string, unit: string | null, plate: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase.from('vehicles').update({
      unit_number: unit,
      license_plate: plate,
      edit_status: 'approved',
      edit_reviewed_by: user!.id,
      edit_reviewed_at: now,
    }).eq('id', vehicleId);
    if (error) return;
    setAllVehicles(prev => prev.map(v => v.id !== vehicleId ? v : {
      ...v,
      unitNumber: unit,
      licensePlate: plate,
      editStatus: 'approved',
      editReviewedBy: user!.id,
      editReviewedAt: now,
    }));
  };

  return (
    <GarageContext.Provider value={{
      vehicles, holds, staleHolds, loading,
      getVehicle, getVehicleByUnit,
      getHoldsForVehicle, getActiveHold, releaseStreak,
      addVehicle, updateVehicleEVAssets, addHold, addRelease, addPhotosToHold, markRepaired, markReturned, syncVehicleStatus,
      archiveVehicle, restoreVehicle, archivedVehicles,
      setCoverPhoto,
      markVehicleEditPending, applyVehicleIdentity, directEditVehicleIdentity,
      shuttlePlate, setShuttlePlate,
      ...issuesSlice,
      ...washbaySlice,
      ...lostFoundSlice,
    }}>
      {children}
    </GarageContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGarage(): GarageContextValue {
  const ctx = useContext(GarageContext);
  if (!ctx) throw new Error('useGarage must be used within GarageProvider');
  return ctx;
}
