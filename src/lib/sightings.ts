// "Last seen" — how the record answers *when did I last physically have this car.*
//
// A sighting is a KEY-TAG SCAN. Aaron scans everything with the header scanner (register, show
// damage, backfill blanks, log the keytag/key count), so the scan is the moment the car was in his
// hands. Nothing else in FG means that: a trip means someone drove it, a hold means someone flagged
// it, but only a scan means *he was standing at it with the tag*.
//
// ⚠️ SCANS are going-forward only. They were never logged before 2026-08-16 (migrations/114).
//
// ⭐ BUT THE CHANGE LOG REMEMBERS MORE THAN THE SCAN LOG DOES. Aaron, 2026-08-28, looking at a Jetta
// that read "Never scanned" above four record changes from that same day: *"shouldn't it be showing
// last seen today 13:53... however many interactions were done since we started keeping track."*
// `vehicle_changes` has watched him work since 2026-08-19, and every write he makes at a car is an
// interaction FG can already prove. See `sightingsFromChanges` below — this file used to say there
// was "no honest way to reconstruct them", which was true of scans and wrong about the record.
//
// Even so, most of the fleet's history is gone and always will be: *"its a rental i'm sure i've seen
// this vehicle at least 50 already before FG was born."* The count is **times FG noticed**, never
// times he was there — the UI must read a low number as *not yet observed*, never as *rarely used*.

import { describeActor } from './vehicleChanges';

