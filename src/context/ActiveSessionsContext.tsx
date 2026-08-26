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
  /** Shared elapsed-time tick — single interval for all pill consumers. */
  nowMs:          number;
  refresh:        () => void;
  movementTab:    FocusTab;
  setMovementTab: (tab: FocusTab) => void;
  /** ⚠️ A PENDING INTENT, NOT A COUNTER — and the difference is the whole bug.
   *
   *  This was `openingDutiesTrigger: number`, bumped on tap and compared by the consumer against a
   *  `useRef` snapshot. That works for the airport-flip sibling, whose trigger is a prop bumped on a
   *  screen ALREADY MOUNTED. It cannot work here: the My Day quick-start bumps the number and then
   *  NAVIGATES, so OffStandardTimeLog mounts afterwards and seeds its ref to the already-bumped
   *  value — the effect sees "no change" and returns. **The ref's initialisation consumed the very
   *  signal it existed to detect**, and the card's own "Starts the timer" subtitle was a promise the
   *  code could not keep (Aaron, 2026-08-26: *"start opening duties is supposed to start the timer,
   *  but currently doesn't"*).
   *
   *  A boolean the CONSUMER clears is immune to mount order: the intent survives the navigation and
   *  is extinguished by the thing that acts on it, not by a snapshot taken at an arbitrary moment.
   *
   *  ⚠️ And it must NOT simply be "trigger > 0", which would auto-start a timer every time he walks
   *  into the movement log for his own reasons. */
  openingDutiesPending: boolean;
  signalOpeningDuties:  () => void;
  /** Called by whoever acts on the intent — always, even when the gate refuses to start a timer,
   *  so a signal fired while he is mid-task is dropped rather than firing late (the same
   *  consume-regardless rule the flip auto-start documents). */
  consumeOpeningDuties: () => void;
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
  const [openingDutiesPending, setOpeningDutiesPending] = useState(false);
  const signalOpeningDuties  = useCallback(() => setOpeningDutiesPending(true), []);
  const consumeOpeningDuties = useCallback(() => setOpeningDutiesPending(false), []);
  const [nowMs, setNowMs]             = useState(() => Date.now());

  // One elapsed-time tick shared across all pill consumers — no duplicate intervals.
  const hasTrip = trip !== null;
  const hasOth  = oth  !== null;
  useEffect(() => {
    if (!hasTrip && !hasOth) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasTrip, hasOth]);

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
      value={{ trip, oth, nowMs, refresh: () => void refresh(), movementTab, setMovementTab, openingDutiesPending, signalOpeningDuties, consumeOpeningDuties }}
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
