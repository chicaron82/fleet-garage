// One tap on the header pill ENDS the session (docs/ticket-pill-tap-ends-session.md). Aaron, 2026-11-09: *"just end it
// on tap since that's really what I need to do"*, for the off-standard timer and *"the same for movement log when making
// trips to the airport"*.
//
// • The tap reads the session's row and plans (lib/pillEnd). Anything the card would have asked about opens the card,
//   as the pill always did; so does a read that fails (no signal).
// • The end is HELD for PILL_UNDO_MS with Undo, then written at the TAP's time. Undo writes nothing, so a run he took
//   back never sends the managers' long-run alert.
// • The write goes through the mounted card's own End when there is one (registerEnder), else headless from the row.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useActiveSessions, type ActiveSession, type SessionKind } from '../context/ActiveSessionsContext';
import { PILL_UNDO_MS, othPillPlan, tripPillPlan, type PillPlan } from '../lib/pillEnd';
import { endOthHeadless, endTripHeadless, PILL_OTH_COLS, PILL_TRIP_COLS, type PillOthRow, type PillTripRow } from '../lib/sessionEndHeadless';
import { localDateStr } from './useFleetBalance';
import { hapticLight } from '../lib/haptics';

const SAID_MS = 2500;

export interface PillHeld { chip: string; label: string }
export interface PillSaid { text: string; ok: boolean }

export function usePillEnd(open: (kind: SessionKind) => void) {
  const { user } = useAuth();
  const { refresh, enderFor } = useActiveSessions();
  const [held, setHeld] = useState<Partial<Record<SessionKind, PillHeld>>>({});
  const [said, setSaid] = useState<Partial<Record<SessionKind, PillSaid>>>({});
  const timers = useRef<Partial<Record<SessionKind, ReturnType<typeof setTimeout>>>>({});
  const busy = useRef<Partial<Record<SessionKind, boolean>>>({});
  useEffect(() => () => { Object.values(timers.current).forEach(t => t && clearTimeout(t)); }, []);

  const sayFor = useCallback((kind: SessionKind, s: PillSaid | null) => {
    setSaid(p => ({ ...p, [kind]: s ?? undefined }));
    if (s) setTimeout(() => setSaid(p => (p[kind] === s ? { ...p, [kind]: undefined } : p)), SAID_MS);
  }, []);

  const commit = useCallback(async (kind: SessionKind, row: PillTripRow | PillOthRow, plan: Extract<PillPlan, { kind: 'end' }>, at: string) => {
    timers.current[kind] = undefined;
    const ender = enderFor(kind);
    let ok = false;
    try {
      ok = ender ? await ender(at)
        : kind === 'trip' ? (user ? await endTripHeadless(row as PillTripRow, at, user, localDateStr(0)) : false)
        : await endOthHeadless(row as PillOthRow, at);
    } catch (e) {
      console.error('[usePillEnd]', e);
    }
    setHeld(p => ({ ...p, [kind]: undefined }));
    busy.current[kind] = false;
    refresh();
    sayFor(kind, ok ? { text: plan.logs ? '✓ Saved' : 'Not logged', ok } : { text: '⚠ Not saved', ok });
  }, [enderFor, refresh, sayFor, user]);

  const tap = useCallback(async (kind: SessionKind, s: ActiveSession) => {
    if (busy.current[kind]) return;
    // A failed end's chip opens the card, where End can be tried again with the reason on screen.
    if (said[kind] && !said[kind]!.ok) { sayFor(kind, null); open(kind); return; }
    busy.current[kind] = true;
    hapticLight();
    const nowMs = Date.now();
    const { data, error } = kind === 'trip'
      ? await supabase.from('vsa_trips').select(PILL_TRIP_COLS).eq('id', s.id).is('voided_at', null).maybeSingle() // a voided send did not happen
      : await supabase.from('off_standard_entries').select(PILL_OTH_COLS).eq('id', s.id).maybeSingle();
    const row = data as unknown as PillTripRow | PillOthRow | null;
    if (error || !row) { busy.current[kind] = false; open(kind); return; }
    if (row.status !== 'in_progress') { busy.current[kind] = false; refresh(); return; }
    const plan = kind === 'trip' ? tripPillPlan(row as PillTripRow, nowMs) : othPillPlan(row as PillOthRow, nowMs);
    if (plan.kind === 'open') { busy.current[kind] = false; open(kind); return; }
    const at = new Date(nowMs).toISOString();
    setHeld(p => ({ ...p, [kind]: { chip: plan.chip, label: plan.label } }));
    timers.current[kind] = setTimeout(() => void commit(kind, row, plan, at), PILL_UNDO_MS);
  }, [commit, open, refresh, said, sayFor]);

  const undo = useCallback((kind: SessionKind) => {
    const t = timers.current[kind];
    if (!t) return;
    clearTimeout(t);
    timers.current[kind] = undefined;
    busy.current[kind] = false;
    hapticLight();
    setHeld(p => ({ ...p, [kind]: undefined }));
  }, []);

  return { held, said, tap, undo };
}
