import { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import type { Vehicle, Hold, Release, Repair, HoldType, DetailReason, MechanicalSubType } from '../types';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { mapVehicle, mapHold } from '../lib/garage-mappers';
import { useVehicleOperations } from './useVehicleOperations';
import { isStaleHold } from '../lib/holdFilters';

export interface VehicleHoldContextValue {
  vehicles: Vehicle[];
  allVehicles: Vehicle[];
  holds: Hold[];
  staleHolds: Hold[];
  loading: boolean;
  loadError: boolean;
  reload: () => void;
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

const VehicleHoldContext = createContext<VehicleHoldContextValue | null>(null);

export function VehicleHoldProvider({ children }: { children: React.ReactNode }) {
  const { user, activeBranch } = useAuth();
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  const [allHolds, setAllHolds] = useState<Hold[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [shuttlePlate, setShuttlePlate] = useState('KUR 261');

  function reload() { setLoadError(false); setLoading(true); setLoadAttempt(a => a + 1); }

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

  // ── Initial data load ────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [{ data: vData }, { data: hData }] = await Promise.all([
          supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
          supabase.from('holds').select('*, releases(*), repairs(*)').order('flagged_at', { ascending: false }),
        ]);
        setAllVehicles((vData ?? []).map(mapVehicle));
        setAllHolds((hData ?? []).map(mapHold));
      } catch (err) {
        console.error('[VehicleHoldContext] Initial load failed:', err);
        setLoadError(true);
      }
      setLoading(false);
    }
    load();
  }, [loadAttempt]);

  // ── Realtime holds subscription ──────────────────────────────────────────────
  const allHoldsRef = useRef(allHolds);
  useEffect(() => { allHoldsRef.current = allHolds; });

  useEffect(() => {
    const refetch = async (id: string) => {
      const { data } = await supabase
        .from('holds')
        .select('*, releases(*), repairs(*)')
        .eq('id', id)
        .single();
      return data ? mapHold(data) : null;
    };

    const channel = supabase
      .channel('vehicle-holds-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'holds' }, (payload) => {
        const id = (payload.new as { id: string }).id;
        if (allHoldsRef.current.some(h => h.id === id)) return;
        void refetch(id).then(hold => {
          if (!hold) return;
          setAllHolds(prev => prev.some(h => h.id === hold.id) ? prev : [hold, ...prev]);
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'holds' }, async (payload) => {
        const hold = await refetch((payload.new as { id: string }).id);
        if (!hold) return;
        setAllHolds(prev => prev.map(h => h.id === hold.id ? hold : h));
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, []);

  // ── Computed values ──────────────────────────────────────────────────────────
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

  const staleHolds = useMemo(() => holds.filter(h => isStaleHold(h)), [holds]);

  // ── Vehicle & hold write operations (extracted hook) ─────────────────────────
  const ops = useVehicleOperations({
    allVehicles, holds, activeBranch,
    userId: user?.id ?? '',
    userName: user?.name ?? '',
    setAllVehicles, setAllHolds,
  });

  return (
    <VehicleHoldContext.Provider value={{
      vehicles, allVehicles, holds, staleHolds, loading, loadError, reload,
      getVehicle, getVehicleByUnit,
      getHoldsForVehicle, getActiveHold, releaseStreak,
      ...ops,
      archivedVehicles,
      shuttlePlate, setShuttlePlate,
    }}>
      {children}
    </VehicleHoldContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useVehicleHoldContext(): VehicleHoldContextValue {
  const ctx = useContext(VehicleHoldContext);
  if (!ctx) throw new Error('useVehicleHoldContext must be used within VehicleHoldProvider');
  return ctx;
}
