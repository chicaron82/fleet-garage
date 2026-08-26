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
  /** Who was standing at the car. The washbay is shared — "2 scans" means nothing if one of them
   *  was somebody else's. Optional because the column is nullable on older rows. */
  seenByName?: string | null;
}

export interface SightingSummary {
  /** ISO of the most recent scan; null when this car has never been scanned. */
  lastSeenAt: string | null;
  /**
   * ⭐ The most recent scan that is NOT from the current visit — *when did I have this car BEFORE
   * now* — and the one the record should actually show him.
   *
   * Aaron, 2026-08-26: *"wouldn't every time I scan and open it be last seen today? fairly
   * confident I cleaned it yesterday."* He was right: the scan RECORDS the sighting, so by the
   * time the record renders, "last seen" is always "today". His own act of looking made the data.
   * Standing at the car, "when did I last see it" has a useless answer — thirty seconds ago. The
   * question worth answering is the one before that, and on his car it said *yesterday*.
   *
   * Null when there is nothing before this visit (a car scanned for the first time).
   */
  priorSeenAt: string | null;
  /** How many times it's been scanned, ALL TIME — including the scan that opened this record. */
  count: number;
  /** True when there are no sightings at all — the day-one state, not a failure. */
  neverSeen: boolean;
}

/**
 * @param mine ISO timestamps this SESSION recorded for this car — its scans, exactly. Passing them
 *   is what lets `priorSeenAt` skip the current visit.
 *
 * ⚠️ IDENTIFIED BY EQUALITY, NEVER BY A TIME WINDOW. "Is this sighting mine, right now?" proxied as
 * "is it less than N minutes old?" drifts in both directions — he can be pulled off a car for half
 * an hour, or legitimately scan the same car twice inside ten. So `recordSighting` sends an explicit
 * `seen_at` and remembers that exact string; a row is this visit's iff it matches one. No window,
 * no threshold, nothing to tune.
 */
export function summariseSightings(
  rows: readonly Sighting[],
  mine: ReadonlySet<string> = new Set(),
): SightingSummary {
  let lastSeenAt: string | null = null;
  let priorSeenAt: string | null = null;
  for (const r of rows) {
    // Max by timestamp, not by array position — the caller may fetch in either order, and a
    // summary that depends on the query's ORDER BY is a bug waiting for someone to change it.
    if (lastSeenAt === null || r.seenAt > lastSeenAt) lastSeenAt = r.seenAt;
    if (mine.has(r.seenAt)) continue;
    if (priorSeenAt === null || r.seenAt > priorSeenAt) priorSeenAt = r.seenAt;
  }
  return { lastSeenAt, priorSeenAt, count: rows.length, neverSeen: rows.length === 0 };
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

/**
 * Does taking this action imply the operator was PHYSICALLY AT the car?
 *
 * ⭐ Aaron, 2026-08-25: *"what about typing and then doing an action. so typing something in just to
 * look it up won't count as seen."*
 *
 * This exists because I got the reasoning wrong first. I let a TYPED plate record a sighting
 * immediately, arguing it "makes the identical claim as reading the tag". It doesn't. A photo of a
 * key tag is evidence of presence **because you must be holding the tag to take it** — the camera
 * isn't incidental, it's the proof. Typing carries none of that: he could be at the desk, on the
 * bus, or reading a plate off a text message.
 *
 * So a typed plate earns its sighting by what he does NEXT. Flagging, starting a trip, logging a
 * found item, registering, marking repaired — each is an act performed ON the car, and you do not
 * do them from the office. **Looking a record up is the one thing you plainly can.**
 *
 * A scan still records its sighting at the read, unconditionally: the photo already proved it.
 */
export function actionImpliesPresence(kind: string): boolean {
  return kind !== 'view';
}

/**
 * One line of the history list: when, at what time, and who.
 *
 * ⭐ Aaron, 2026-08-26: *"tapping the last seen reveals its full history."* — and it is the better
 * answer than the one I was reaching for. The chip had been trying to pick THE one right date, and
 * every candidate was defensible and none was complete: the newest is his own scan, the prior one
 * ignores that he may not have scanned at all, and a count with no dates says nothing. Showing all
 * of them on demand dissolves the argument instead of settling it — the summary leads, the detail
 * is one tap away. Same shape as tapping a damage zone for its photo.
 *
 * Date and time stay SEPARATE fields rather than one string, so the list can group by day without
 * re-parsing what it just formatted.
 */
export interface SightingLine {
  /** ISO date, for grouping — "2026-08-25". */
  day: string;
  /** Local 24h clock, the way the washbay reads times — "13:18". */
  time: string;
  who: string;
}

export function sightingLines(rows: readonly Sighting[]): SightingLine[] {
  return [...rows]
    // Newest first: the most recent visit is the one he is checking against.
    .sort((a, b) => (a.seenAt < b.seenAt ? 1 : a.seenAt > b.seenAt ? -1 : 0))
    .map(r => {
      const d = new Date(r.seenAt);
      const pad = (n: number) => String(n).padStart(2, '0');
      return {
        day: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
        // ⚠️ Never blank. An unattributed row is a real historical state (the column is nullable),
        // and an empty cell reads as a rendering fault rather than as missing data.
        who: (r.seenByName ?? '').trim() || 'unknown',
      };
    });
}
