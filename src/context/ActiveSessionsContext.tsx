import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { othSessionLabel } from '../lib/activeSessions';
import type { OffStandardReason, OffStandardPresetReason } from '../types';

// Both the trip and the off-standard timer live inside the movement-log screen
// (as tabs). The active tab lives here so a pill tap (fired from anywhere in the
// shell) can select the right tab as controlled state — no consume-and-clear
// signal, no effect in the view.
export type FocusTab = 'movement-log' | 'off-standard';

export interface ActiveSession {
  id:        string;
  startedAt: string;
  label:     string;
  emoji:     string;
}

interface ActiveSessionsValue {
  trip:           ActiveSession | null;
  oth:            ActiveSession | null;
  refresh:        () => void;
  movementTab:    FocusTab;
  setMovementTab: (tab: FocusTab) => void;
}

const ActiveSessionsContext = createContext<ActiveSessionsValue | null>(null);

// Slow safety-net poll. The pill ticks elapsed locally every second; the DB is
// only consulted for *whether* a session is active, so a 15s poll (plus the
// explicit refresh() the modules fire on start/stop) keeps it current without
// per-second churn. The poll is what catches a forgotten session begun in
// another tab — the exact bug this feature exists for.
const POLL_MS = 15_000;

/**
 * Tracks the current user's active trip + off-standard session by reading the
 * in_progress rows (vsa_trips by driver_id, off_standard_entries by user_id) —
 * the same rows the modules recover from. Lifting this to the app shell lets the
 * persistent pill render outside whichever module owns the timer.
 */
export function ActiveSessionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [trip, setTrip]               = useState<ActiveSession | null>(null);
  const [oth, setOth]                 = useState<ActiveSession | null>(null);
  const [movementTab, setMovementTab] = useState<FocusTab>('movement-log');

  const refresh = useCallback(async () => {
    if (!userId) { setTrip(null); setOth(null); return; }
    const [tripRes, othRes] = await Promise.all([
      supabase.from('vsa_trips')
        .select('id, depart_time')
        .eq('driver_id', userId).eq('status', 'in_progress')
        .order('depart_time', { ascending: false }).limit(1),
      supabase.from('off_standard_entries')
        .select('id, start_time, reason, preset_reason')
        .eq('user_id', userId).eq('status', 'in_progress')
        .order('start_time', { ascending: false }).limit(1),
    ]);
    const t = tripRes.data?.[0];
    setTrip(t ? { id: t.id, startedAt: t.depart_time, label: 'In Transit', emoji: '🚗' } : null);
    const o = othRes.data?.[0];
    setOth(o ? {
      id:        o.id,
      startedAt: o.start_time,
      label:     othSessionLabel(o.reason as OffStandardReason, (o.preset_reason as OffStandardPresetReason | null) ?? null),
      emoji:     '⏱',
    } : null);
  }, [userId]);

  // Sync with the DB (the external system that owns active-ness): prime on mount/
  // user change, then poll. refresh()'s setState is post-await (async), so this is
  // not the synchronous-cascade the rule guards against — disabled deliberately.
  useEffect(() => {
    void refresh(); // eslint-disable-line react-hooks/set-state-in-effect
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <ActiveSessionsContext.Provider
      value={{ trip, oth, refresh: () => void refresh(), movementTab, setMovementTab }}
    >
      {children}
    </ActiveSessionsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useActiveSessions(): ActiveSessionsValue {
  const ctx = useContext(ActiveSessionsContext);
  if (!ctx) throw new Error('useActiveSessions must be used within ActiveSessionsProvider');
  return ctx;
}
