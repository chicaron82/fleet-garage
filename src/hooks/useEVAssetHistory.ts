import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { EvSource } from '../types';

export interface EVAssetUpdate {
  id:            string;
  vehicleId:     string;
  updatedBy:     string;
  source:        EvSource;
  cableStatus:   'present' | 'missing' | null;
  adapterStatus: 'present' | 'missing' | null;
  notes:         string | null;
  createdAt:     string;
}

export function useEVAssetHistory(vehicleId: string) {
  const [history,  setHistory]  = useState<EVAssetUpdate[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('ev_asset_updates')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false })
      .limit(50);
    setHistory(
      (data ?? []).map(r => ({
        id:            r.id,
        vehicleId:     r.vehicle_id,
        updatedBy:     r.updated_by,
        source:        r.source as EvSource,
        cableStatus:   r.cable_status   as 'present' | 'missing' | null,
        adapterStatus: r.adapter_status as 'present' | 'missing' | null,
        notes:         r.notes,
        createdAt:     r.created_at,
      }))
    );
    setLoading(false);
  }, [vehicleId]);

  const toggle = () => {
    setExpanded(e => {
      if (!e) void load();
      return !e;
    });
  };

  return { history, loading, expanded, toggle };
}
