import { describe, it, expect } from 'vitest';
import { summariseSightings, describeLastSeen, isStaleSighting, type Sighting, actionImpliesPresence } from '../../src/lib/sightings';

const at = (iso: string): Sighting => ({ seenAt: iso });

describe('summariseSightings', () => {
  it('takes the most recent scan and counts them all', () => {
    const s = summariseSightings([at('2026-08-01T10:00:00Z'), at('2026-08-14T09:00:00Z'), at('2026-08-09T12:00:00Z')]);
    expect(s.lastSeenAt).toBe('2026-08-14T09:00:00Z');
    expect(s.count).toBe(3);
    expect(s.neverSeen).toBe(false);
  });

  it('finds the latest by TIMESTAMP, not array position', () => {
    // The caller may fetch ascending or descending; a summary that depends on the query's ORDER BY
    // breaks silently the day someone changes it.
    const rows = [at('2026-08-01T10:00:00Z'), at('2026-08-14T09:00:00Z')];
    expect(summariseSightings(rows).lastSeenAt).toBe('2026-08-14T09:00:00Z');
    expect(summariseSightings([...rows].reverse()).lastSeenAt).toBe('2026-08-14T09:00:00Z');
  });

  it('reports NEVER SEEN for an empty log — the day-one state, not an error', () => {
    const s = summariseSightings([]);
    expect(s).toEqual({ lastSeenAt: null, count: 0, neverSeen: true });
  });
});

describe('describeLastSeen', () => {
  const now = new Date(2026, 7, 16, 12, 0, 0); // Sun Aug 16 2026, noon local

  it('says "never scanned" when there is nothing', () => {
    expect(describeLastSeen(null, now)).toBe('never scanned');
  });

  it('uses CALENDAR days, not 24h windows', () => {
    // Scanned at 11pm last night → a person says "yesterday" at noon today, not "14 hours ago".
    expect(describeLastSeen(new Date(2026, 7, 15, 23, 0, 0).toISOString(), now)).toBe('yesterday');
    expect(describeLastSeen(new Date(2026, 7, 16, 1, 0, 0).toISOString(), now)).toBe('today');
  });

  it('scales the phrasing as it gets staler', () => {
    const ago = (d: number) => new Date(2026, 7, 16 - d, 10, 0, 0).toISOString();
    expect(describeLastSeen(ago(3), now)).toBe('3 days ago');
    expect(describeLastSeen(ago(9), now)).toBe('last week');
    expect(describeLastSeen(ago(21), now)).toBe('3 weeks ago');
    expect(describeLastSeen(ago(120), now)).toBe('4 months ago');
  });

  it('handles a year and beyond', () => {
    expect(describeLastSeen(new Date(2025, 1, 1).toISOString(), now)).toBe('over a year ago');
    expect(describeLastSeen(new Date(2023, 1, 1).toISOString(), now)).toBe('3 years ago');
  });

  it('never renders a NEGATIVE age from clock skew', () => {
    // A device with a wrong date shouldn't produce "-2 days ago" on the card.
    expect(describeLastSeen(new Date(2026, 7, 18).toISOString(), now)).toBe('today');
  });

  it('survives a garbage timestamp instead of rendering "Invalid Date"', () => {
    expect(describeLastSeen('not-a-date', now)).toBe('never scanned');
  });
});

describe('isStaleSighting', () => {
  const now = new Date(2026, 7, 16, 12, 0, 0);
  const seen = (d: number) => summariseSightings([at(new Date(2026, 7, 16 - d, 10, 0, 0).toISOString())]);

  it('flags a car not laid hands on in over 90 days', () => {
    expect(isStaleSighting(seen(120), now)).toBe(true);
    expect(isStaleSighting(seen(30), now)).toBe(false);
  });

  it('does NOT call a never-seen car stale', () => {
    // On day one that's nearly the whole fleet — flagging it would make the signal meaningless
    // in exactly the window where the log is youngest.
    expect(isStaleSighting(summariseSightings([]), now)).toBe(false);
  });
});

// Aaron, 2026-08-25: "typing something in just to look it up won't count as seen."
describe('actionImpliesPresence', () => {
  it('treats a plain look-up as NO evidence of being at the car', () => {
    expect(actionImpliesPresence('view')).toBe(false);
  });

  // Each of these is an act performed ON the car — not something done from the office.
  it('treats every acting-on-the-car route as presence', () => {
    for (const kind of ['flag', 'trip', 'lnf', 'repair', 'register', 'register-and-flag']) {
      expect(actionImpliesPresence(kind)).toBe(true);
    }
  });

  // Defaulting an unknown kind to TRUE is deliberate: a new route is far more likely to be another
  // way of acting on a car than another way of reading about one, and under-recording a real
  // sighting loses information silently while over-recording is visible and correctable.
  it('defaults an unrecognised action to presence', () => {
    expect(actionImpliesPresence('some-future-route')).toBe(true);
  });
});
