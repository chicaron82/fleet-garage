// My upcoming clopens, read straight from the STORED schedule (today → +6 weeks) — so the
// Schedule screen surfaces them with no re-upload. The import banner catches clopens in a
// fresh parse; this reads what's already in FG. Same pure findClopens, different source.
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toISO } from '../lib/schedule-helpers';
import { findClopens, type Clopen } from '../lib/scheduleClopens';

// A VSA schedule block is 4 weeks; 6 weeks of scan covers the current block plus the start
// of the next, without needing to know the exact horizon end.
const HORIZON_DAYS = 42;

export function useMyUpcomingClopens(userId: string | undefined): Clopen[] {
  const [clopens, setClopens] = useState<Clopen[]>([]);
  useEffect(() => {
    if (!userId) return; // stays at the initial [] until signed in; never a sync setState in-effect
    let cancelled = false;
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + HORIZON_DAYS);
    (async () => {
      const { data, error } = await supabase
        .from('shifts')
        .select('date, shift_type')
        .eq('user_id', userId)
        .gte('date', toISO(start))
        .lte('date', toISO(end))
        .order('date', { ascending: true });
      if (cancelled || error || !data) return;
      const days = (data as { date: string; shift_type: string }[]).map((r) => ({ date: r.date, type: r.shift_type }));
      setClopens(findClopens(days));
    })();
    return () => { cancelled = true; };
  }, [userId]);
  return clopens;
}
