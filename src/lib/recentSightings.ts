// "Now · 30 days" for the Top 10 most seen (docs/ticket-top-seen-now-and-all-time.md). Aaron, 2026-11-19, looking at
// the all-time Top 10: *"is LJF672 really that popular that even after not being seen for 15 days its still #1?"*. It
// wasn't: 21 sightings built Aug–Oct, 5 in the last 30 days, while #2 had 9 and was seen that day. The all-time count
// answers "which cars have we met most, ever"; a shift wants "which keep coming back NOW". He picked two tabs.

const DAY_MS = 86_400_000;

export interface Sighting { vehicle_id: string | null; seen_at: string | null }

/**
 * Per-car sighting counts inside a rolling window, now and as the same window stood a week ago (for the arrows).
 * `now` counts sightings in (nowMs − days, nowMs]; `weekAgo` counts (nowMs − 7 − days, nowMs − 7]. A sighting with no
 * vehicle or no time counts nowhere.
 */
export function windowCounts(sightings: readonly Sighting[], nowMs: number, days = 30): {
  now: Map<string, number>; weekAgo: Map<string, number>;
} {
  const now = new Map<string, number>();
  const weekAgo = new Map<string, number>();
  const span = days * DAY_MS;
  const then = nowMs - 7 * DAY_MS;
  for (const s of sightings) {
    if (!s.vehicle_id || !s.seen_at) continue;
    const t = Date.parse(s.seen_at);
    if (Number.isNaN(t)) continue;
    if (t > nowMs - span && t <= nowMs) now.set(s.vehicle_id, (now.get(s.vehicle_id) ?? 0) + 1);
    if (t > then - span && t <= then) weekAgo.set(s.vehicle_id, (weekAgo.get(s.vehicle_id) ?? 0) + 1);
  }
  return { now, weekAgo };
}
