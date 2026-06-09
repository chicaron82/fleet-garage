import { useState, useMemo } from 'react';
import type { LostFoundItem, LostFoundLocation, LostFoundStatus, BranchId } from '../types';
import type { User } from '../types';
import { supabase, writeWithRefresh } from '../lib/supabase';
import { uploadLostFoundPhoto } from '../lib/garage-uploads';
import { useVehicleByPlate } from '../hooks/useVehicleByPlate';

export interface LostFoundSlice {
  lostFoundItems: LostFoundItem[];
  addLostFoundItem: (data: {
    keyTagPhoto?: string;
    itemPhoto?: string;
    description?: string;
    location?: LostFoundLocation;
    licensePlate?: string;
    unitNumber?: string;
    notes?: string;
  }) => Promise<boolean>;
  updateLostFoundStatus: (id: string, status: LostFoundStatus, notes?: string) => Promise<boolean>;
  updateLostFoundItem: (id: string, patch: {
    description: string;
    location: LostFoundLocation | null;
    licensePlate: string;
    notes: string;
    editedByName: string;
    keyTagPhoto?: string;
    itemPhoto?: string;
  }) => Promise<boolean>;
}

export function useLostFound(
  user: User | null,
  activeBranch: BranchId | 'ALL',
): LostFoundSlice & { setAllLostFoundItems: React.Dispatch<React.SetStateAction<LostFoundItem[]>> } {
  const [allLostFoundItems, setAllLostFoundItems] = useState<LostFoundItem[]>([]);
  const { resolve, remember } = useVehicleByPlate();

  const lostFoundItems = useMemo(() => {
    if (activeBranch === 'ALL') return allLostFoundItems;
    return allLostFoundItems.filter(i => i.branchId === activeBranch);
  }, [allLostFoundItems, activeBranch]);

  const addLostFoundItem = async (data: {
    keyTagPhoto?: string;
    itemPhoto?: string;
    description?: string;
    location?: LostFoundLocation;
    licensePlate?: string;
    unitNumber?: string;
    notes?: string;
  }): Promise<boolean> => {
    if (!user) return false;
    const itemId = crypto.randomUUID();
    const branchId = activeBranch === 'ALL' ? 'YWG' : activeBranch;
    const foundAt = new Date().toISOString();

    // Resolve the plate through the shared primitive: a fleet match (any branch)
    // wins, else a remembered registry sighting — so a plate logged once is
    // recognized here and everywhere after.
    let unitNumber = data.unitNumber;
    let vehicleMake: string | undefined;
    let knownVehicleId: string | null = null;
    if (data.licensePlate) {
      const known = await resolve(data.licensePlate);
      if (known) {
        unitNumber = known.unitNumber ?? unitNumber;
        const veh = [known.year, known.make, known.model].filter(Boolean).join(' ');
        vehicleMake = veh || undefined;
        knownVehicleId = known.vehicleId;
      }
    }

    const [keyTagPhotoUrl, itemPhotoUrl] = await Promise.all([
      data.keyTagPhoto ? uploadLostFoundPhoto(data.keyTagPhoto, itemId, 'key-tag') : Promise.resolve(null),
      data.itemPhoto   ? uploadLostFoundPhoto(data.itemPhoto,   itemId, 'item')    : Promise.resolve(null),
    ]);

    try {
      const { error } = await writeWithRefresh(() =>
        supabase.from('lost_found').insert({
          id:            itemId,
          branch_id:     branchId,
          found_by:      user.id,
          found_by_name: user.name,
          found_at:      foundAt,
          key_tag_photo: keyTagPhotoUrl ?? null,
          item_photo:    itemPhotoUrl ?? null,
          description:   data.description ?? null,
          location:      data.location ?? null,
          license_plate: data.licensePlate ?? null,
          unit_number:   unitNumber ?? null,
          vehicle_make:  vehicleMake ?? null,
          status:        'holding',
          notes:         data.notes ?? null,
        })
      );
      if (error) return false;
      // Stage the plate so it's recognized next time — best-effort, links to the
      // fleet vehicle when one matched, else seeds a remembered identity.
      if (data.licensePlate) {
        void remember(data.licensePlate, { unitNumber: unitNumber ?? null, vehicleId: knownVehicleId });
      }
      const newItem: LostFoundItem = {
        id: itemId, branchId,
        foundById: user.id, foundByName: user.name, foundAt,
        keyTagPhotoUrl: keyTagPhotoUrl ?? undefined,
        itemPhotoUrl: itemPhotoUrl ?? undefined,
        description: data.description,
        location: data.location,
        licensePlate: data.licensePlate,
        unitNumber, vehicleMake,
        status: 'holding',
        notes: data.notes,
      };
      setAllLostFoundItems(prev => [newItem, ...prev]);
      return true;
    } catch {
      return false;
    }
  };

  const updateLostFoundStatus = async (id: string, status: LostFoundStatus, notes?: string): Promise<boolean> => {
    const resolvedAt = status === 'returned' ? new Date().toISOString() : undefined;
    try {
      const { error } = await writeWithRefresh(() =>
        supabase.from('lost_found').update({
          status,
          ...(notes !== undefined ? { notes } : {}),
          ...(resolvedAt ? { resolved_at: resolvedAt } : {}),
        }).eq('id', id)
      );
      if (error) return false;
      setAllLostFoundItems(prev => prev.map(i =>
        i.id !== id ? i : {
          ...i, status,
          ...(notes !== undefined ? { notes } : {}),
          ...(resolvedAt ? { resolvedAt } : {}),
        }
      ));
      return true;
    } catch {
      return false;
    }
  };

  const updateLostFoundItem = async (
    id: string,
    patch: { description: string; location: LostFoundLocation | null; licensePlate: string; notes: string; editedByName: string; keyTagPhoto?: string; itemPhoto?: string },
  ): Promise<boolean> => {
    const editedAt = new Date().toISOString();
    try {
      const [keyTagPhotoUrl, itemPhotoUrl] = await Promise.all([
        patch.keyTagPhoto ? uploadLostFoundPhoto(patch.keyTagPhoto, id, 'key-tag') : Promise.resolve(undefined),
        patch.itemPhoto   ? uploadLostFoundPhoto(patch.itemPhoto,   id, 'item')    : Promise.resolve(undefined),
      ]);
      const { error } = await writeWithRefresh(() =>
        supabase.from('lost_found').update({
          description:    patch.description   || null,
          location:       patch.location,
          license_plate:  patch.licensePlate  || null,
          notes:          patch.notes         || null,
          edited_by_name: patch.editedByName,
          edited_at:      editedAt,
          ...(keyTagPhotoUrl !== undefined ? { key_tag_photo: keyTagPhotoUrl } : {}),
          ...(itemPhotoUrl   !== undefined ? { item_photo:    itemPhotoUrl }   : {}),
        }).eq('id', id)
      );
      if (error) return false;
      setAllLostFoundItems(prev => prev.map(i =>
        i.id !== id ? i : {
          ...i,
          description:    patch.description  || undefined,
          location:       patch.location     ?? undefined,
          licensePlate:   patch.licensePlate || undefined,
          notes:          patch.notes        || undefined,
          editedByName:   patch.editedByName,
          editedAt,
          ...(keyTagPhotoUrl != null ? { keyTagPhotoUrl } : {}),
          ...(itemPhotoUrl   != null ? { itemPhotoUrl }   : {}),
        }
      ));
      return true;
    } catch {
      return false;
    }
  };

  return { lostFoundItems, addLostFoundItem, updateLostFoundStatus, updateLostFoundItem, setAllLostFoundItems };
}
