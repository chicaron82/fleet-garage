// Today's dated personal notes for the My Day cockpit (migration 099). Deliberately narrow: the
// ONLY read is "anything on today for me?" — the scope guardrail is a handful of dated notes, not
// a calendar, so there's no month range, no upcoming list, nothing to page. IO only; the shaping
// into insights is the pure lib/eventInsights.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { PersonalEvent } from '../lib/eventInsights';

export function usePersonalEvents(userId: string | undefined, todayISO: string): PersonalEvent[] {
  const [events, setEvents] = useState<PersonalEvent[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('personal_events')
      .select('id, event_date, event_time, title')
      .eq('user_id', userId)
      .eq('event_date', todayISO);
    setEvents((data ?? []).map(r => ({
      id: r.id as string,
      eventDate: r.event_date as string,
      eventTime: (r.event_time as string | null) ?? null,
      title: r.title as string,
    })));
  }, [userId, todayISO]);

  // setState is post-await (async), matching useEffieMemory / ActiveSessionsContext.
  useEffect(() => { void load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  return events;
}
