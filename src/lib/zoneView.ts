import { INTERIOR_ZONE_IDS, thirdRowTaggedIn } from './interiorZones';

// Which map to open on — Aaron, 2026-08-26, once the interior map existed alongside the exterior one.
//
// ⚠️ THIS EXISTS TO STOP A TAG BECOMING INVISIBLE. A hold whose only tag is `seat-second-passenger`
// opening on the EXTERIOR map shows an empty car with nothing selected, which reads as "no zones
// recorded" — the recorded-but-not-knowable defect, reintroduced by the very feature meant to fix it.
// The view has to follow the data rather than default blindly.

export type ZoneView = 'exterior' | 'interior';

const INTERIOR = new Set<string>(INTERIOR_ZONE_IDS);

export function isInteriorZone(id: string): boolean {
  return INTERIOR.has(id);
}

/**
 * The view a picker should open on, given what is already tagged.
 *
 * ⭐ EXTERIOR WINS A TIE, deliberately. It is the overwhelmingly common case and the one every
 * existing hold uses, so a mixed hold opens where the operator expects and the interior is one tap
 * away. Only a hold that is PURELY interior opens on the cabin — the case that would otherwise
 * render as empty.
 */
export function initialZoneView(selected: readonly string[]): ZoneView {
  if (selected.length === 0) return 'exterior';
  const anyExterior = selected.some(id => !isInteriorZone(id));
  return anyExterior ? 'exterior' : 'interior';
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
