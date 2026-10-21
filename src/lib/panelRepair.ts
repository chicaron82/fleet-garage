import { orderZones } from './damageZones';

// Repairing SOME of a hold's panels.
//
// Aaron, 2026-10-21, 0ET075: *"was just sent to get its ws chips repaired. finished the same day. went
// to mark as repaired, but i'm afraid it will "repair" the rim damage as well."* He was right. One
// damage hold carried the windshield AND the rear rim, and a repair is a fact about a whole hold — so
// fixing the chips would have cleared the rim off the map and the car to Clear.
//
// ⭐ A PART REPAIR IS A SPLIT. The fixed panels leave on a new row that is born REPAIRED; the original
// keeps its id and the panels still damaged. The original keeps the id because everything that
// points at a hold — its release, a re-hold's `linked_hold_id` — is about the damage still on the car.
//
// ⚠️ FG NEVER GUESSES WHICH PHOTO OR DESCRIPTION GOES WITH WHICH PANEL. Nothing on the row says so (the
// zone is an index, the photo carries the spot — see damageZones). He picks; whatever he leaves alone
// stays on the OPEN hold. Wrong in that direction over-reports damage that is gone; wrong the other
// way loses damage that is still there, which is the one thing FG exists to stop.

/** The presets a multi-pick description was joined from — `Windshield chip; Rim / hubcap damage`. */
export function descriptionParts(description: string): string[] {
  return description.split(';').map(p => p.trim()).filter(Boolean);
}

/** True when a repair on this hold should ask which panels got fixed. Multi-type holds already resolve
 *  per issue (IssueResolutionSection), so they never get here. */
export function offersPanelPick(hold: { holdTypes: readonly string[]; damageZones?: readonly string[] }): boolean {
  return hold.holdTypes.length === 1 && orderZones(hold.damageZones ?? []).length >= 2;
}

export interface PanelSide {
  zones: string[];
  photos: string[];
  description: string;
}

export type PanelRepairPlan =
  | { kind: 'whole' }
  | { kind: 'split'; fixed: PanelSide; standing: PanelSide };

export interface PanelPick {
  zones: readonly string[];
  photos: readonly string[];
  parts: readonly string[];
}

/**
 * What a repair with this pick will write. Every panel picked (or none) is today's whole-hold repair;
 * anything between is a split. Picked photos and parts go with the fix, the rest stay on the hold.
 *
 * ⚠️ A description is never left EMPTY. If he picks no part, or every part, both sides keep the whole
 * description — an honest over-statement beats a hold that says nothing about its own damage.
 */
export function planPanelRepair(
  hold: { damageZones?: readonly string[]; photos?: readonly string[]; damageDescription: string },
  pick: PanelPick,
): PanelRepairPlan {
  const zones = orderZones(hold.damageZones ?? []);
  const fixedZones = zones.filter(z => pick.zones.includes(z));
  if (fixedZones.length === 0 || fixedZones.length === zones.length) return { kind: 'whole' };

  const photos = hold.photos ?? [];
  const parts = descriptionParts(hold.damageDescription);
  const fixedParts = parts.filter(p => pick.parts.includes(p));
  const partsSplit = fixedParts.length > 0 && fixedParts.length < parts.length;

  return {
    kind: 'split',
    fixed: {
      zones: fixedZones,
      photos: photos.filter(p => pick.photos.includes(p)),
      description: partsSplit ? fixedParts.join('; ') : hold.damageDescription,
    },
    standing: {
      zones: zones.filter(z => !pick.zones.includes(z)),
      photos: photos.filter(p => !pick.photos.includes(p)),
      description: partsSplit ? parts.filter(p => !pick.parts.includes(p)).join('; ') : hold.damageDescription,
    },
  };
}
