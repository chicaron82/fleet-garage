import type { ZoneShape } from './damageZones';

// The INSIDE of the car — Aaron, 2026-08-26, off two held cars and a screenshot showing
// "Missing part / accessory · WHERE Not recorded" on a Kicks whose note read "Missing rear headrest".
//
// ⭐ THE EXTERIOR MAP IS A SURFACE MAP AND THIS IS A DIFFERENT AXIS. It can say *dent, here*; it
// structurally cannot say *this should exist and doesn't*. Every case he brought was something
// MISSING or NOT WORKING inside the cabin — a cigarette lighter on a couple of VWs, a rear headrest
// on the Kicks, a chewed bedliner in a Seltos trunk, a rear-driver buckle that wouldn't retract.
// FG already had the hold TYPE for all of those and nowhere to put the WHERE.
//
// ⭐⭐ GRANULARITY IS DELIBERATELY COARSE, and this is the rule for every future zone request:
//
//   *"the map gives the general zone. photo/description tells the specifics. just like exterior. if
//    there's a damage on the front bumper on the passengers side, the zone tapped is the bumper. on
//    the photo i could see where exactly it is."*
//
// The map makes damage FINDABLE and COUNTABLE; the photo makes it PRECISE. That is why the exterior
// has `front-bumper` and not `front-bumper-passenger-corner-lower`, and it is why the third row here
// is ONE BENCH — *"it could be 3 seats or could be 2"*, and the photo settles which.
//
// Coordinates are a top-down cabin on the same 900-wide canvas as the exterior map, so the two views
// swap without the picker resizing under his thumb.

/** Rendered only when the third-row toggle is on. A car without one must not offer a phantom seat. */
export const THIRD_ROW_ZONE_ID = 'seat-third-bench';

export const INTERIOR_ZONES: readonly ZoneShape[] = [
  // Front row — the dash furniture sits between the seats, where it does in the car.
  { id: 'seat-front-driver',    name: 'Front — driver',    x: 175, y: 400, w: 150, h: 110, rx: 14 },
  { id: 'seat-front-passenger', name: 'Front — passenger', x: 175, y: 190, w: 150, h: 110, rx: 14 },
  { id: 'head-unit',            name: 'Head unit',         x: 100, y: 300, w: 70,  h: 100, rx: 8 },
  { id: 'centre-console',       name: 'Centre console',    x: 175, y: 300, w: 150, h: 100, rx: 10 },

  // ⚠️ Second row is THREE positions. Both of his real cases were position-specific — a missing
  // headrest on the rear PASSENGER seat, a buckle not retracting on the rear DRIVER — so a single
  // "rear seats" zone would have pushed the position straight back into the note, rebuilding the
  // exact thing this replaces.
  { id: 'seat-second-driver',    name: '2nd row — driver',    x: 345, y: 400, w: 140, h: 110, rx: 14 },
  { id: 'seat-second-centre',    name: '2nd row — centre',    x: 345, y: 300, w: 140, h: 100, rx: 14 },
  { id: 'seat-second-passenger', name: '2nd row — passenger', x: 345, y: 190, w: 140, h: 110, rx: 14 },

  // One bench, on purpose — see the granularity note above.
  { id: THIRD_ROW_ZONE_ID,       name: '3rd row — bench',     x: 505, y: 190, w: 140, h: 320, rx: 14 },

  // ⚠️ `cargo-area`, NOT `trunk`. The exterior map already owns `trunk-liftgate` — that is the LID.
  // Aaron: *"one is on the outside and the other is for inside so i should be able to tell those two
  // apart."* Distinct ids so a stored tag can never be ambiguous about which side of the metal it means.
  { id: 'cargo-area',            name: 'Cargo area',          x: 665, y: 190, w: 135, h: 320, rx: 14 },
] as const;

export const INTERIOR_ZONE_IDS = INTERIOR_ZONES.map(z => z.id);

/** The cabin shell the zones sit inside — same canvas as CAR_OUTLINE so the views swap cleanly. */
export const CABIN_OUTLINE = {
  viewBox: '0 112 900 496',
  shells: [{ x: 90, y: 180, w: 720, h: 340, rx: 30 }],
  /** Row separators. Cosmetic only — the hit boxes are the zones. */
  seams: [
    [335, 180, 335, 520], [495, 180, 495, 520], [655, 180, 655, 520],
  ] as ReadonlyArray<readonly [number, number, number, number]>,
} as const;

/**
 * The zones to SHOW, given whether the car has a third row.
 *
 * ⚠️ The toggle stores nothing — Aaron: *"toggle if exists."* It reveals a position while he is
 * tagging; if he taps it, the TAG is the record. A stored per-vehicle "has third row" would be a
 * schema field and a thing to maintain, and the class already implies the answer
 * (his own note: large classes L and up with a third row keep it UP, because the seating IS the
 * upsell — so a third row is a property of the CLASS, not of the individual car).
 */
export function interiorZonesFor(hasThirdRow: boolean): readonly ZoneShape[] {
  return hasThirdRow ? INTERIOR_ZONES : INTERIOR_ZONES.filter(z => z.id !== THIRD_ROW_ZONE_ID);
}

/**
 * Should the third-row toggle start ON?
 *
 * ⚠️ Derived from the TAGS, never from a guess about the car. A hold already tagged on the third row
 * must render that tag — turning the toggle off by default would hide an existing record, which is
 * the "correction path vanishes" defect in a new outfit.
 */
export function thirdRowTaggedIn(zoneIds: readonly string[]): boolean {
  return zoneIds.includes(THIRD_ROW_ZONE_ID);
}
