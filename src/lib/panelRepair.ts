import { orderZones, holdIsMappable, presetFor } from './damageZones';
import type { HoldType, Repair } from '../types';

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

/** True when a repair on this one-type hold should ask which panels got fixed. A multi-type hold asks per
 *  issue instead — see issuePanelPick. */
export function offersPanelPick(hold: { holdTypes: readonly string[]; damageZones?: readonly string[] }): boolean {
  return hold.holdTypes.length === 1 && orderZones(hold.damageZones ?? []).length >= 2;
}

// ── Per issue, on a multi-type hold ──────────────────────────────────────────────────────────────
// Aaron, 2026-11-21, LJF720 (hail + a windshield chip on one hold, hood · windshield · roof · trunk): he
// marked the hail done, the map still painted all four panels, so the chip read as still-hail and he cleared
// it too. *"i think it should be aware. if it was hail, then the damage map for hail should be cleared once
// marked repair. if i marked chip repaired, then the windshield would be cleared."*
// Zones live on the hold, not per issue, so FG learns which panels an issue covered when it is marked done.

interface IssueHold {
  holdTypes: readonly string[];
  resolvedTypes: readonly string[];
  damageZones?: readonly string[];
  damageDescription: string;
}

export interface IssuePanelAsk {
  /** The last open issue: a full repair of what is left, so everything starts ticked. */
  last: boolean;
  /** What starts ticked. */
  preset: string[];
}

/**
 * Whether marking ONE issue done should ask which panels it cleared, and what starts ticked. Null is
 * today's single tap: one panel (nothing to split), an issue with no panel (mechanical, detail), or no
 * other panel issue left open to keep any panel for.
 *
 * ⚠️ Only hail has a preset to start from. Any other issue starts with nothing ticked: FG never guesses a panel.
 */
export function issuePanelPick(hold: IssueHold, type: string): IssuePanelAsk | null {
  const zones = orderZones(hold.damageZones ?? []);
  const panelled = (t: string) => holdIsMappable([t], hold.damageDescription);
  if (zones.length < 2 || !panelled(type)) return null;
  const open = hold.holdTypes.filter(t => !hold.resolvedTypes.includes(t));
  if (open.length === 1 && open[0] === type) return { last: true, preset: zones };
  if (!open.some(t => t !== type && panelled(t))) return null;
  const preset = presetFor([type])?.zones ?? [];
  return { last: false, preset: zones.filter(z => preset.includes(z)) };
}

export type IssuePanelPlan =
  | PanelRepairPlan
  /** Nothing ticked on an issue that isn't the last: mark it done, every panel stays (today's tap). */
  | { kind: 'resolve' }
  /** Everything ticked while another panel issue is still open, which has to sit on some panel. */
  | { kind: 'blocked' };

export function planIssuePanels(
  hold: { damageZones?: readonly string[]; photos?: readonly string[]; damageDescription: string },
  pick: PanelPick,
  last: boolean,
): IssuePanelPlan {
  const plan = planPanelRepair(hold, pick);
  if (plan.kind === 'split' || last) return plan;
  return orderZones(hold.damageZones ?? []).some(z => pick.zones.includes(z)) ? { kind: 'blocked' } : { kind: 'resolve' };
}

export interface PanelSide {
  zones: string[];
  photos: string[];
  description: string;
}

export type PanelRepairPlan =
  | { kind: 'whole' }
  | { kind: 'split'; fixed: PanelSide; standing: PanelSide };

/** A split made at ONE issue of a multi-type hold: the fixed row is typed to it, and `resolves` says whether
 *  the issue is now done or still stands on the panels left (context/panelRepair). */
export interface IssueSplit {
  type: HoldType;
  resolves: boolean;
}

/** The write behind every part repair (context/panelRepair). */
export type MarkPanelsRepaired = (
  holdId: string, fixed: PanelSide, standing: PanelSide, repair: Omit<Repair, 'id' | 'holdId'>, issue?: IssueSplit,
) => Promise<void>;

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
