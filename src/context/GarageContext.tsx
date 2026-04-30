import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { Vehicle, Hold, Release, Repair, VehicleStatus, HoldType, DetailReason, UserRole, FacilityIssue, IssueSeverity } from '../types';
import type { NotificationSeverity } from '../data/notifications';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { mapVehicle, mapHold } from '../lib/garage-mappers';

// ── Notification helper ───────────────────────────────────────────────────────

async function pushNotification(
  branchId: string,
  roles: UserRole[],
  icon: string,
  text: string,
  severity: NotificationSeverity = 'info',
  metadata?: Record<string, unknown>,
) {
  await supabase.from('notifications').insert({
    branch_id: branchId,
    recipient_roles: roles,
    icon,
    text,
    severity,
    metadata,
  });
}

// ── Photo helpers ─────────────────────────────────────────────────────────────

function base64ToBlob(base64: string): Blob {
  const [header, data] = base64.split(',');
  const mime = header.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function uploadPhoto(base64: string, holdId: string): Promise<string | null> {
  const blob = base64ToBlob(base64);
  const path = `${holdId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from('damage-photos')
    .upload(path, blob, { contentType: 'image/jpeg' });
  if (error) return null;
  return supabase.storage.from('damage-photos').getPublicUrl(path).data.publicUrl;
}

// ── Context ───────────────────────────────────────────────────────────────────

interface GarageContextValue {
  vehicles: Vehicle[];
  holds: Hold[];
  staleHolds: Hold[];
  loading: boolean;
  getVehicle: (id: string) => Vehicle | undefined;
  getVehicleByUnit: (unitNumber: string) => Vehicle | undefined;
  getHoldsForVehicle: (vehicleId: string) => Hold[];
  getActiveHold: (vehicleId: string) => Hold | undefined;
  releaseStreak: (vehicleId: string) => number;
  addVehicle: (vehicle: Omit<Vehicle, 'id' | 'status' | 'branchId'>) => Promise<string>;
  addHold: (vehicleId: string, damageDescription: string, notes: string, flaggedById: string, photos?: string[], holdType?: HoldType, detailReason?: DetailReason, linkedHoldId?: string) => Promise<void>;
  addRelease: (holdId: string, release: Omit<Release, 'id'>) => Promise<void>;
  addPhotosToHold: (holdId: string, newPhotos: string[]) => Promise<void>;
  markRepaired: (holdId: string, repair: Omit<Repair, 'id'>) => Promise<void>;
  markReturned: (holdId: string) => Promise<void>;
  shuttlePlate: string;
  setShuttlePlate: (plate: string) => void;
  facilityIssues: FacilityIssue[];
  addIssue: (data: { title: string; description?: string; severity: IssueSeverity }) => Promise<void>;
  clearIssue: (issueId: string, notes?: string) => Promise<void>;
}

const GarageContext = createContext<GarageContextValue | null>(null);

export function GarageProvider({ children }: { children: React.ReactNode }) {
  const { user, activeBranch } = useAuth();
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  const [allHolds, setAllHolds] = useState<Hold[]>([]);
  const [facilityIssues, setFacilityIssues] = useState<FacilityIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [shuttlePlate, setShuttlePlate] = useState('KUR 261');

  const vehicles = useMemo(() => {
    if (activeBranch === 'ALL') return allVehicles;
    return allVehicles.filter(v => v.branchId === activeBranch);
  }, [allVehicles, activeBranch]);

  const holds = useMemo(() => {
    if (activeBranch === 'ALL') return allHolds;
    return allHolds.filter(h => h.branchId === activeBranch);
  }, [allHolds, activeBranch]);

  useEffect(() => {
    async function load() {
      const [{ data: vData }, { data: hData }, { data: iData }] = await Promise.all([
        supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
        supabase.from('holds').select('*, releases(*), repairs(*)').order('flagged_at', { ascending: false }),
        supabase.from('facility_issues').select('*').eq('branch_id', activeBranch === 'ALL' ? activeBranch : activeBranch).order('reported_at', { ascending: false }),
      ]);
      setAllVehicles((vData ?? []).map(mapVehicle));
      setAllHolds((hData ?? []).map(mapHold));
      setFacilityIssues((iData ?? []).map(rowToIssue));
      setLoading(false);
    }
    load();
  }, []);

// ── Issue mapper ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToIssue(row: any): FacilityIssue {
  return {
    id:           row.id,
    branchId:     row.branch_id,
    title:        row.title,
    description:  row.description ?? undefined,
    severity:     row.severity as IssueSeverity,
    reportedById: row.reported_by,
    reportedAt:   row.reported_at,
    clearedById:  row.cleared_by ?? undefined,
    clearedAt:    row.cleared_at ?? undefined,
    notes:        row.notes ?? undefined,
  };
}

  const getVehicle = (id: string) => vehicles.find(v => v.id === id);
  const getVehicleByUnit = (unitNumber: string) =>
    vehicles.find(v => v.unitNumber.toLowerCase() === unitNumber.toLowerCase());

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
      const releaseType = hold.release?.releaseType;
      if (hold.status === 'REPAIRED') break;
      if (releaseType === 'PRE_EXISTING') break;
      if (hold.status === 'RELEASED' || hold.status === 'RETURNED') count++;
    }
    return count;
  };

  const staleHolds = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    return holds.filter(h => {
      if (h.status !== 'ACTIVE') return false;
      const ageMs = now - new Date(h.flaggedAt).getTime();
      return ageMs > 48 * 60 * 60 * 1000;
    });
  }, [holds]);

  const addVehicle = async (vehicle: Omit<Vehicle, 'id' | 'status' | 'branchId'>): Promise<string> => {
    const id = `veh-${Date.now()}`;
    const branchId: Vehicle['branchId'] = activeBranch === 'ALL' ? 'YWG' : activeBranch;
    const { error } = await supabase.from('vehicles').insert({
      id,
      unit_number:   vehicle.unitNumber,
      license_plate: vehicle.licensePlate,
      make:          vehicle.make,
      model:         vehicle.model,
      year:          vehicle.year,
      color:         vehicle.color,
      status:        'HELD',
    });
    if (error) throw new Error(`Failed to add vehicle: ${error.message}`);
    await pushNotification(
      branchId,
      ['Branch Manager', 'Operations Manager', 'City Manager'],
      '🚗',
      `New vehicle registered: ${vehicle.unitNumber} (${vehicle.year} ${vehicle.make} ${vehicle.model})`,
      'info',
    );
    const newVehicle: Vehicle = { ...vehicle, id, status: 'HELD', branchId };
    setAllVehicles(prev => [newVehicle, ...prev]);
    return id;
  };

  const addHold = async (
    vehicleId: string,
    damageDescription: string,
    notes: string,
    flaggedById: string,
    photos?: string[],
    holdType: HoldType = 'damage',
    detailReason?: DetailReason,
    linkedHoldId?: string,
  ) => {
    const holdId = crypto.randomUUID();
    const flaggedAt = new Date().toISOString();

    // Upload photos in parallel, collect public URLs
    const photoUrls = (await Promise.all((photos ?? []).map(b => uploadPhoto(b, holdId))))
      .filter((url): url is string => url !== null);

    const branchId = activeBranch === 'ALL' ? 'YWG' : activeBranch;

    const { error } = await supabase.from('holds').insert({
      id:                 holdId,
      vehicle_id:         vehicleId,
      hold_type:          holdType,
      detail_reason:      detailReason ?? null,
      damage_description: damageDescription,
      flagged_by_id:      flaggedById,
      flagged_at:         flaggedAt,
      notes,
      photos:             photoUrls,
      status:             'ACTIVE',
      linked_hold_id:     linkedHoldId ?? null,
    });
    if (error) throw new Error(`Failed to add hold: ${error.message}`);

    const unitForHold = allVehicles.find(v => v.id === vehicleId)?.unitNumber ?? vehicleId;
    await pushNotification(
      branchId,
      ['Branch Manager', 'Operations Manager'],
      '🔴',
      `Hold flagged on unit ${unitForHold}: ${damageDescription}`,
      'warning',
    );

    const { error: vError } = await supabase.from('vehicles').update({ status: 'HELD' }).eq('id', vehicleId);
    if (vError) throw new Error(`Failed to update vehicle status: ${vError.message}`);

    const newHold: Hold = {
      id: holdId, vehicleId, holdType, detailReason, linkedHoldId,
      damageDescription, flaggedById, flaggedAt, notes,
      photos: photoUrls, status: 'ACTIVE',
      branchId,
    };
    
    setAllHolds(prev => [newHold, ...prev]);
    
    // Auto-update vehicle status
    setAllVehicles(prev => prev.map(v => 
      v.id === vehicleId ? { ...v, status: 'HELD' } : v
    ));
  };

  const addRelease = async (holdId: string, release: Omit<Release, 'id'>) => {
    const hold = holds.find(h => h.id === holdId);
    if (!hold) throw new Error(`Hold not found: ${holdId}`);

    const releaseId = crypto.randomUUID();
    const newRelease: Release = { ...release, id: releaseId };

    const newVehicleStatus: VehicleStatus =
      release.releaseType === 'PRE_EXISTING' ? 'PRE_EXISTING' : 'OUT_ON_EXCEPTION';

    const { error } = await supabase.from('releases').insert({
      id:                      releaseId,
      hold_id:                 holdId,
      approved_by_id:          release.approvedById,
      approved_at:             release.approvedAt,
      release_type:            release.releaseType ?? 'EXCEPTION',
      release_method:          release.releaseMethod ?? 'standard',
      override_authorization:  release.overrideAuthorization ?? null,
      reason:                  release.reason,
      expected_return:         release.expectedReturn ?? null,
      actual_return:           release.actualReturn ?? null,
      notes:                   release.notes,
    });
    if (error) throw new Error(`Failed to add release: ${error.message}`);

    const { error: hError } = await supabase.from('holds').update({ status: 'RELEASED' }).eq('id', holdId);
    if (hError) throw new Error(`Failed to update hold status: ${hError.message}`);

    const unitForRelease = allVehicles.find(v => v.id === hold.vehicleId)?.unitNumber ?? hold.vehicleId;
    await pushNotification(
      hold.branchId,
      ['VSA', 'Lead VSA', 'CSR', 'HIR'],
      '✅',
      `Unit ${unitForRelease} released — ${release.releaseType === 'EXCEPTION' ? 'on exception' : 'pre-existing'}`,
      'success',
    );

    const { error: vError } = await supabase.from('vehicles').update({ status: newVehicleStatus }).eq('id', hold.vehicleId);
    if (vError) throw new Error(`Failed to update vehicle status: ${vError.message}`);

    // Add release to local state, update hold status
    setAllHolds(prev => prev.map(h => {
      if (h.id !== holdId) return h;
      return {
        ...h,
        status: 'RELEASED',
        release: newRelease,
      };
    }));

    // Update vehicle status
    setAllVehicles(prev => prev.map(v => {
      if (v.id !== hold.vehicleId) return v;
      return {
        ...v,
        status: release.releaseType === 'PRE_EXISTING' ? 'PRE_EXISTING' : 'OUT_ON_EXCEPTION',
      };
    }));
  };

  const addPhotosToHold = async (holdId: string, newPhotos: string[]) => {
    const hold = holds.find(h => h.id === holdId);
    if (!hold) return;

    const uploadedUrls = (await Promise.all(newPhotos.map(b => uploadPhoto(b, holdId))))
      .filter((url): url is string => url !== null);
    if (uploadedUrls.length === 0) return;

    const { error } = await supabase.from('holds').update({ photos: [...(hold.photos ?? []), ...uploadedUrls] }).eq('id', holdId);
    if (error) throw new Error(`Failed to update photos: ${error.message}`);
    setAllHolds(prev => prev.map(h => {
      if (h.id !== holdId) return h;
      return {
        ...h,
        photos: [...(h.photos ?? []), ...uploadedUrls],
      };
    }));
  };

  const markRepaired = async (holdId: string, repair: Omit<Repair, 'id'>) => {
    const hold = holds.find(h => h.id === holdId);
    if (!hold) throw new Error(`Hold not found: ${holdId}`);

    const repairId = crypto.randomUUID();
    const newRepair: Repair = { ...repair, id: repairId };

    const { error } = await supabase.from('repairs').insert({
      id:              repairId,
      hold_id:         holdId,
      repaired_by_id:  repair.repairedById,
      repaired_at:     repair.repairedAt,
      notes:           repair.notes,
    });
    if (error) throw new Error(`Failed to add repair: ${error.message}`);

    const { error: hError } = await supabase.from('holds').update({ status: 'REPAIRED' }).eq('id', holdId);
    if (hError) throw new Error(`Failed to update hold status: ${hError.message}`);

    const { error: vError } = await supabase.from('vehicles').update({ status: 'CLEAR' }).eq('id', hold.vehicleId);
    if (vError) throw new Error(`Failed to update vehicle status: ${vError.message}`);

    // Update local state
    setAllHolds(prev => prev.map(h => {
      if (h.id !== holdId) return h;
      return { ...h, status: 'REPAIRED', repair: newRepair };
    }));

    setAllVehicles(prev => prev.map(v => {
      if (v.id !== hold.vehicleId) return v;
      return { ...v, status: 'CLEAR' };
    }));
  };

  const markReturned = async (holdId: string) => {
    const returnedAt = new Date().toISOString();
    const hold = holds.find(h => h.id === holdId);
    if (!hold) return;

    const { error: hError } = await supabase.from('holds').update({ status: 'RETURNED' }).eq('id', holdId);
    if (hError) throw new Error(`Failed to update hold status: ${hError.message}`);

    if (hold.release) {
      await supabase.from('releases').update({ actual_return: returnedAt }).eq('id', hold.release.id);
    }

    const { error: vError } = await supabase.from('vehicles').update({ status: 'RETURNED' }).eq('id', hold.vehicleId);
    if (vError) throw new Error(`Failed to update vehicle status: ${vError.message}`);

    const unitForReturn = allVehicles.find(v => v.id === hold.vehicleId)?.unitNumber ?? hold.vehicleId;
    await pushNotification(
      hold.branchId,
      ['Branch Manager', 'Operations Manager'],
      '🔁',
      `Exception vehicle ${unitForReturn} has returned. Re-evaluation required.`,
      'urgent',
    );

    // Update hold & vehicle
    setAllHolds(prev => prev.map(h => {
      if (h.id !== holdId) return h;
      return {
        ...h,
        status: 'RETURNED',
        release: h.release ? { ...h.release, actualReturn: returnedAt } : undefined,
      };
    }));

    setAllVehicles(prev => prev.map(v => {
      if (v.id !== hold.vehicleId) return v;
      return { ...v, status: 'RETURNED' };
    }));
  };

  const addIssue = async ({ title, description, severity }: { title: string; description?: string; severity: IssueSeverity }) => {
    const branchId = activeBranch === 'ALL' ? 'YWG' : activeBranch;
    const { data } = await supabase.from('facility_issues').insert({
      branch_id:   branchId,
      title,
      description,
      severity,
      reported_by: user!.id,
    }).select().single();
    if (data) setFacilityIssues(prev => [rowToIssue(data), ...prev]);
  };

  const clearIssue = async (issueId: string, notes?: string) => {
    const clearedAt = new Date().toISOString();
    await supabase.from('facility_issues').update({
      cleared_by: user!.id,
      cleared_at: clearedAt,
      notes,
    }).eq('id', issueId);
    setFacilityIssues(prev =>
      prev.map(i => i.id === issueId
        ? { ...i, clearedById: user!.id, clearedAt, notes }
        : i
      )
    );
  };

  return (
    <GarageContext.Provider value={{
      vehicles, holds, staleHolds, loading,
      getVehicle, getVehicleByUnit,
      getHoldsForVehicle, getActiveHold, releaseStreak,
      addVehicle, addHold, addRelease, addPhotosToHold, markRepaired, markReturned,
      shuttlePlate, setShuttlePlate,
      facilityIssues, addIssue, clearIssue,
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
