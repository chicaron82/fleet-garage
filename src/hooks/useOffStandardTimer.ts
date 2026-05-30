import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { OffStandardEntry, User, Hold, Vehicle, ShiftWithUser } from '../types';
import { rowToOffStandard } from '../lib/offStandardReport';
import { useOffStandardSession } from './useOffStandardSession';
import { useOffStandardEntryEdits } from './useOffStandardEntryEdits';
import { useOffStandardExport } from './useOffStandardExport';

// Public surface re-exported from the session hook so existing consumers
// (OffStdQuickStart, OffStandardTimeLog) keep importing from here.
export { QUICK_TAPS } from './useOffStandardSession';
export type { QuickTap, TimerState } from './useOffStandardSession';

interface UseOffStandardTimerProps {
  user: User;
  refreshTrigger?: number;
  holds: Hold[];
  vehicles: Vehicle[];
  shifts: ShiftWithUser[];
  resolveName: (id: string) => string;
}

/**
 * Orchestrator for the off-standard time log. Owns the shared completed-entries
 * list and composes three focused sub-hooks:
 *   - useOffStandardSession    — the live timer (start/end/discard/recovery)
 *   - useOffStandardEntryEdits — backdate + edit flows on completed entries
 *   - useOffStandardExport     — text/PDF report generation
 * Returns a single flat object so the consuming component is unchanged.
 */
export function useOffStandardTimer({
  user,
  refreshTrigger,
  holds,
  vehicles,
  shifts,
  resolveName,
}: UseOffStandardTimerProps) {
  // Shared across sub-hooks: the session appends on End, edits mutate, export reads.
  const [entries, setEntries] = useState<OffStandardEntry[]>([]);

  // Load completed entries for today
  useEffect(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    supabase
      .from('off_standard_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'complete')
      .gte('start_time', todayStart.toISOString())
      .order('start_time', { ascending: true })
      .then(({ data }) => {
        if (data) setEntries((data as Record<string, unknown>[]).map(rowToOffStandard));
      });
  }, [user.id, refreshTrigger]);

  const session = useOffStandardSession({ user, holds, vehicles, resolveName, setEntries });
  const edits   = useOffStandardEntryEdits({ user, setEntries });
  const exporter = useOffStandardExport({ user, shifts, entries });

  return {
    ...session,
    entries,
    ...edits,
    ...exporter,
  };
}
