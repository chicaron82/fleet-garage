import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { mapWashbayLog, mapHandoffNote, mapCheckpoint } from '../lib/garage-mappers';
import { useWashbayHandoff, type WashbayHandoffSlice } from './useWashbayHandoff';
import { useShiftCheckpoints, type ShiftCheckpointsSlice } from './useShiftCheckpoints';

export type WashbayContextValue = WashbayHandoffSlice & ShiftCheckpointsSlice & { loadError: boolean; reload: () => void };

const WashbayContext = createContext<WashbayContextValue | null>(null);

export function WashbayProvider({ children }: { children: React.ReactNode }) {
  const { user, activeBranch } = useAuth();
  const { setWashbayLogs, setHandoffNotes, ...washbaySlice } = useWashbayHandoff(user, activeBranch);
  const { setShiftCheckpoints, ...checkpointsSlice } = useShiftCheckpoints(user, activeBranch);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  function reload() { setLoadError(false); setLoadAttempt(a => a + 1); }

  // ── Initial data load ────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      supabase.from('washbay_logs').select('*').order('date', { ascending: false }).limit(30),
      supabase.from('handoff_notes').select('*').order('logged_at', { ascending: false }).limit(20),
      supabase.from('shift_checkpoints').select('*').order('logged_at', { ascending: false }).limit(30),
    ]).then(([{ data: wData, error: wErr }, { data: nData, error: nErr }, { data: cpData, error: cpErr }]) => {
      if (wErr ?? nErr ?? cpErr) {
        console.error('[WashbayContext] Initial load failed:', wErr ?? nErr ?? cpErr);
        setLoadError(true);
      }
      if (wData) setWashbayLogs(wData.map(mapWashbayLog));
      if (nData) setHandoffNotes(nData.map(mapHandoffNote));
      if (cpData) setShiftCheckpoints(cpData.map(mapCheckpoint));
    });
  }, [loadAttempt]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime checkpoint subscription ─────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('washbay-checkpoints-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shift_checkpoints' }, (payload) => {
        const cp = mapCheckpoint(payload.new as Record<string, unknown>);
        setShiftCheckpoints(prev =>
          prev.some(c => c.id === cp.id)
            ? prev.map(c => c.id === cp.id ? cp : c)
            : [cp, ...prev]
        );
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <WashbayContext.Provider value={{ ...washbaySlice, ...checkpointsSlice, loadError, reload }}>
      {children}
    </WashbayContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWashbayContext(): WashbayContextValue {
  const ctx = useContext(WashbayContext);
  if (!ctx) throw new Error('useWashbayContext must be used within WashbayProvider');
  return ctx;
}
