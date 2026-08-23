// WHERE the damage is, on the car. A hold has always carried WHAT (damage_description, a picklist)
// and WHAT IT LOOKS LIKE (photos) — never WHICH PANEL, except as prose in `notes` that nothing can
// query. These zones are that missing third thing.
//
// ⭐ THE ZONE IS AN INDEX, NOT A MEASUREMENT. Aaron cut two richer versions of this on 2026-08-21 —
// leader lines you drag to the exact spot, then a scratch/dent/missing picker — with the same
// reasoning both times: "the zone gives the idea, the photo shows where it is more accurately".
// He hand-circles the damage in the photo already. So a zone never needs to be precise; it needs
// to be TAPPABLE and QUERYABLE, and the picture keeps doing what it was always doing.
//
// ⭐ AND NO CAMERA (his cut of 2026-08-22, the one that decided the feature): tagging a zone is an
// annotation on a record that ALREADY has its photographs. Tie it to a live capture and the feature
// can only ever reach cars he is physically standing at — which locks out every hold already on the
// books, and those are precisely the ones FG exists for (old damage circulating unrepaired).
//
// Geometry is a top-down car on a 900x700 canvas, ported from the mock we agreed on.
// Passenger side is UP, driver side is DOWN, front is LEFT — the orientation of the paper
// Vehicle Inspection slip (#9000501) he fills by hand, so the two read the same way round.

/** Every zone id. Stored verbatim in `holds.damage_zones`, so these strings are DATA:
 *  renaming one silently orphans every hold already tagged with it. Add freely; never rename. */
export const DAMAGE_ZONE_IDS = [
  'front-bumper', 'hood', 'windshield', 'roof', 'rear-glass', 'trunk-liftgate', 'rear-bumper',
  'passenger-front-quarter', 'passenger-front-door', 'passenger-rear-door', 'passenger-rear-quarter',
  'driver-front-quarter', 'driver-front-door', 'driver-rear-door', 'driver-rear-quarter',
  'wheel-passenger-front', 'wheel-passenger-rear', 'wheel-driver-front', 'wheel-driver-rear',
  'mirror-passenger', 'mirror-driver',
  'rocker-passenger', 'rocker-driver',
] as const;

export type DamageZoneId = (typeof DAMAGE_ZONE_IDS)[number];

export interface DamageZone {
  id: DamageZoneId;
  /** What a human calls it — the chip text, and the words in his own notes. */
  name: string;
  /** Drawing + hit box on the 900x700 canvas. */
  x: number; y: number; w: number; h: number;
  /** Rounded like the part it stands for: bumpers are capsules, wheels and mirrors are pills. */
  rx: number;
}

/** Ordered front → back, centre line first, then passenger side, driver side, wheels, mirrors.
 *  The order IS the display order: a chip list reads nose-to-tail rather than tap-order. */
