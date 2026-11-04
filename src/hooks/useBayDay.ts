// Lot Lookout's day record (docs/ticket-lot-lookout-bay-log.md, Phase 2): for the day he's looking at, that day's crew
// blocks (his shift, the VSAs on, numbers only) and, for an EARLIER day, its bay log. Today's bay log stays live in
// useBayLog; an earlier day is history, read once. ‹ › walks back through his days: *"let's keep a daily record of the
// day as well"* (2026-10-29).
//
// Each answer is kept with the day it belongs to, so stepping days never shows one day's crew under another's heading
// (and nothing is reset synchronously inside an effect).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { rowToShiftBase } from '../lib/rowToShift';
import { bayDayCrew, type BayDayCrew } from '../lib/bayCrewBlocks';
import { BAY_LOG_COLUMNS, type BayLogRow } from '../lib/lotBayLog';
import { useProfiles } from '../context/ProfilesContext';
import type { Shift } from '../types';

export interface BayDay {
  /** Null while the day's schedule loads (or with nobody signed in). */
  crew: BayDayCrew | null;
  /** An earlier day's rows; null while loading, and always null for today (the live log has those). */
  pastRows: BayLogRow[] | null;
  error: string | null;
  /** A row saved from this day's list (a note, a hold link): it replaces the one shown. */
  replaceRow: (row: BayLogRow) => void;
}

export function useBayDay(day: string, me: string | null, isToday: boolean): BayDay {
  const profiles = useProfiles();
  const [shifts, setShifts] = useState<{ day: string; rows: Shift[] } | null>(null);
  const [past, setPast] = useState<{ day: string; rows: BayLogRow[] } | null>(null);
  const [error, setError] = useState<{ day: string; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase.from('shifts').select('*').eq('date', day).then(({ data, error: e }) => {
      if (cancelled) return;
      if (e) setError({ day, text: 'The schedule for that day did not load.' });
      setShifts({ day, rows: (data ?? []).map(r => rowToShiftBase(r as Record<string, unknown>)) });
    });
    if (!isToday) {
      void supabase.from('lot_bay_log').select(BAY_LOG_COLUMNS).eq('shift_day', day).order('started_at').then(({ data, error: e }) => {
        if (cancelled) return;
        if (e && e.code !== '42P01') setError({ day, text: 'That day\'s bay log did not load.' });
        setPast({ day, rows: (data ?? []) as BayLogRow[] });
      });
    }
    return () => { cancelled = true; };
  }, [day, isToday]);

  const dayShifts = shifts?.day === day ? shifts.rows : null;
  const crew = useMemo(
    () => (dayShifts && me ? bayDayCrew(dayShifts, me, id => profiles.get(id)?.role ?? null) : null),
    [dayShifts, me, profiles],
  );
  const replaceRow = useCallback((row: BayLogRow) => setPast(p => (p ? { ...p, rows: p.rows.map(x => (x.id === row.id ? row : x)) } : p)), []);
  return { crew, pastRows: isToday ? null : past?.day === day ? past.rows : null, error: error?.day === day ? error.text : null, replaceRow };
}
