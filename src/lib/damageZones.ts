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
