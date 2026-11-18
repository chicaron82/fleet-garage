import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { othSessionLabel } from '../lib/activeSessions';
import type { OffStandardReason, OffStandardPresetReason } from '../types';

// Both the trip and the off-standard timer live inside the movement-log screen
// (as tabs). The active tab lives here so a pill tap (fired from anywhere in the
// shell) can select the right tab as controlled state — no consume-and-clear
// signal, no effect in the view.
export type FocusTab = 'movement-log' | 'off-standard';

/** Which session a pill is for. */
export type SessionKind = 'trip' | 'oth';
/** A mounted card's own End, run by the header pill at the tap's time (docs/ticket-pill-tap-ends-session.md). */
export type SessionEnder = (atIso: string) => Promise<boolean>;

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
  /** Both movement-log cards stay mounted across its tabs, so the pill ends THROUGH a mounted card (never behind its
   *  back, which would leave it showing a trip in transit that has ended). A card registers while its session runs. */
  registerEnder: (kind: SessionKind, fn: SessionEnder | null) => void;
  enderFor:      (kind: SessionKind) => SessionEnder | null;
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
  const enders = useRef<Record<SessionKind, SessionEnder | null>>({ trip: null, oth: null });
  const registerEnder = useCallback((kind: SessionKind, fn: SessionEnder | null) => { enders.current[kind] = fn; }, []);
  const enderFor = useCallback((kind: SessionKind) => enders.current[kind], []);

  // One elapsed-time tick shared across all pill consumers — no duplicate intervals.
  const hasTrip = trip !== null;
  const hasOth  = oth  !== null;
  useEffect(() => {
    if (!hasTrip && !hasOth) return;
    // Hidden: no per-second re-render nobody can see (the battery ticket above); the first visible tick catches up.
    const id = setInterval(() => { if (document.visibilityState === 'visible') setNowMs(Date.now()); }, 1000);
    return () => clearInterval(id);
  }, [hasTrip, hasOth]);

  const refresh = useCallback(async () => {
    if (!userId) { setTrip(null); setOth(null); return; }
    const [tripRes, othRes] = await Promise.all([
      supabase.from('vsa_trips')
        .select('id, depart_time')
        .is('voided_at', null)   // a voided send did not happen
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
  //
  // ⭐ Sleeps while FG is hidden (2026-11-18, docs/ticket-battery-poll-sleeps-when-hidden.md). Aaron: *"using FG more to
  // keep the bay log updated is draining my batter"*. This provider is app-wide, so the poll ran on every screen, pocketed
  // or not. Now a hidden tick does nothing, and coming back reads once right away, so the pill is never stale when he
  // looks. Same shape as useFleetSync.
  useEffect(() => {
    void refresh(); // eslint-disable-line react-hooks/set-state-in-effect
    const visible = () => document.visibilityState === 'visible';
    const id = setInterval(() => { if (visible()) void refresh(); }, POLL_MS);
    const onVisible = () => { if (visible()) void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh]);

  return (
    <ActiveSessionsContext.Provider
      value={{ trip, oth, nowMs, refresh: () => void refresh(), movementTab, setMovementTab, openingDutiesPending, signalOpeningDuties, consumeOpeningDuties, registerEnder, enderFor }}
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
