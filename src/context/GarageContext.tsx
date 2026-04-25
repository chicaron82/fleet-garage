import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { Vehicle, Hold, Release, Repair, VehicleStatus, HoldType, DetailReason } from '../types';
import { supabase } from '../lib/supabase';
import { mapVehicle, mapHold } from '../lib/garage-mappers';

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
  const path = `${holdId}/${Date.now()}.jpg`;
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
  addVehicle: (vehicle: Omit<Vehicle, 'id' | 'status'>) => Promise<string>;
  addHold: (vehicleId: string, damageDescription: string, notes: string, flaggedById: string, photos?: string[], holdType?: HoldType, detailReason?: DetailReason, linkedHoldId?: string) => Promise<void>;
  addRelease: (holdId: string, release: Omit<Release, 'id'>) => Promise<void>;
  addPhotosToHold: (holdId: string, newPhotos: string[]) => Promise<void>;
  markRepaired: (holdId: string, repair: Omit<Repair, 'id'>) => Promise<void>;
  markReturned: (holdId: string) => Promise<void>;
}

const GarageContext = createContext<GarageContextValue | null>(null);

export function GarageProvider({ children }: { children: React.ReactNode }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: vData }, { data: hData }] = await Promise.all([
        supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
        supabase.from('holds').select('*, releases(*), repairs(*)').order('flagged_at', { ascending: false }),
      ]);
      setVehicles((vData ?? []).map(mapVehicle));
      setHolds((hData ?? []).map(mapHold));
      setLoading(false);
    }
    load();
  }, []);

  const getVehicle = (id: string) => vehicles.find(v => v.id === id);

  const getVehicleByUnit = (unitNumber: string) =>
    vehicles.find(v => v.unitNumber.toLowerCase() === unitNumber.toLowerCase());

  const getHoldsForVehicle = (vehicleId: string) =>
    holds.filter(h => h.vehicleId === vehicleId)
         .sort((a, b) => new Date(b.flaggedAt).getTime() - new Date(a.flaggedAt).getTime());

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

  const addVehicle = async (vehicle: Omit<Vehicle, 'id' | 'status'>): Promise<string> => {
    const id = crypto.randomUUID();
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
    const newVehicle: Vehicle = { ...vehicle, id, status: 'HELD' };
    setVehicles(prev => [newVehicle, ...prev]);
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

    // Upload photos, collect public URLs
    const photoUrls: string[] = [];
    for (const base64 of photos ?? []) {
      const url = await uploadPhoto(base64, holdId);
      if (url) photoUrls.push(url);
    }

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

    const { error: vError } = await supabase.from('vehicles').update({ status: 'HELD' }).eq('id', vehicleId);
    if (vError) throw new Error(`Failed to update vehicle status: ${vError.message}`);

    const newHold: Hold = {
      id: holdId, vehicleId, holdType, detailReason, linkedHoldId,
      damageDescription, flaggedById, flaggedAt, notes,
      photos: photoUrls, status: 'ACTIVE',
    };
    setHolds(prev => [newHold, ...prev]);
    setVehicles(prev => prev.map(v => v.id === vehicleId ? { ...v, status: 'HELD' } : v));
  };

  const addRelease = async (holdId: string, release: Omit<Release, 'id'>) => {
    const releaseId = crypto.randomUUID();
    const fullRelease: Release = { ...release, id: releaseId };

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

    const hold = holds.find(h => h.id === holdId);
    if (hold) {
      const { error: vError } = await supabase.from('vehicles').update({ status: newVehicleStatus }).eq('id', hold.vehicleId);
      if (vError) throw new Error(`Failed to update vehicle status: ${vError.message}`);
    }

    setHolds(prev => prev.map(h =>
      h.id === holdId ? { ...h, status: 'RELEASED', release: fullRelease } : h
    ));
    if (hold) {
      setVehicles(prev => prev.map(v =>
        v.id === hold.vehicleId ? { ...v, status: newVehicleStatus } : v
      ));
    }
  };

  const addPhotosToHold = async (holdId: string, newPhotos: string[]) => {
    const hold = holds.find(h => h.id === holdId);
    if (!hold) return;

    const uploadedUrls: string[] = [];
    for (const base64 of newPhotos) {
      const url = await uploadPhoto(base64, holdId);
      if (url) uploadedUrls.push(url);
    }
    if (uploadedUrls.length === 0) return;

    const merged = [...(hold.photos ?? []), ...uploadedUrls];
    const { error } = await supabase.from('holds').update({ photos: merged }).eq('id', holdId);
    if (error) throw new Error(`Failed to update photos: ${error.message}`);
    setHolds(prev => prev.map(h =>
      h.id === holdId ? { ...h, photos: merged } : h
    ));
  };

  const markRepaired = async (holdId: string, repair: Omit<Repair, 'id'>) => {
    const repairId = crypto.randomUUID();
    const fullRepair: Repair = { ...repair, id: repairId };

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

    const hold = holds.find(h => h.id === holdId);
    if (hold) {
      const { error: vError } = await supabase.from('vehicles').update({ status: 'CLEAR' }).eq('id', hold.vehicleId);
      if (vError) throw new Error(`Failed to update vehicle status: ${vError.message}`);
    }

    setHolds(prev => prev.map(h =>
      h.id === holdId ? { ...h, status: 'REPAIRED' as const, repair: fullRepair } : h
    ));
    if (hold) {
      setVehicles(prev => prev.map(v =>
        v.id === hold.vehicleId ? { ...v, status: 'CLEAR' as const } : v
      ));
    }
  };

  const markReturned = async (holdId: string) => {
    const now = new Date().toISOString();
    const hold = holds.find(h => h.id === holdId);
    if (!hold) return;

    const { error: hError } = await supabase.from('holds').update({ status: 'RETURNED' }).eq('id', holdId);
    if (hError) throw new Error(`Failed to update hold status: ${hError.message}`);

    if (hold.release) {
      await supabase.from('releases').update({ actual_return: now }).eq('id', hold.release.id);
    }

    const { error: vError } = await supabase.from('vehicles').update({ status: 'RETURNED' }).eq('id', hold.vehicleId);
    if (vError) throw new Error(`Failed to update vehicle status: ${vError.message}`);

    setHolds(prev => prev.map(h =>
      h.id === holdId
        ? { ...h, status: 'RETURNED' as const, release: h.release ? { ...h.release, actualReturn: now } : h.release }
        : h
    ));
    setVehicles(prev => prev.map(v =>
      v.id === hold.vehicleId ? { ...v, status: 'RETURNED' as const } : v
    ));
  };

  return (
    <GarageContext.Provider value={{
      vehicles, holds, staleHolds, loading,
      getVehicle, getVehicleByUnit,
      getHoldsForVehicle, getActiveHold, releaseStreak,
      addVehicle, addHold, addRelease, addPhotosToHold, markRepaired, markReturned,
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