export const DAMAGE_ZONES: readonly DamageZone[] = [
  { id: 'front-bumper',   name: 'Front bumper',     x: 100, y: 235, w: 58,  h: 230, rx: 26 },
  { id: 'hood',           name: 'Hood',             x: 158, y: 280, w: 162, h: 140, rx: 4 },
  { id: 'windshield',     name: 'Windshield',       x: 320, y: 280, w: 65,  h: 140, rx: 4 },
  { id: 'roof',           name: 'Roof',             x: 385, y: 280, w: 170, h: 140, rx: 4 },
  { id: 'rear-glass',     name: 'Rear glass',       x: 555, y: 280, w: 65,  h: 140, rx: 4 },
  { id: 'trunk-liftgate', name: 'Trunk / liftgate', x: 620, y: 280, w: 122, h: 140, rx: 4 },
  { id: 'rear-bumper',    name: 'Rear bumper',      x: 742, y: 235, w: 58,  h: 230, rx: 26 },

  { id: 'passenger-front-quarter', name: 'Passenger front quarter', x: 158, y: 190, w: 162, h: 90, rx: 4 },
  { id: 'passenger-front-door',    name: 'Passenger front door',    x: 320, y: 190, w: 150, h: 90, rx: 4 },
  { id: 'passenger-rear-door',     name: 'Passenger rear door',     x: 470, y: 190, w: 150, h: 90, rx: 4 },
  { id: 'passenger-rear-quarter',  name: 'Passenger rear quarter',  x: 620, y: 190, w: 122, h: 90, rx: 4 },

  { id: 'driver-front-quarter',    name: 'Driver front quarter',    x: 158, y: 420, w: 162, h: 90, rx: 4 },
  { id: 'driver-front-door',       name: 'Driver front door',       x: 320, y: 420, w: 150, h: 90, rx: 4 },
  { id: 'driver-rear-door',        name: 'Driver rear door',        x: 470, y: 420, w: 150, h: 90, rx: 4 },
  { id: 'driver-rear-quarter',     name: 'Driver rear quarter',     x: 620, y: 420, w: 122, h: 90, rx: 4 },

  { id: 'wheel-passenger-front', name: 'Wheel — passenger front', x: 215, y: 148, w: 86, h: 44, rx: 9 },
  { id: 'wheel-passenger-rear',  name: 'Wheel — passenger rear',  x: 545, y: 148, w: 86, h: 44, rx: 9 },
  { id: 'wheel-driver-front',    name: 'Wheel — driver front',    x: 215, y: 508, w: 86, h: 44, rx: 9 },
  { id: 'wheel-driver-rear',     name: 'Wheel — driver rear',     x: 545, y: 508, w: 86, h: 44, rx: 9 },

  { id: 'mirror-passenger', name: 'Mirror — passenger', x: 326, y: 166, w: 40, h: 26, rx: 6 },
  { id: 'mirror-driver',    name: 'Mirror — driver',    x: 326, y: 508, w: 40, h: 26, rx: 6 },

  // ⭐ ADDED 2026-08-22, and the fleet asked for them. Building the note matcher meant reading his
  // real hold notes, and "side skirt" turns up over and over — "Driver side side skirt", "Side skirt
  // passenger side", "Passenger side skirt", "Side skirt dents". The map he'd been given had nowhere
  // to put a panel he names constantly, so the catalogue was wrong, not the notes.
  { id: 'rocker-passenger', name: 'Side skirt — passenger', x: 366, y: 166, w: 170, h: 26, rx: 6 },
  { id: 'rocker-driver',    name: 'Side skirt — driver',    x: 366, y: 508, w: 170, h: 26, rx: 6 },
];

const BY_ID = new Map<string, DamageZone>(DAMAGE_ZONES.map(z => [z.id, z]));
const ORDER = new Map<string, number>(DAMAGE_ZONES.map((z, i) => [z.id, i]));

/** The static body outline — drawn under the zones so the shape reads as a car, not a grid. */
export const CAR_OUTLINE = {
  viewBox: '0 112 900 496',
  /** Body shell, cabin, and the two bumper capsules. */
  shells: [
    { x: 140, y: 190, w: 620, h: 320, rx: 38 },   // body
    { x: 320, y: 280, w: 300, h: 140, rx: 26 },   // cabin
  ],
  /** Panel seams. Purely cosmetic — the hit boxes are the zones themselves. */
  seams: [
    [320, 190, 320, 280], [470, 190, 470, 280], [620, 190, 620, 280],
    [320, 420, 320, 510], [470, 420, 470, 510], [620, 420, 620, 510],
    [158, 190, 158, 510], [742, 190, 742, 510],
    [385, 280, 385, 420], [555, 280, 555, 420],
  ] as ReadonlyArray<readonly [number, number, number, number]>,
} as const;

/** True when `id` is a zone this build knows. Guards data read back from a row: an unknown id
 *  means the DB is ahead of the client, which must not crash a hold card. */
export function isDamageZoneId(id: string): id is DamageZoneId {
  return BY_ID.has(id);
}

/** Human label for a stored id. Unknown ids come back as themselves rather than blank — a hold
 *  tagged by a newer build should still show SOMETHING rather than silently lose its zone. */
export function zoneLabel(id: string): string {
  return BY_ID.get(id)?.name ?? id;
}

/** Stored ids → display order (nose to tail), unknown ids last, duplicates dropped. */
export function orderZones(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const kept = ids.filter(id => (seen.has(id) ? false : (seen.add(id), true)));
  return kept.sort((a, b) => (ORDER.get(a) ?? Number.MAX_SAFE_INTEGER) - (ORDER.get(b) ?? Number.MAX_SAFE_INTEGER));
}

/** Tap semantics: present → removed, absent → added. Result is normalised to display order so
 *  what gets written is stable regardless of the order he tapped things in. */
