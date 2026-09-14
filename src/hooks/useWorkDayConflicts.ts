// Stored shifts that put someone on a day they cannot work (lib/workDays, migration 144) — read
// straight from `shifts`, today → +6 weeks, the same horizon and the same reason as
// useMyUpcomingClopens: the Schedule screen should say it wherever he has navigated, not only when
// the offending week happens to be the one on screen.
//
// ⭐ Asks only about the people who HAVE a rule. Everyone else is null work days and can never
// conflict, so their shifts are not fetched at all.
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { toISO } from '../lib/schedule-helpers';
import { useProfiles } from '../context/ProfilesContext';
import { findWorkDayConflicts, type WorkDayConflict } from '../lib/workDays';

const HORIZON_DAYS = 42;

export function useWorkDayConflicts(): WorkDayConflict[] {
  const profiles = useProfiles();
  const [conflicts, setConflicts] = useState<WorkDayConflict[]>([]);
  // ⚠️ Keyed on `profiles` itself, no string key and no lint suppression: the map is replaced only on
  // sign-in and on a roster add/remove/promote, so a refetch per change is exactly right.
  const ruled = useMemo(
    () => [...profiles.values()].filter(p => p.workDays && p.workDays.length > 0),
    [profiles],
  );

  useEffect(() => {
    if (ruled.length === 0) return; // nobody has a rule — stays at [] (never a sync setState in-effect)
    let cancelled = false;
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + HORIZON_DAYS);
    (async () => {
      const { data, error } = await supabase
        .from('shifts')
        .select('user_id, date, shift_type')
        .in('user_id', ruled.map(p => p.id))
        .gte('date', toISO(start))
        .lte('date', toISO(end));
      if (cancelled || error || !data) return;
      const shifts = (data as { user_id: string; date: string; shift_type: string }[])
        .map(r => ({ userId: r.user_id, date: r.date, shiftType: r.shift_type }));
      setConflicts(findWorkDayConflicts(shifts, profiles, toISO(start)));
    })();
    return () => { cancelled = true; };
  }, [ruled, profiles]);

  return conflicts;
}
