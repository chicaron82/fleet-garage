// Find a car in the bay log (docs/ticket-bay-log-find-a-car.md): every line for the plate he types, newest first. Read
// only. `days` limits the reach (the read-only link's 14, his ruling); FG passes none and searches the whole log.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { findKey, windowStart } from '../lib/bayFind';
import { BAY_LOG_COLUMNS, type BayLogRow } from '../lib/lotBayLog';
import { oZeroVariants } from '../lib/plateFold';

/** More than a car's whole history: three characters can match a few cars. */
const FIND_LIMIT = 40;

export interface BayFind { key: string | null; rows: BayLogRow[] | null; error: string | null }

export function useBayFind(typed: string, days?: number): BayFind {
  const key = findKey(typed);
  const [got, setGot] = useState<{ key: string; rows: BayLogRow[] | null; error: string | null } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    // A beat after the last keystroke, so a plate typed letter by letter asks once.
    const t = setTimeout(() => {
      // Contains, like the vehicle look-up ("117" finds MCN117). findKey leaves only [A-Z0-9], so each spelling is safe inside
      // the `or` filter (PostgREST spells % as * there). The log never has a space.
      const anyOf = oZeroVariants(key).map(v => `plate.ilike.*${v}*`).join(',');
      let q = supabase.from('lot_bay_log').select(BAY_LOG_COLUMNS).or(anyOf);
      if (days) q = q.gte('shift_day', windowStart(days));
      void q.order('started_at', { ascending: false }).limit(FIND_LIMIT).then(({ data, error }) => {
        if (cancelled) return;
        setGot({ key, rows: error ? null : (data ?? []) as BayLogRow[], error: error ? 'The search did not load. Try again.' : null });
      });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [key, days]);

  // A result belongs to the key it was asked for: while a new one is on its way, nothing stale shows.
  const mine = got && got.key === key ? got : null;
  return { key, rows: mine?.rows ?? null, error: mine?.error ?? null };
}