export interface Sighting {
  seenAt: string; // ISO
  /** Who was standing at the car. The washbay is shared — "2 scans" means nothing if one of them
   *  was somebody else's. Optional because the column is nullable on older rows.
   *
   *  ⚠️ SCAN ROWS ONLY. `vehicle_sightings` stores a name it captured at the scan; a DERIVED
   *  interaction has an id instead — see `actor` below. Never put an id in here. */
  seenByName?: string | null;
  /**
   * ⭐ The actor behind a DERIVED interaction — `vehicle_changes.actor` (migration 132), which is
   * a JWT `sub` uuid for an app user or a crew name written through `app.actor`.
   *
   * ⚠️ DELIBERATELY UNRESOLVED. A uuid is not a name, and the map from one to the other lives in
   * the profiles context, not in a pure lib. `sightingLines` takes the resolver; this field just
   * carries the raw value that far without a component having to re-fetch the change rows.
   */
  actor?: string | null;
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

export function sightingLines(
  rows: readonly Sighting[],
  /**
   * ⭐ REQUIRED, not optional — and that is the fix, not a style choice.
   *
   * ⚠️ This list showed "unknown" beside three of Aaron's own four interactions (2026-09-01) while
   * the change log directly beneath it said "by Aaron S." on the same rows. The name was in the
   * database the whole time; the derived half just never carried it. An OPTIONAL resolver would
   * let the next caller drop it exactly the same way, silently. Making it required means a caller
   * that cannot name people has to say so, in the type system, on purpose.
   */
  nameFor: (id: string) => string | undefined,
): SightingLine[] {
  return [...rows]
    // Newest first: the most recent visit is the one he is checking against.
    .sort((a, b) => (a.seenAt < b.seenAt ? 1 : a.seenAt > b.seenAt ? -1 : 0))
    .map(r => {
      const d = new Date(r.seenAt);
      const pad = (n: number) => String(n).padStart(2, '0');
      return {
        day: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
        // Two provenances, one column. A SCAN carries the name it captured; a DERIVED interaction
        // carries `vehicle_changes.actor` and is resolved here by the same `describeActor` the
        // change log uses — one definition of "how an actor becomes a person", including `dizee`.
        //
        // ⚠️ Never blank. An unattributed row is a real historical state (both columns are
        // nullable), and an empty cell reads as a rendering fault rather than as missing data.
        // Note this deliberately DIVERGES from the change log, which renders nothing rather than
        // "unknown": there, WHO is a suffix that can simply be absent; here it is a column, and a
        // column with a hole in it looks broken. Same honesty, different shape.
        who: (r.seenByName ?? '').trim() || describeActor(r.actor, nameFor) || 'unknown',
      };
    });
}

// ── Interactions, derived from the change log ─────────────────────────────────────────────────

/**
 * Change fields that a SCRIPT wrote, not Aaron. Excluded from derived interactions.
 *
 * ⚠️ THE WHOLE DESIGN TURNS ON THIS LIST. `vehicle_changes` is a proxy for presence and it drifts
 * hard: fleet-wide the three largest categories are backfills — `class_code` (659 rows / 613 cars),
 * `vin_last9` (428 / 426), `owning_area` (293 / 291) — roughly 1,380 rows written by scripts I ran.
 * Derive naively and FG reports that he toured six hundred cars on 2026-08-25.
 *
 * ⭐ A BLOCKLIST, NOT A WHITELIST — and the reason is Aaron's. My first cut gated on "could this
 * have been done from a desk?", which is a MULTI-USER question about a single-user personal tool.
 * *"are you forgetting that FG is my personal tool. and its ONLY user."* There is no someone. There
 * is Aaron, and he does not sit at a desk marking statuses. So the line is not desk-vs-car, it is
 * **script-vs-him**, and everything not on this list is him.
 *
 * `field_sources` rides along with other writes as bookkeeping; `cover_photo_url` is mixed (~64 of
 * its 88 rows came from a backfill), so it stays out rather than half-counting.
 *
 * ⭐⭐ ASKED AND ANSWERED — the `keytag_audit_*` fields do NOT belong here (2026-08-29). The audit
 * shipped the day after this list was written and put 288 desk-audit changes on the fleet in one
 * evening, so every one of those cars began reading "Last here today" while `vehicle_sightings`
 * had zero rows for the day. I raised it as a defect. Aaron closed it as the design:
 *
 *   *"a change was made. so this change would reflect as such."*
 *   *"couch work i'd still count. i can still see the interactions in detail if i expand it."*
 *
 * The chip answers *when did FG last notice this car*, and an audit is FG noticing. The expandable
 * per-row list is what he opens when the summary is not enough — that is what it is for. So the
 * line stays **script-vs-him**, exactly as written above, and a future reader wondering whether to
 * add the audit fields has the answer here rather than re-deriving it from a scary-looking count.
 */
export const SCRIPT_WRITTEN_FIELDS: ReadonlySet<string> = new Set([
  'field_sources', 'class_code', 'vin_last9', 'owning_area', 'cover_photo_url',
]);

/** One row of `vehicle_changes`, as much of it as this file needs. */
export interface VehicleChange {
  changedAt: string;             // ISO
  fields: readonly string[];     // the keys of `changed`
  /** `vehicle_changes.actor` — the uuid/crew-name the trigger recorded (migration 132). Optional
   *  because every row written before that migration genuinely has none. */
  actor?: string | null;
}

/**
 * Change rows → the interactions they prove.
 *
 * ⚠️ CALLED INTERACTIONS, NOT SCANS, and the noun is load-bearing. Two saves six seconds apart (his
 * key count then his odometer) are one visit but two interactions — and calling them interactions
 * makes the count LITERALLY TRUE with no merging, so no time window has to exist. `summariseSightings`
 * identifies rows by equality and never by a window; this keeps that promise instead of quietly
 * introducing the first threshold.
 *
 * ✅ And precision is explicitly not the point. Aaron: *"even if the count is slightly inaccurate
 * because i'm performing an action at home with my feet up and pants off, its totally fine."* The
 * number is already an order of magnitude short of the truth; do not add heuristics to defend its
 * last decimal.
 *
 * ⭐ WHO, at last (2026-09-01). This comment used to read *"`vehicle_changes` has no `changed_by`.
 * A derived interaction carries WHEN, never WHO"* — true the day it was written, and quietly false
 * from **migration 132** onward, which added `actor` and is the reason the change log right below
 * this list can print "by Aaron S." Aaron found it by reading the two panels against each other:
 * *"why does the record show who made the changes but interactions is inconsistent... it has my
 * name once and unknown for the rest."* The one named row was a real scan; the three unknowns were
 * his own writes, whose actor the query never selected.
 *
 * ⚠️ A COMMENT THAT OUTLIVED ITS FACT IS WORSE THAN NO COMMENT: it reads as a decision, so nobody
 * re-checks it. The value is passed through raw — resolving a uuid to a person belongs to whoever
 * holds the profiles, not to a pure function.
 */
export function sightingsFromChanges(rows: readonly VehicleChange[]): Sighting[] {
  const out: Sighting[] = [];
  for (const r of rows) {
    if (!r.changedAt) continue;
    if (!r.fields.some(f => !SCRIPT_WRITTEN_FIELDS.has(f))) continue;
    out.push({ seenAt: r.changedAt, seenByName: null, actor: r.actor ?? null });
  }
  return out;
}
