import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Did this user log any 'airport_flip' off-standard time on `date`? Drives the
 * closing-summary context flag: cars flipped at the airport never reach the
 * washbay, so a light bay count on an airport-flip day is honest, not slow.
 *
 * Derived, not persisted — the OTH entries are the source of truth (closing logs
 * carry no airport-flip column by design). One lightweight existence check.
 */
export function useTodayAirportFlip(userId: string | undefined, date: string): boolean {
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    supabase
      .from('off_standard_entries')
      .select('id')
      .eq('user_id', userId)
      .eq('date', date)
      .eq('preset_reason', 'airport_flip')
      .limit(1)
      .then(({ data }) => { if (alive) setFlipping((data?.length ?? 0) > 0); });
    return () => { alive = false; };
  }, [userId, date]);

  return flipping;
}
