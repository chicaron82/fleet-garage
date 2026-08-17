// Reads yesterday's baseline and records today's — the two halves of the fleet-health trend.
//
// Deliberately DUMB about timing: it reads the most recent snapshot strictly BEFORE today, then
// upserts today's counts. Re-opening the module later in the day refreshes today's row rather than
// stacking duplicates, and never disturbs the baseline (which is a different date by definition).
//
// Both sides are non-blocking. A failed read means "no arrows this session"; a failed write means
// "tomorrow compares against an older day and says so". Neither may cost Aaron the fleet list — the
// module's job is showing him 604 cars, and bookkeeping does not get to break that.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { type FleetSnapshot, toLocalDate } from '../lib/fleetTrend';
import type { FleetCohortCounts } from '../lib/fleetCohorts';

interface Args {
  branchId: string;
  counts: FleetCohortCounts;
  total: number;
  /** False while the fleet is still loading — writing a snapshot of an empty list would record a
   *  fleet of zero cars and poison tomorrow's comparison with a number that was never true. */
  ready: boolean;
}

export function useFleetTrend({ branchId, counts, total, ready }: Args): FleetSnapshot | null {
  const [baseline, setBaseline] = useState<FleetSnapshot | null>(null);

  const today = toLocalDate(new Date());
  // Primitive deps only: the counts object is rebuilt every render, so depending on it directly
  // would re-run this effect forever.
  const { 'missing-keytag': mk, 'missing-keycount': mc, 'needs-backfill': nb } = counts;

  useEffect(() => {
    if (!ready || !branchId || branchId === 'ALL') return;
    let cancelled = false;

    void (async () => {
      try {
        const { data } = await supabase
          .from('fleet_daily_snapshot')
          .select('snapshot_date, total, missing_keytag, missing_keycount, needs_backfill')
          .eq('branch_id', branchId)
          .lt('snapshot_date', today)
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!cancelled && data) {
          setBaseline({
            snapshotDate: data.snapshot_date,
            total: data.total,
            missingKeytag: data.missing_keytag,
            missingKeycount: data.missing_keycount,
            needsBackfill: data.needs_backfill,
          });
        }
      } catch { /* no arrows this session; never a blocker */ }

      try {
        await supabase.from('fleet_daily_snapshot').upsert({
          branch_id: branchId,
          snapshot_date: today,
          total,
          missing_keytag: mk,
          missing_keycount: mc,
          needs_backfill: nb,
          captured_at: new Date().toISOString(),
        }, { onConflict: 'branch_id,snapshot_date' });
      } catch { /* tomorrow compares against an older day, and the UI will say so */ }
    })();

    return () => { cancelled = true; };
  }, [ready, branchId, today, total, mk, mc, nb]);

  return baseline;
}