export function toggleZone(current: readonly string[], id: string): string[] {
  return orderZones(current.includes(id) ? current.filter(z => z !== id) : [...current, id]);
}

/** A one-line read of the whole set, for a card that has no room for a diagram. */
export function summariseZones(ids: readonly string[]): string {
  const named = orderZones(ids).map(zoneLabel);
  if (named.length === 0) return '';
  if (named.length <= 2) return named.join(' · ');
  return `${named.slice(0, 2).join(' · ')} +${named.length - 2}`;
}

// ── The vehicle-level read ─────────────────────────────────────────────────────────────────────
// Aaron's design, 2026-08-22 from the lot: the map should also live ABOVE the hold history as a
// persistent, at-a-glance reference — "damage exists on that part of the car" — because the moment
// it matters is when he is standing at the vehicle with the paper inspection slip deciding what to
// circle. Per-hold tagging is data entry; THIS is what makes the tagging pay.

/** The only hold facts the vehicle map needs. Deliberately structural rather than `Hold`, so the
 *  derivation stays pure and testable without dragging the whole domain type in. */
export interface ZoneHoldFacts {
  status: string;
  damageZones?: string[];
  /** ISO — the most recent one across the standing holds is his "last seen". */
  flaggedAt: string;
}

/** Statuses where the damage is GONE from the car.
 *
 *  ⭐ RELEASED IS NOT ONE OF THEM, and that is the whole point. A pre-existing release means
 *  "accepted as-is, no repair planned, renting as-is" — the damage is still physically on the panel
 *  ([[reference_fg_status_semantics]]). Clear those and the map goes blank on precisely the cars it
 *  exists for: the ones carrying approved damage that circulates unrepaired. RETURNED came back
 *  with the damage still on it. Only a repair, or a hold that was never real, clears a panel. */
const CLEARED_STATUSES: ReadonlySet<string> = new Set(['REPAIRED', 'VOIDED']);

export interface VehicleDamage {
  /** Every panel still carrying damage, nose to tail, de-duplicated across holds. */
  zones: string[];
  /** When the most recent standing hold was flagged — null when nothing stands. */
  lastFlaggedAt: string | null;
}

/** Merge a vehicle's holds into "what is wrong with this car, right now, and where".
 *  A hold flipping to REPAIRED clears its panels with no second action from anyone. */
export function vehicleDamageZones(holds: readonly ZoneHoldFacts[]): VehicleDamage {
  const standing = holds.filter(h => !CLEARED_STATUSES.has(h.status) && (h.damageZones?.length ?? 0) > 0);
  const zones = orderZones(standing.flatMap(h => h.damageZones ?? []));
  const lastFlaggedAt = standing.reduce<string | null>(
    (latest, h) => (latest === null || h.flaggedAt > latest ? h.flaggedAt : latest), null);
  return { zones, lastFlaggedAt };
}

// ── The backfill queue ─────────────────────────────────────────────────────────────────────────
// 251 standing holds carry no zones. This orders them for a sitting-down-and-grinding pass, which
// is the journey Aaron actually described: "easier to back fill them, which I can do on my spare
// time." The screen that matters is not a field inside one hold — it is getting through a list.

export interface QueueHold {
  id: string;
  /** Every type on the hold. Only body damage has a panel — see MAPPABLE_TYPES. */
  holdTypes: readonly string[];
  /** Which car it belongs to — a car can carry several holds, and they must arrive together. */
  vehicleId: string;
  status: string;
  damageZones?: string[];
  notes: string;
  flaggedAt: string;
}

/** Newest first. Shared by both sort levels so a car and its holds order the same way. */
function newestFirst(a: string, b: string): number {
  return a < b ? 1 : a > b ? -1 : 0;
}

/** Hold types where "which panel?" is a meaningful question.
 *
 *  ⭐ EVERYTHING ELSE IS NOT "HE CANNOT TELL" — IT IS "THE QUESTION DOES NOT APPLY." Aaron, 92 holds
 *  into the backfill: "now what to do with the ones that can't be mapped. dismiss so it doesn't show
 *  up again?" The live answer was better than a dismiss button: 67 of those 92 were MECHANICAL
 *  (65 of them sub-type 'other', 2 tire-swaps), 14 were sale_car, 2 were missing_accessories, and
 *  only NINE were damage. A safety recall does not sit on a quarter panel; a car going to auction is
 *  not damage at all.
 *
 *  Same principle that already excludes REPAIRED and VOIDED: do not ask a question that has no
 *  answer. And deliberately NOT a dismissal — a dismiss button would let a REAL damage hold be
 *  hidden, and this whole feature exists because damage nobody wrote down comes back later as
 *  somebody's problem. A count that stays at two because two cars are genuinely unplaceable is
 *  telling the truth, and he can tag them next time he is standing at one. */
