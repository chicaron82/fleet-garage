import { describe, it, expect } from 'vitest';
import { summariseSightings, describeLastSeen, isStaleSighting, type Sighting, actionImpliesPresence, sightingLines } from '../../src/lib/sightings';

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
    expect(s).toEqual({ lastSeenAt: null, priorSeenAt: null, count: 0, neverSeen: true });
  });

  // ── priorSeenAt: "when did I have this car BEFORE now" ───────────────────────────────────────
  // Aaron, 2026-08-26: "wouldn't every time I scan and open it be last seen today? fairly confident
  // I cleaned it yesterday." He was right — the scan RECORDS the sighting, so by the time the record
  // renders, its own scan is the newest row and "last seen" reports his act of looking back to him.
  describe('priorSeenAt — skips the visit that is happening right now', () => {
    const YESTERDAY = '2026-08-25T18:18:00Z';
    const NOW = '2026-08-26T12:21:00Z';

    // ⭐⭐ THE LIVE CASE. LUR330 had exactly these two rows and the chip said "Seen 2× · today".
    it('reports the scan BEFORE this one when this session made the newest', () => {
      const s = summariseSightings([at(YESTERDAY), at(NOW)], new Set([NOW]));
      expect(s.lastSeenAt).toBe(NOW);        // the raw fact survives, for the tooltip
      expect(s.priorSeenAt).toBe(YESTERDAY); // …and the chip answers the useful question
      expect(s.count).toBe(2);               // the total is still the total
    });

    // ⭐ The fallback that keeps the ORIGINAL feature working: he reached the record from Fleet or a
    // deep link, nothing was scanned, so there is nothing to exclude and the newest IS the answer.
    // This is the "where has that one been" case the whole feature was built for.
    it('reports the newest when this session scanned nothing', () => {
      const s = summariseSightings([at(YESTERDAY), at(NOW)]);
      expect(s.priorSeenAt).toBe(NOW);
    });

    it('skips EVERY scan this session made, not just the newest', () => {
      const s = summariseSightings(
        [at(YESTERDAY), at(NOW), at('2026-08-26T12:40:00Z')],
        new Set([NOW, '2026-08-26T12:40:00Z']),
      );
      expect(s.priorSeenAt).toBe(YESTERDAY);
    });

    // ⚠️ A car scanned for the first time ever has no "before this". It must say so rather than
    // falling back to lastSeenAt, which would print "today" again — the very bug being fixed.
    it('is null when this visit is the only scan there has ever been', () => {
      const s = summariseSightings([at(NOW)], new Set([NOW]));
      expect(s.priorSeenAt).toBeNull();
      expect(s.lastSeenAt).toBe(NOW);
      expect(s.neverSeen).toBe(false);
    });

    // ⚠️ Matched by EQUALITY, never a time window. A stamp from this session that isn't in the rows
    // yet (insert still in flight) must not swallow a real prior visit.
    it('a session stamp that matches no row changes nothing', () => {
      const s = summariseSightings([at(YESTERDAY)], new Set(['2026-08-26T12:21:00.001Z']));
      expect(s.priorSeenAt).toBe(YESTERDAY);
    });

    it('finds the prior by TIMESTAMP, not array position', () => {
      const mine = new Set([NOW]);
      const rows = [at(NOW), at('2026-08-01T10:00:00Z'), at(YESTERDAY)];
      expect(summariseSightings(rows, mine).priorSeenAt).toBe(YESTERDAY);
      expect(summariseSightings([...rows].reverse(), mine).priorSeenAt).toBe(YESTERDAY);
    });
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

describe('sightingLines — the full history, on demand', () => {
  it('is newest first, whatever order the rows arrive in', () => {
    const rows = [
      { seenAt: '2026-08-25T18:18:00Z', seenByName: 'Aaron S.' },
      { seenAt: '2026-08-26T12:21:00Z', seenByName: 'Aaron S.' },
    ];
    expect(sightingLines(rows).map(l => l.day)).toEqual(['2026-08-26', '2026-08-25']);
    expect(sightingLines([...rows].reverse()).map(l => l.day)).toEqual(['2026-08-26', '2026-08-25']);
  });

  it('splits day and time so a list can group without re-parsing', () => {
    const [l] = sightingLines([{ seenAt: new Date(2026, 7, 25, 13, 18).toISOString(), seenByName: 'x' }]);
    expect(l.day).toBe('2026-08-25');
    expect(l.time).toBe('13:18');   // 24h, the way the washbay reads times
  });

  it('zero-pads so the column stays aligned', () => {
    const [l] = sightingLines([{ seenAt: new Date(2026, 0, 5, 9, 7).toISOString(), seenByName: 'x' }]);
    expect(l).toMatchObject({ day: '2026-01-05', time: '09:07' });
  });

  // ⚠️ Never blank. The column is nullable, so an unattributed row is a real historical state —
  // and an empty cell reads as a rendering fault rather than as missing data.
  it('names an unattributed scan rather than leaving a hole', () => {
    for (const who of [null, undefined, '', '   ']) {
      expect(sightingLines([{ seenAt: '2026-08-25T18:18:00Z', seenByName: who }])[0].who).toBe('unknown');
    }
  });

  it('is empty for a car nobody has scanned', () => {
    expect(sightingLines([])).toEqual([]);
  });

  // ⚠️ Must not mutate the caller's array — the same rows feed the summary.
  it('leaves the rows it was given alone', () => {
    const rows = [{ seenAt: '2026-08-25T18:18:00Z' }, { seenAt: '2026-08-26T12:21:00Z' }];
    const before = rows.map(r => r.seenAt);
    sightingLines(rows);
    expect(rows.map(r => r.seenAt)).toEqual(before);
  });
});
