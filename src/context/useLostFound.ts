import { useState, useMemo } from 'react';
import type { LostFoundItem, LostFoundLocation, LostFoundStatus, BranchId } from '../types';
import type { User } from '../types';
import { supabase } from '../lib/supabase';
import { uploadLostFoundPhoto } from '../lib/garage-uploads';

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
}

export function useLostFound(
  user: User | null,
  activeBranch: BranchId | 'ALL',
  allVehicles: { licensePlate: string; unitNumber: string; year: number; make: string; model: string }[],
): LostFoundSlice & { setAllLostFoundItems: React.Dispatch<React.SetStateAction<LostFoundItem[]>> } {
  const [allLostFoundItems, setAllLostFoundItems] = useState<LostFoundItem[]>([]);

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

    let unitNumber = data.unitNumber;
    let vehicleMake: string | undefined;
    if (data.licensePlate) {
      const matched = allVehicles.find(
        v => v.licensePlate.toLowerCase() === data.licensePlate!.toLowerCase()
      );
      if (matched) {
        unitNumber = matched.unitNumber;
        vehicleMake = `${matched.year} ${matched.make} ${matched.model}`;
      }
    }

    const [keyTagPhotoUrl, itemPhotoUrl] = await Promise.all([
      data.keyTagPhoto ? uploadLostFoundPhoto(data.keyTagPhoto, itemId, 'key-tag') : Promise.resolve(null),
      data.itemPhoto   ? uploadLostFoundPhoto(data.itemPhoto,   itemId, 'item')    : Promise.resolve(null),
    ]);

    try {
      const { error } = await supabase.from('lost_found').insert({
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
      });
      if (error) return false;
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
      const { error } = await supabase.from('lost_found').update({
        status,
        ...(notes !== undefined ? { notes } : {}),
        ...(resolvedAt ? { resolved_at: resolvedAt } : {}),
      }).eq('id', id);
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

  return { lostFoundItems, addLostFoundItem, updateLostFoundStatus, setAllLostFoundItems };
}
