import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { businessDateOf } from '../lib/shiftDay';
import { OVERFLOW_DESTINATIONS } from '../../api/_lib/overflowProposal';
import { groupOverflowSends, type SentRow } from '../../api/_lib/overflowManifest';

/**
 * What went to the overflow spots on a given shift-day — the My Day card's rows.
 *
 * ⭐⭐ THE SAME ANSWER EFFIE GIVES. `groupOverflowSends` is Effie's `lookup_sent` grouping, imported
 * from the leaf module rather than re-implemented here: the day scope does NOT dedup (a car sent
 * twice is two moves), plates come first, and a VOIDED send never happened. Two implementations of
 * "what's at FastAir" is exactly the drift FG keeps paying for.
 *
 * ⚠️ `OVERFLOW_DESTINATIONS`, not the UI pair: 'Airport' is no longer offered as a destination but
 * history holds sends to it, and a manifest that silently dropped them would be wrong about the past.
 */
export interface OverflowSends {
  /** Groups for the day, e.g. { destination: 'FastAir', count: 2, vehicles: ['LUR247 · 14:10', …] }. */
  groups: { destination: string; count: number; vehicles: string[] }[];
  total: number;
  loading: boolean;
}

export function useOverflowSends(day: string = businessDateOf(new Date())): OverflowSends {
  const [rows, setRows] = useState<SentRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('vsa_trips')
      .select('vehicle_plate, vehicle_unit, arrive_location, depart_time')
      .is('voided_at', null)
      .in('arrive_location', [...OVERFLOW_DESTINATIONS])
      // A day's worth of sends is a handful of rows; the window keeps it that way as history grows.
      .gte('depart_time', new Date(Date.parse(`${day}T00:00:00`) - 12 * 3_600_000).toISOString())
      .order('depart_time', { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (cancelled) return;
        setRows(error ? [] : ((data ?? []) as SentRow[]));
      });
    return () => { cancelled = true; };
  }, [day]);

  const grouped = groupOverflowSends(rows ?? [], 'day', day);
  return { groups: grouped.groups, total: grouped.total, loading: rows === null };
}
