import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVehicleHoldContext } from '../context/VehicleHoldContext';
import { lookupRegistryAnyDate, createOrEnrichRegistry } from '../lib/vehicleRegistry';
import { normalizePlate, pickKnownVehicle, type KnownPlate } from '../lib/vehicleByPlate';
import type { VehicleRegistryEntry } from '../types';

interface RememberFields {
  unitNumber?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  color?: string | null;
  vehicleId?: string | null;
}

/**
 * The shared "find-or-remember a vehicle by plate" primitive. One place for the
 * lookup precedence (canonical fleet wins over a staged registry sighting), and
 * one place that stages an unknown plate so it's recognized next time — instead
 * of each surface (Lost & Found, EDV, …) hand-rolling `allVehicles.find(...)`.
 */
export function useVehicleByPlate() {
  const { user } = useAuth();
  const { vehicles } = useVehicleHoldContext();

  // Resolve a plate to its best-known identity: instant canonical-fleet match
  // first, then the cross-date registry memory. Null when unknown to both.
  const resolve = useCallback(async (rawPlate: string): Promise<KnownPlate | null> => {
    const plate = normalizePlate(rawPlate);
    if (!plate) return null;
    const fleet = pickKnownVehicle(plate, vehicles, null);
    if (fleet) return fleet;
    if (!user) return null;
    const entry = await lookupRegistryAnyDate(plate, user.branchId);
    return pickKnownVehicle(plate, vehicles, entry);
  }, [vehicles, user]);

  // Stage a plate (creating or enriching its registry entry) so it's remembered.
  // Idempotent per day via createOrEnrichRegistry's find-or-enrich path.
  const remember = useCallback(async (
    rawPlate: string,
    fields: RememberFields = {},
  ): Promise<VehicleRegistryEntry | null> => {
    const plate = normalizePlate(rawPlate);
    if (!plate || !user) return null;
    return createOrEnrichRegistry({ branchId: user.branchId, plate, ...fields });
  }, [user]);

  return { resolve, remember };
}
