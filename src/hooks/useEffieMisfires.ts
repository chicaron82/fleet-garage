// Reads the reason ids of REJECTED staged Effie writes — the raw input to the misfire
// surface (docs/ticket-misc-effie-correction-loop.md). Only rejects that carry a reason
// (reject_reason not null, migration 093); a skipped-reason reject has nothing to learn
// from. Unscoped like the audit trail — the misfire pattern is Effie's, not per-operator
// (RLS allow-all, FG posture). The grouping lives in the pure summarizeMisfires.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useEffieMisfires(limit = 200) {
  const { user } = useAuth();
  const [reasonIds, setReasonIds] = useState<string[]>([]);

  const reload = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('effie_pending_writes')
      .select('reject_reason')
      .eq('status', 'rejected')
      .not('reject_reason', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    // setState only after the await (never synchronously in the effect body).
    setReasonIds((data ?? []).map((r) => r.reject_reason as string));
  }, [user, limit]);

  useEffect(() => { void reload(); }, [reload]); // eslint-disable-line react-hooks/set-state-in-effect

  return { reasonIds, reload };
}
