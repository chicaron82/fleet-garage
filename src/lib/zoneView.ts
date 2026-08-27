import { INTERIOR_ZONE_IDS, thirdRowTaggedIn } from './interiorZones';

// Which map to open on — Aaron, 2026-08-26, once the interior map existed alongside the exterior one.
//
// ⚠️ THIS FILE ONCE AUTO-SWITCHED TO THE CABIN when every tag was interior, to stop such a hold
// opening on an empty exterior map and reading as "no zones recorded". Aaron killed that the same
// day, scanning a car with a cig burn on the 2nd-row seat and no exterior damage:
//
//   *"I would rather it show me exterior clear first and 'interior - 1' on the toggle … because I may
//    accidentally read that interior damage on the rear passenger seat zone as exterior damage on the
//    rear passenger door. and until I tap that zone to look at the photo I wouldn't have known
//    what/where it was"*
//
// ⭐⭐ Both maps share a silhouette AND the FRONT/REAR/PASSENGER/DRIVER labels — deliberately, so they
// agree about orientation. The cost is that a red square in the cabin's 2nd row sits almost exactly
// where the rear passenger DOOR sits outside. Landing on a map he did not choose, he has no cue which
// one he is on until he taps a zone for its photo.
//
// ⭐⭐⭐ AND I HAD BUILT TWO SOLUTIONS TO ONE PROBLEM. `countOnView` already prevents the empty-map
// misread — the inactive tab carries a count, so the same hold reads "[Exterior] (clear) [Interior·1]",
// which says BOTH true things at once and never moves him. The badge was the better half all along;
// the auto-switch was the weaker one that also carried a hazard.

export type ZoneView = 'exterior' | 'interior';

const INTERIOR = new Set<string>(INTERIOR_ZONE_IDS);

export function isInteriorZone(id: string): boolean {
  return INTERIOR.has(id);
}

/**
 * Should the third-row toggle start on?
 *
 * Derived from the tags, never guessed from the car — a hold already tagged on the bench must render
 * that tag rather than hide it behind a toggle he has to think to flip.
 */
export function initialThirdRow(selected: readonly string[]): boolean {
  return thirdRowTaggedIn(selected);
}

/** How many of the current tags live on the OTHER map — the number the toggle should advertise, so
 *  switching views is never a blind guess about whether anything is over there. */
export function countOnView(selected: readonly string[], view: ZoneView): number {
  return selected.filter(id => (view === 'interior' ? isInteriorZone(id) : !isInteriorZone(id))).length;
}
