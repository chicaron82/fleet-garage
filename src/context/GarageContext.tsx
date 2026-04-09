import { createContext, useContext, useState, useEffect } from 'react';
import type { Vehicle, Hold, Release } from '../types';
import { VEHICLES, HOLDS } from '../data/mock';

const LS_VEHICLES = 'fg_vehicles';
const LS_HOLDS    = 'fg_holds';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

interface GarageContextValue {
  vehicles: Vehicle[];
  holds: Hold[];
  getVehicle: (id: string) => Vehicle | undefined;
  getVehicleByUnit: (unitNumber: string) => Vehicle | undefined;
  getHoldsForVehicle: (vehicleId: string) => Hold[];
  getActiveHold: (vehicleId: string) => Hold | undefined;
  addVehicle: (vehicle: Omit<Vehicle, 'id' | 'status'>) => string;
  addHold: (vehicleId: string, damageDescription: string, notes: string, flaggedById: string) => void;
  addRelease: (holdId: string, release: Omit<Release, 'id'>) => void;
}

const GarageContext = createContext<GarageContextValue | null>(null);

export function GarageProvider({ children }: { children: React.ReactNode }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => load(LS_VEHICLES, VEHICLES));
  const [holds, setHolds] = useState<Hold[]>(() => load(LS_HOLDS, HOLDS));

  useEffect(() => { localStorage.setItem(LS_VEHICLES, JSON.stringify(vehicles)); }, [vehicles]);
  useEffect(() => { localStorage.setItem(LS_HOLDS,    JSON.stringify(holds));    }, [holds]);

  const getVehicle = (id: string) => vehicles.find(v => v.id === id);

  const getVehicleByUnit = (unitNumber: string) =>
    vehicles.find(v => v.unitNumber.toLowerCase() === unitNumber.toLowerCase());

  const getHoldsForVehicle = (vehicleId: string) =>
    holds.filter(h => h.vehicleId === vehicleId)
         .sort((a, b) => new Date(b.flaggedAt).getTime() - new Date(a.flaggedAt).getTime());

  const getActiveHold = (vehicleId: string) =>
    holds.find(h => h.vehicleId === vehicleId && h.status === 'ACTIVE');

  const addVehicle = (vehicle: Omit<Vehicle, 'id' | 'status'>): string => {
    const id = `v${Date.now()}`;
    setVehicles(prev => [...prev, { ...vehicle, id, status: 'IN_FLEET' }]);
    return id;
  };

  const addHold = (
    vehicleId: string,
    damageDescription: string,
    notes: string,
    flaggedById: string,
  ) => {
    const newHold: Hold = {
      id: `h${Date.now()}`,
      vehicleId,
      damageDescription,
      flaggedById,
      flaggedAt: new Date().toISOString(),
      notes,
      status: 'ACTIVE',
    };
    setHolds(prev => [...prev, newHold]);
    setVehicles(prev => prev.map(v => v.id === vehicleId ? { ...v, status: 'HELD' } : v));
  };

  const addRelease = (holdId: string, release: Omit<Release, 'id'>) => {
    const fullRelease: Release = { ...release, id: `r${Date.now()}` };
    setHolds(prev => prev.map(h =>
      h.id === holdId ? { ...h, status: 'RELEASED', release: fullRelease } : h
    ));
    const hold = holds.find(h => h.id === holdId);
    if (hold) {
      setVehicles(prev => prev.map(v =>
        v.id === hold.vehicleId ? { ...v, status: 'OUT_ON_EXCEPTION' } : v
      ));
    }
  };

  return (
    <GarageContext.Provider value={{
      vehicles, holds,
      getVehicle, getVehicleByUnit,
      getHoldsForVehicle, getActiveHold,
      addVehicle, addHold, addRelease,
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
