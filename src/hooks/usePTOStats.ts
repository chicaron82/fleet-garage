import { useState, useEffect, useCallback } from 'react';
import { supabase, writeWithRefresh } from '../lib/supabase';
import type { User } from '../types';

export interface PTOStats {
  ptoEntitlement: number;
  ptoUsed: number;
  sickDaysUsed: number;
  updatePtoEntitlement: (days: number) => Promise<void>;
  adjustPTO:  (delta: number) => void;
  adjustSick: (delta: number) => void;
  /**
   * Re-read the counters from the DB. The ±1 `adjust*` deltas below only track writes that
   * go through a single-shift path — a BULK write (the schedule import's delete-and-replace)
   * moves rows without them, so the cached count silently drifts from the truth. Any bulk
   * path must call this when it finishes. See [bug-schedule-pto-counter-stale].
   */
  refreshTallies: () => Promise<void>;
}

/**
 * Count this year's pto/sick rows for one user. Pure fetch, no state — shared by the seeding
 * effect and the exported re-read so the query shape can't drift between the two.
 */
async function fetchTallies(userId: string): Promise<{ pto: number; sick: number }> {
  const year = new Date().getFullYear();
  const { data } = await supabase
    .from('shifts')
    .select('shift_type')
    .eq('user_id', userId)
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31`)
    .in('shift_type', ['pto', 'sick']);
  const rows = (data ?? []) as { shift_type: string }[];
  return {
    pto:  rows.filter(r => r.shift_type === 'pto').length,
    sick: rows.filter(r => r.shift_type === 'sick').length,
  };
}

export function usePTOStats(user: User | null): PTOStats {
  const [ptoEntitlement, setPtoEntitlement] = useState(15);
  const [ptoUsed,        setPtoUsed]        = useState(0);
  const [sickDaysUsed,   setSickDaysUsed]   = useState(0);

  const refreshTallies = useCallback(async () => {
    if (!user) return;
    const { pto, sick } = await fetchTallies(user.id);
    setPtoUsed(pto);
    setSickDaysUsed(sick);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    supabase
      .from('user_pto')
      .select('pto_entitlement')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setPtoEntitlement(data.pto_entitlement as number); });

    // Settle state from the resolved promise rather than calling refreshTallies() directly —
    // a direct call trips react-hooks/set-state-in-effect, and the repo's three existing
    // suppressions are deliberate (CLAUDE.md); a fourth for convenience would erode them.
    fetchTallies(user.id).then(({ pto, sick }) => { setPtoUsed(pto); setSickDaysUsed(sick); });
  }, [user]);

  const updatePtoEntitlement = async (days: number) => {
    if (!user) return;
    const { error } = await writeWithRefresh(() =>
      supabase
        .from('user_pto')
        .upsert({ user_id: user.id, pto_entitlement: days, updated_at: new Date().toISOString() })
    );
    if (!error) setPtoEntitlement(days);
  };

  const adjustPTO  = (delta: number) => setPtoUsed(prev => Math.max(0, prev + delta));
  const adjustSick = (delta: number) => setSickDaysUsed(prev => Math.max(0, prev + delta));

  return { ptoEntitlement, ptoUsed, sickDaysUsed, updatePtoEntitlement, adjustPTO, adjustSick, refreshTallies };
}
