// The read-only page's "is the count being kept?" (docs/ticket-lot-view-count-not-kept.md). Aaron, 2026-11-05: on at
// the first clean, off after 2 h with nothing done.
import { describe, it, expect } from 'vitest';
import { COUNT_KEPT_MS, isCountKept, lastActivity } from '../../src/lib/countKept';

const at = (ms: number) => new Date(ms).toISOString();
const T = Date.parse('2026-11-05T21:14:25.796Z');

describe('lastActivity', () => {
  it('⭐ takes the latest of the two counts and every bay start and exit', () => {
    const bay = { cleansAt: at(T - 60 * 60_000), dirtiesAt: at(T - 30 * 60_000) };
    const rows = [
      { started_at: at(T - 50 * 60_000), exited_at: at(T - 45 * 60_000) },
      { started_at: at(T - 10 * 60_000), exited_at: null },   // a car in the bay now: its start is activity
    ];
    expect(lastActivity(bay, rows)).toBe(at(T - 10 * 60_000));
  });

  it('an exit later than every count tap wins (an M hold moves no clean)', () => {
    expect(lastActivity({ cleansAt: at(T - 3 * 60 * 60_000), dirtiesAt: null }, [{ started_at: at(T - 5 * 60_000), exited_at: at(T) }])).toBe(at(T));
  });

  it('nothing ever counted and an empty list → null', () => {
    expect(lastActivity({ cleansAt: null, dirtiesAt: null }, [])).toBeNull();
    expect(lastActivity(null, [])).toBeNull();
  });
});

describe('isCountKept', () => {
  it('⭐ kept up to 2 h after the last tap, not a minute past', () => {
    expect(isCountKept(at(T), T + COUNT_KEPT_MS)).toBe(true);
    expect(isCountKept(at(T), T + COUNT_KEPT_MS + 60_000)).toBe(false);
  });

  it('his first tap of the day turns it back on', () => {
    expect(isCountKept(at(T - 10 * 60 * 60_000), T)).toBe(false);
    expect(isCountKept(at(T - 60_000), T)).toBe(true);
  });

  it('never touched at all is not kept', () => {
    expect(isCountKept(null, T)).toBe(false);
  });
});
