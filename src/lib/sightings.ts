// "Last seen" — how the record answers *when did I last physically have this car.*
//
// A sighting is a KEY-TAG SCAN. Aaron scans everything with the header scanner (register, show
// damage, backfill blanks, log the keytag/key count), so the scan is the moment the car was in his
// hands. Nothing else in FG means that: a trip means someone drove it, a hold means someone flagged
// it, but only a scan means *he was standing at it with the tag*.
//
// ⚠️ GOING-FORWARD ONLY. Scans were never logged before 2026-08-16, and there is no honest way to
// reconstruct them (see migrations/114). So "never seen" is the correct, common state for most of
// the fleet on day one — the UI must read it as *not yet scanned*, never as *missing data* or an error.

export interface Sighting {
  seenAt: string; // ISO
}

export interface SightingSummary {
  /** ISO of the most recent scan; null when this car has never been scanned. */
  lastSeenAt: string | null;
  /** How many times it's been scanned. 0 when never. */
  count: number;
  /** True when there are no sightings at all — the day-one state, not a failure. */
  neverSeen: boolean;
}

export function summariseSightings(rows: readonly Sighting[]): SightingSummary {
  let lastSeenAt: string | null = null;
  for (const r of rows) {
    // Max by timestamp, not by array position — the caller may fetch in either order, and a
    // summary that depends on the query's ORDER BY is a bug waiting for someone to change it.
    if (lastSeenAt === null || r.seenAt > lastSeenAt) lastSeenAt = r.seenAt;
  }
  return { lastSeenAt, count: rows.length, neverSeen: rows.length === 0 };
}

const DAY_MS = 86_400_000;

/**
 * How long ago, in words — the half of this feature that actually prompts a question.
 *
 * Deliberately coarse and calendar-based rather than exact: "3 days ago" is what makes him think
 * *huh, where's that one been*, and "4 months ago" is the whole point of the feature. An exact
 * timestamp reads as data; a stale phrase reads as a story. Calendar-day boundaries (not 24h
 * windows) so a car scanned at 11pm last night says "yesterday" at 7am, the way a person would.
 */
export function describeLastSeen(iso: string | null, now: Date = new Date()): string {
  if (iso === null) return 'never scanned';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'never scanned';

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(then)) / DAY_MS);

  // A clock skew or a device with the wrong date shouldn't render "-2 days ago".
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? 'over a year ago' : `${years} years ago`;
}

/**
 * Is this car worth a second look? A car he hasn't laid hands on in a long time has been somewhere
 * — a long rental, a body shop, another branch — and that's the question the feature exists to
 * raise. 90 days is deliberately generous: the fleet is ~575 cars and he is one person, so a
 * shorter threshold would flag most of the fleet most of the time and mean nothing.
 *
 * NEVER-seen is NOT stale — on day one that's almost the whole fleet, and calling it stale would
 * make the signal useless in exactly the window where the log is youngest.
 */
export function isStaleSighting(summary: SightingSummary, now: Date = new Date()): boolean {
  if (summary.lastSeenAt === null) return false;
  const then = new Date(summary.lastSeenAt).getTime();
  if (Number.isNaN(then)) return false;
  return now.getTime() - then > 90 * DAY_MS;
}
