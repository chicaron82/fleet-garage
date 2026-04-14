import { createContext, useContext, useState, useEffect } from 'react';
import type { Vehicle, Hold, Release, Repair, VehicleStatus, HoldStatus, HoldType, DetailReason, ReleaseType } from '../types';
import { supabase } from '../lib/supabase';

// ── Row mappers ───────────────────────────────────────────────────────────────

function mapVehicle(row: Record<string, unknown>): Vehicle {
  return {
    id:           row.id as string,
    unitNumber:   row.unit_number as string,
    licensePlate: row.license_plate as string,
    make:         row.make as string,
    model:        row.model as string,
    year:         row.year as number,
    color:        row.color as string,
    status:       row.status as VehicleStatus,
  };
}

function mapRelease(row: Record<string, unknown>): Release {
  return {
    id:             row.id as string,
    holdId:         row.hold_id as string,
    approvedById:   row.approved_by_id as string,
    approvedAt:     row.approved_at as string,
    releaseType:    ((row.release_type as string) ?? 'EXCEPTION') as ReleaseType,
    reason:         row.reason as string,
    expectedReturn: (row.expected_return as string) ?? undefined,
    actualReturn:   (row.actual_return as string) ?? undefined,
    notes:          row.notes as string,
  };
}

function mapRepair(row: Record<string, unknown>): Repair {
  return {
    id:            row.id as string,
    holdId:        row.hold_id as string,
    repairedById:  row.repaired_by_id as string,
    repairedAt:    row.repaired_at as string,
    notes:         (row.notes as string) ?? '',
  };
}

function mapHold(row: Record<string, unknown>): Hold {
  const releases = row.releases as Record<string, unknown>[] | undefined;
  const repairs  = row.repairs  as Record<string, unknown>[] | undefined;
  return {
    id:                 row.id as string,
    vehicleId:          row.vehicle_id as string,
    holdType:           ((row.hold_type as string) ?? 'damage') as HoldType,
    detailReason:       (row.detail_reason as DetailReason) ?? undefined,
    damageDescription:  row.damage_description as string,
    flaggedById:        row.flagged_by_id as string,
    flaggedAt:          row.flagged_at as string,
    notes:              row.notes as string,
    photos:             (row.photos as string[]) ?? [],
    status:             row.status as HoldStatus,
    release:            releases?.[0] ? mapRelease(releases[0]) : undefined,
    repair:             repairs?.[0]  ? mapRepair(repairs[0])   : undefined,
  };
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
  loading: boolean;
  getVehicle: (id: string) => Vehicle | undefined;
  getVehicleByUnit: (unitNumber: string) => Vehicle | undefined;
  getHoldsForVehicle: (vehicleId: string) => Hold[];
  getActiveHold: (vehicleId: string) => Hold | undefined;
  addVehicle: (vehicle: Omit<Vehicle, 'id' | 'status'>) => Promise<string>;
  addHold: (vehicleId: string, damageDescription: string, notes: string, flaggedById: string, photos?: string[], holdType?: HoldType, detailReason?: DetailReason) => Promise<void>;
  addRelease: (holdId: string, release: Omit<Release, 'id'>) => Promise<void>;
  addPhotosToHold: (holdId: string, newPhotos: string[]) => Promise<void>;
  markRepaired: (holdId: string, repair: Omit<Repair, 'id'>) => Promise<void>;
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

  const addVehicle = async (vehicle: Omit<Vehicle, 'id' | 'status'>): Promise<string> => {
    const id = `v${Date.now()}`;
    await supabase.from('vehicles').insert({
      id,
      unit_number:   vehicle.unitNumber,
      license_plate: vehicle.licensePlate,
      make:          vehicle.make,
      model:         vehicle.model,
      year:          vehicle.year,
      color:         vehicle.color,
      status:        'HELD',
    });
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
  ) => {
    const holdId = `h${Date.now()}`;
    const flaggedAt = new Date().toISOString();

    // Upload photos, collect public URLs
    const photoUrls: string[] = [];
    for (const base64 of photos ?? []) {
      const url = await uploadPhoto(base64, holdId);
      if (url) photoUrls.push(url);
    }

    await supabase.from('holds').insert({
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
    });
    await supabase.from('vehicles').update({ status: 'HELD' }).eq('id', vehicleId);

    const newHold: Hold = {
      id: holdId, vehicleId, holdType, detailReason,
      damageDescription, flaggedById, flaggedAt, notes,
      photos: photoUrls, status: 'ACTIVE',
    };
    setHolds(prev => [newHold, ...prev]);
    setVehicles(prev => prev.map(v => v.id === vehicleId ? { ...v, status: 'HELD' } : v));
  };

  const addRelease = async (holdId: string, release: Omit<Release, 'id'>) => {
    const releaseId = `r${Date.now()}`;
    const fullRelease: Release = { ...release, id: releaseId };

    const newVehicleStatus: VehicleStatus =
      release.releaseType === 'PRE_EXISTING' ? 'PRE_EXISTING' : 'OUT_ON_EXCEPTION';

    await supabase.from('releases').insert({
      id:              releaseId,
      hold_id:         holdId,
      approved_by_id:  release.approvedById,
      approved_at:     release.approvedAt,
      release_type:    release.releaseType ?? 'EXCEPTION',
      reason:          release.reason,
      expected_return: release.expectedReturn ?? null,
      actual_return:   release.actualReturn ?? null,
      notes:           release.notes,
    });
    await supabase.from('holds').update({ status: 'RELEASED' }).eq('id', holdId);

    const hold = holds.find(h => h.id === holdId);
    if (hold) {
      await supabase.from('vehicles').update({ status: newVehicleStatus }).eq('id', hold.vehicleId);
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
    await supabase.from('holds').update({ photos: merged }).eq('id', holdId);
    setHolds(prev => prev.map(h =>
      h.id === holdId ? { ...h, photos: merged } : h
    ));
  };

  const markRepaired = async (holdId: string, repair: Omit<Repair, 'id'>) => {
    const repairId = `rep${Date.now()}`;
    const fullRepair: Repair = { ...repair, id: repairId };

    await supabase.from('repairs').insert({
      id:              repairId,
      hold_id:         holdId,
      repaired_by_id:  repair.repairedById,
      repaired_at:     repair.repairedAt,
      notes:           repair.notes,
    });
    await supabase.from('holds').update({ status: 'REPAIRED' }).eq('id', holdId);

    const hold = holds.find(h => h.id === holdId);
    if (hold) {
      await supabase.from('vehicles').update({ status: 'CLEAR' }).eq('id', hold.vehicleId);
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

  return (
    <GarageContext.Provider value={{
      vehicles, holds, loading,
      getVehicle, getVehicleByUnit,
      getHoldsForVehicle, getActiveHold,
      addVehicle, addHold, addRelease, addPhotosToHold, markRepaired,
    }}>
      {children}
    </GarageContext.Provider>
  );
}

export function useGarage(): GarageContextValue {
  const ctx = useContext(GarageContext);
  if (!ctx) throw new Error('useGarage must be used within GarageProvider');
  return ctx;
}