const MAPPABLE_TYPES: ReadonlySet<string> = new Set(['damage', 'hail']);

export function zoneBackfillQueue<T extends QueueHold>(
  holds: readonly T[],
  rank: (h: T) => number,
): T[] {
  const open = holds.filter(h =>
    !CLEARED_STATUSES.has(h.status)
    && (h.damageZones?.length ?? 0) === 0
    && h.holdTypes.some(type => MAPPABLE_TYPES.has(type)));

  // ⭐ GROUP BY CAR FIRST. The queue counts HOLDS; he experiences CARS — so when a car with two
  // separate damage records came round a second time for its other hold, it read as "my tag didn't
  // save" (Aaron, 2026-08-22, live: 30 of 132 remaining holds sat on a car he had already tagged).
  // Keeping a car's holds adjacent turns "why am I seeing this again?" into "right, this one has two".
  //
  // A car inherits its BEST hold's rank, so the easiest-first ordering still holds at the car level
  // and the run still opens with a stretch of one-tap confirmations.
  const byCar = new Map<string, { rank: number; at: string; holds: T[] }>();
  for (const h of open) {
    const car = byCar.get(h.vehicleId);
    const r = rank(h);
    if (!car) byCar.set(h.vehicleId, { rank: r, at: h.flaggedAt, holds: [h] });
    else {
      car.rank = Math.min(car.rank, r);
      if (h.flaggedAt > car.at) car.at = h.flaggedAt;
      car.holds.push(h);
    }
  }

  return [...byCar.values()]
    .sort((a, b) => a.rank - b.rank || newestFirst(a.at, b.at))
    .flatMap(car => car.holds.sort((a, b) => rank(a) - rank(b) || newestFirst(a.flaggedAt, b.flaggedAt)));
}

// ── Presets ────────────────────────────────────────────────────────────────────────────────────
// Aaron, after tagging his way through 80 cars: "hail cars i think should have a preset that covers
// the hood, roof and trunk."
//
// ⭐ A preset is not a guess — it is a shape the damage takes. Hail falls DOWNWARD, so it lands on
// the horizontal surfaces and a hail hold is nearly always the same three panels. Live fleet: 32
// hail-typed holds, and all 32 mention hail in their text too, so the hold type alone identifies
// them cleanly. 25 of those are standing, which is 25 holds in the backfill queue that become one
// tap each.
//
// ⭐⭐ GLASS IS DELIBERATELY OUT, and the reason is Aaron's, not a scope decision:
//
//   "its mainly body damage that is visible. is that chip from hail or is it pre-existing? i don't
//    know. its ambiguous. was the window smashed because of hail or was it from vandalism. again, i
//    don't know. so i think its a better call to have glass damage a separate tap if it exists."
//
// A preset asserts a CAUSE, not just a location. Tapping this says "the hail damage is on these
// panels" — true for horizontal sheet metal, because hail falls downward and lands there. A chip in
// the windshield could be hail, a stone off a gravel truck, or something that was there in March,
// and neither the panel nor the hold type can tell you which. Folding glass in would write an
// unverified causal claim into 25 records from a single tap.
//
// A deliberate tap on the windshield is a person saying "I looked, and I think this one is hail."
// That is worth something. A preset saying it is worth nothing. Same rule as the plate ↔ owning
// check refusing to name a culprit and the note matcher refusing to pre-select: never let the
// machine assert what only a person can see.

const HAIL_ZONES: readonly string[] = ['hood', 'roof', 'trunk-liftgate'];

export interface ZonePreset { label: string; zones: string[] }

/** The preset offered for a hold, or null when its damage has no characteristic shape. */
export function presetFor(holdTypes: readonly string[] | undefined): ZonePreset | null {
  if (!holdTypes?.includes('hail')) return null;
  return { label: 'Hail — hood, roof, trunk', zones: [...HAIL_ZONES] };
}
