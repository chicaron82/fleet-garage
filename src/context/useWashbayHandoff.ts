import { useState } from 'react';
import type { WashbayLog, HandoffNote, LotStatus, BranchId } from '../types';
import type { User } from '../types';
import { supabase } from '../lib/supabase';
import { mapWashbayLog, mapHandoffNote } from '../lib/garage-mappers';

export interface WashbayHandoffSlice {
  washbayLogs: WashbayLog[];
  handoffNotes: HandoffNote[];
  latestHandoff: HandoffNote | undefined;
  submitWashbayLog: (data: Omit<WashbayLog, 'id' | 'branchId' | 'date' | 'loggedById' | 'loggedAt'>) => Promise<boolean>;
  getTodayWashbayLog: () => WashbayLog | undefined;
  submitHandoff: (data: { fullPages: number; lastPageEntries: number; teamSize: number; lotStatus: LotStatus; notes?: string }) => Promise<boolean>;
}

export function useWashbayHandoff(
  user: User | null,
  activeBranch: BranchId | 'ALL',
): WashbayHandoffSlice & {
  setWashbayLogs: React.Dispatch<React.SetStateAction<WashbayLog[]>>;
  setHandoffNotes: React.Dispatch<React.SetStateAction<HandoffNote[]>>;
} {
  const [washbayLogs, setWashbayLogs] = useState<WashbayLog[]>([]);
  const [handoffNotes, setHandoffNotes] = useState<HandoffNote[]>([]);

  const latestHandoff = handoffNotes[0];

  const submitWashbayLog = async (
    data: Omit<WashbayLog, 'id' | 'branchId' | 'date' | 'loggedById' | 'loggedAt'>
  ): Promise<boolean> => {
    const branchId = activeBranch === 'ALL' ? 'YWG' : activeBranch;
    const date = new Date().toISOString().split('T')[0];
    const loggedAt = new Date().toISOString();
    try {
      const { data: row, error } = await supabase.from('washbay_logs').upsert({
        branch_id:           branchId,
        date,
        full_pages:          data.fullPages,
        last_page_entries:   data.lastPageEntries,
        cars_remaining:      data.carsRemaining,
        clean_not_picked_up: data.cleanNotPickedUp,
        team_size:           data.teamSize,
        shift_hours:         data.shiftHours,
        logged_by:           user!.id,
        logged_at:           loggedAt,
      }, { onConflict: 'branch_id, date' }).select().single();
      if (error) throw error;
      const newLog = mapWashbayLog(row);
      setWashbayLogs(prev => {
        const filtered = prev.filter(l => !(l.branchId === branchId && l.date === date));
        return [newLog, ...filtered];
      });
      return true;
    } catch (err) {
      console.error('Failed to submit washbay log:', err);
      return false;
    }
  };

  const getTodayWashbayLog = (): WashbayLog | undefined => {
    const today = new Date().toISOString().split('T')[0];
    return washbayLogs.find(l => l.date === today);
  };

  const submitHandoff = async (data: {
    fullPages: number;
    lastPageEntries: number;
    teamSize: number;
    lotStatus: LotStatus;
    notes?: string;
  }): Promise<boolean> => {
    const branchId = activeBranch === 'ALL' ? 'YWG' : activeBranch;
    const loggedAt = new Date().toISOString();
    try {
      const { data: row, error } = await supabase.from('handoff_notes').insert({
        branch_id:          branchId,
        logged_by:          user!.id,
        logged_by_name:     user!.name,
        logged_at:          loggedAt,
        full_pages:         data.fullPages,
        last_page_entries:  data.lastPageEntries,
        team_size:          data.teamSize,
        lot_status:         data.lotStatus,
        notes:              data.notes ?? null,
      }).select().single();
      if (error) throw error;
      setHandoffNotes(prev => [mapHandoffNote(row), ...prev]);
      return true;
    } catch (err) {
      console.error('Failed to submit handoff note:', err);
      return false;
    }
  };

  return { washbayLogs, handoffNotes, latestHandoff, submitWashbayLog, getTodayWashbayLog, submitHandoff, setWashbayLogs, setHandoffNotes };
}
