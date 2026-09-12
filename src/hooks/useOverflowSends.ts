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
 * ⚠️ RICHARDSON IS NOT OVERFLOW (Aaron, 2026-09-11: *"anything sent to Richardson doesn't count…
 * it's sitting in an O or P stall available for rent"*), so 'Airport' is not in the list any more.
 * It never should have been: the driver-trip flow writes that same value for an ordinary shuttle
 * run, so this card was showing normal trips as overflow sends. The manifest now enforces the set
 * itself; this filter is the query-side half of the same rule.
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

// One confirm tap writes one row PER VEHICLE, so a batch of eight sends arrives as eight separate
// events. They collapse into a single refetch rather than eight.
const COALESCE_MS = 250;

export function useOverflowSends(): OverflowSends {
  const [rows, setRows] = useState<SentRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    let coalesce: ReturnType<typeof setTimeout> | null = null;

    const load = () => {
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
    };
    load();

    // ⭐ LIVE, so a send logged from the Movement Log appears without navigating away and back
    // (Aaron, 2026-09-11: *"Saves navigating away and coming back or refreshing"*).
    //
    // ⚠️⚠️ THIS IS SILENT UNLESS `vsa_trips` IS IN THE `supabase_realtime` PUBLICATION — a channel on
    // a table outside it subscribes happily and never fires. Migration 140 adds it. FG already
    // carries one subscription with that exact defect (`vehicles-realtime` in VehicleHoldContext,
    // on a table that is not published), which is why this was checked rather than assumed.
    //
    // `*`, not INSERT: a VOID is an UPDATE that sets `voided_at`, and a voided send must leave the
    // card as promptly as a new one joins it.
    const channel = supabase
      .channel('overflow-sends-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vsa_trips' }, () => {
        if (cancelled) return;
        if (coalesce) clearTimeout(coalesce);
        // Refetch rather than patch the row in: the card groups by day and destination through the
        // shared manifest rules, and re-reading is the only way those rules stay the one definition.
        coalesce = setTimeout(load, COALESCE_MS);
      })
      .subscribe();

    return () => {
      cancelled = true;
      if (coalesce) clearTimeout(coalesce);
      void supabase.removeChannel(channel);
    };
  }, []);

  const days = groupOverflowDays(rows ?? []);
  return {
    days: rows && rows.length >= LIMIT ? days.slice(0, -1) : days,
    loading: rows === null,
  };
}
