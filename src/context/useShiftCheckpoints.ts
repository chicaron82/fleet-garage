import { useState } from 'react';
import type { ShiftCheckpoint, User, BranchId } from '../types';
import { supabase, writeWithRefresh } from '../lib/supabase';
import { mapCheckpoint } from '../lib/garage-mappers';

export interface ShiftCheckpointsSlice {
  shiftCheckpoints: ShiftCheckpoint[];
  getTodayCheckpoint: () => ShiftCheckpoint | null;
  getMidArrival: () => ShiftCheckpoint | null;
  getMidDeparture: () => ShiftCheckpoint | null;
  submitCheckpoint: (fullPages: number, lastPageEntries: number) => Promise<boolean>;
  submitMidCheckpoint: (
    type: 'mid_arrival' | 'mid_departure',
    fullPages: number,
    lastPageEntries: number
  ) => Promise<boolean>;
}

export function useShiftCheckpoints(
  user: User | null,
  activeBranch: BranchId | 'ALL'
): ShiftCheckpointsSlice & {
  setShiftCheckpoints: React.Dispatch<React.SetStateAction<ShiftCheckpoint[]>>;
} {
  const [shiftCheckpoints, setShiftCheckpoints] = useState<ShiftCheckpoint[]>([]);

  const getTodayCheckpoint = (): ShiftCheckpoint | null => {
    const today = new Date().toLocaleDateString('en-CA');
    return (
      shiftCheckpoints.find(
        (c) => c.date === today && c.checkpointType === 'closing_arrival'
      ) ?? null
    );
  };

  const getMidArrival = (): ShiftCheckpoint | null => {
    const today = new Date().toLocaleDateString('en-CA');
    return (
      shiftCheckpoints.find(
        (c) => c.date === today && c.checkpointType === 'mid_arrival'
      ) ?? null
    );
  };

  const getMidDeparture = (): ShiftCheckpoint | null => {
    const today = new Date().toLocaleDateString('en-CA');
    return (
      shiftCheckpoints.find(
        (c) => c.date === today && c.checkpointType === 'mid_departure'
      ) ?? null
    );
  };

  const submitCheckpoint = async (
    fullPages: number,
    lastPageEntries: number
  ): Promise<boolean> => {
    const today = new Date().toLocaleDateString('en-CA');
    const branchId = activeBranch === 'ALL' ? 'YWG' : activeBranch;
    const { data, error } = await writeWithRefresh(() =>
      supabase
        .from('shift_checkpoints')
        .upsert(
          {
            branch_id: branchId,
            date: today,
            checkpoint_type: 'closing_arrival',
            full_pages: fullPages,
            last_page_entries: lastPageEntries,
            logged_by: user!.id,
            logged_at: new Date().toISOString(),
          },
          { onConflict: 'branch_id,date,checkpoint_type' }
        )
        .select()
        .single()
    );
    if (error) return false;
    if (data) {
      const mapped = mapCheckpoint(data as unknown as Record<string, unknown>);
      setShiftCheckpoints((prev) => {
        const idx = prev.findIndex((c) => c.id === mapped.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = mapped;
          return next;
        }
        return [mapped, ...prev];
      });
    }
    return true;
  };

  const submitMidCheckpoint = async (
    type: 'mid_arrival' | 'mid_departure',
    fullPages: number,
    lastPageEntries: number
  ): Promise<boolean> => {
    const today = new Date().toLocaleDateString('en-CA');
    const branchId = activeBranch === 'ALL' ? 'YWG' : activeBranch;
    const { data, error } = await writeWithRefresh(() =>
      supabase
        .from('shift_checkpoints')
        .upsert(
          {
            branch_id: branchId,
            date: today,
            checkpoint_type: type,
            full_pages: fullPages,
            last_page_entries: lastPageEntries,
            logged_by: user!.id,
            logged_at: new Date().toISOString(),
          },
          { onConflict: 'branch_id,date,checkpoint_type' }
        )
        .select()
        .single()
    );
    if (error) return false;
    if (data) {
      const mapped = mapCheckpoint(data as unknown as Record<string, unknown>);
      setShiftCheckpoints((prev) => {
        const idx = prev.findIndex((c) => c.id === mapped.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = mapped;
          return next;
        }
        return [mapped, ...prev];
      });
    }
    return true;
  };

  return {
    shiftCheckpoints,
    getTodayCheckpoint,
    getMidArrival,
    getMidDeparture,
    submitCheckpoint,
    submitMidCheckpoint,
    setShiftCheckpoints,
  };
}
