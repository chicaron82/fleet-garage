import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { OVERFLOW_DESTINATIONS } from '../../api/_lib/overflowProposal';
import { groupOverflowDays, type OverflowDay, type SentRow } from '../../api/_lib/overflowManifest';

/**
 * The overflow sends FG has on record, newest shift-day first — the My Day card's rows.
 *
 * ⭐⭐ THE SAME ANSWER EFFIE GIVES. The grouping is Effie's `lookup_sent` grouping, imported from the
 * leaf module rather than re-implemented here: a day does NOT dedup (a car sent twice is two moves),
 * plates come first, and a VOIDED send never happened. Two implementations of "what's at FastAir" is
 * exactly the drift FG keeps paying for.
 *
 * ⭐ HISTORY, NOT TODAY (Aaron, 2026-09-11: *"I was thinking to show what was last sent there"*).
 * The first build scoped to the current shift-day, which on a normal day renders an empty card. This
 * asks for the whole record and lets the newest day that HAS sends lead.
 *
 * ⚠️ `OVERFLOW_DESTINATIONS`, not the UI pair: 'Airport' is no longer offered as a destination but
 * history holds sends to it, and a manifest that silently dropped them would be wrong about the past.
 */
export interface OverflowSends {
  /** Days with at least one send, newest first. */
  days: OverflowDay[];
  loading: boolean;
}

// ⚠️⚠️ AND THE OLDEST DAY IS DROPPED WHEN THIS CAP IS HIT. PostgREST caps a response at 1,000 rows
// whatever `.limit()` asks for, and FG has already shipped one card that read the first 1,000 of
// 1,131 sightings and looked perfectly reasonable while being wrong. Here the failure is subtler: a
// truncated response cuts MID-DAY, so the oldest day would render as a partial day with no sign it
// was partial. Under the cap every day is complete; at the cap the last one is suspect, so it goes.
const LIMIT = 500;

export function useOverflowSends(): OverflowSends {
  const [rows, setRows] = useState<SentRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('vsa_trips')
      .select('vehicle_plate, vehicle_unit, arrive_location, depart_time')
      .is('voided_at', null)
      .in('arrive_location', [...OVERFLOW_DESTINATIONS])
      .order('depart_time', { ascending: false })
      .limit(LIMIT)
      .then(({ data, error }) => {
        if (cancelled) return;
        setRows(error ? [] : ((data ?? []) as SentRow[]));
      });
    return () => { cancelled = true; };
  }, []);

  const days = groupOverflowDays(rows ?? []);
  return {
    days: rows && rows.length >= LIMIT ? days.slice(0, -1) : days,
    loading: rows === null,
  };
}
