// "Now · 30 days" (docs/ticket-top-seen-now-and-all-time.md). Aaron, 2026-11-19: *"is LJF672 really that popular that
// even after not being seen for 15 days its still #1?"* An old lead must not count inside the window.
import { describe, it, expect } from 'vitest';
import { windowCounts } from '../../src/lib/recentSightings';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 20, 4, 0); // a fixed instant; no wall-clock time in a test
const at = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

describe('windowCounts', () => {
  it('⭐ a car with an old lead counts only what it did in the last 30 days', () => {
    const old = Array.from({ length: 20 }, (_, i) => ({ vehicle_id: 'tesla', seen_at: at(40 + i) }));
    const recent = [at(16), at(17)].map(seen_at => ({ vehicle_id: 'tesla', seen_at }));
    const jetta = [1, 2, 3].map(d => ({ vehicle_id: 'jetta', seen_at: at(d) }));
    const { now } = windowCounts([...old, ...recent, ...jetta], NOW);
    expect(now.get('tesla')).toBe(2);
    expect(now.get('jetta')).toBe(3);
  });

  it('the edges: exactly 30 days ago is out, just inside is in, the future is out', () => {
    const { now } = windowCounts([
      { vehicle_id: 'a', seen_at: at(30) },
      { vehicle_id: 'b', seen_at: new Date(NOW - 30 * DAY + 1000).toISOString() },
      { vehicle_id: 'c', seen_at: at(-1) },
    ], NOW);
    expect([now.get('a'), now.get('b'), now.get('c')]).toEqual([undefined, 1, undefined]);
  });

  it('a week ago is the same 30-day window, shifted back 7 days (the arrows compare like with like)', () => {
    const { now, weekAgo } = windowCounts([
      { vehicle_id: 'x', seen_at: at(2) },   // now only
      { vehicle_id: 'x', seen_at: at(10) },  // both
      { vehicle_id: 'x', seen_at: at(33) },  // week-ago only
      { vehicle_id: 'x', seen_at: at(34) },  // week-ago only
    ], NOW);
    // Different on purpose: an unshifted week-ago window would read 2, the same as now (revert control, 2026-11-19).
    expect(now.get('x')).toBe(2);
    expect(weekAgo.get('x')).toBe(3);
  });

  it('a sighting with no car or no time counts nowhere', () => {
    const { now, weekAgo } = windowCounts([{ vehicle_id: null, seen_at: at(1) }, { vehicle_id: 'y', seen_at: null }], NOW);
    expect(now.size + weekAgo.size).toBe(0);
  });
});
