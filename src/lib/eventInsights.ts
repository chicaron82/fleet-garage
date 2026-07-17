// Turning today's dated personal notes into My Day "Heads up today" insights — the same card
// clopen and solo-floor already ride, because "🍖 Staff BBQ today at 12:30" is exactly what that
// card is for: things about TODAY he should know. Pure: the events are passed in.
//
// Scope guardrail (Aaron, 2026-07-16): a handful of dated notes, never a calendar — so there's no
// recurrence, no windowing, no "upcoming". Only today surfaces; yesterday's is simply past.
import type { ScheduleInsight } from './scheduleInsights';

export interface PersonalEvent {
  id: string;
  /** ISO date (YYYY-MM-DD) — matched against today's local date string. */
  eventDate: string;
  /** 'HH:MM[:SS]' or null for an all-day note. */
  eventTime: string | null;
  title: string;
}

/** '12:30:00' → '12:30'; passes through anything already short. Null-safe. */
function shortTime(t: string | null): string | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  return m ? `${m[1]}:${m[2]}` : t.trim();
}

/**
 * Today's events as insights, in time order (all-day notes first — they have no time to sort by).
 * Returns [] when nothing's on today, so the card stays hidden exactly as it does for a clean day.
 */
export function eventInsights(events: PersonalEvent[], todayISO: string): ScheduleInsight[] {
  return events
    .filter(e => e.eventDate === todayISO && e.title.trim().length > 0)
    .sort((a, b) => (a.eventTime ?? '').localeCompare(b.eventTime ?? ''))
    .map(e => {
      const time = shortTime(e.eventTime);
      return {
        kind: 'event' as const,
        icon: '📅',
        label: e.title.trim(),
        detail: time ? `Today at ${time}` : 'Today',
      };
    });
}
