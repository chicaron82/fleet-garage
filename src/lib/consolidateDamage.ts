// One line per real defect on the scan card, instead of one line per hold.
//
// Aaron, 2026-08-29, standing at a car that had been held and released several times: *"two
// pre-existing shows up. i had one on my last shift that gave me a wall of like 4 of the same
// damage. are we able to consolidate the same ones so the next scan would bring up just one of the
// same?"* The deepest card in the fleet is LFJ370 — four live lines, two of them byte-identical.
//
// ⭐⭐⭐ THE REPEATS ARE DELIBERATE, AND I HAD THIS BACKWARDS. Twenty-one of the twenty-two duplicate
// pairs are 3 to 115 days apart, and I read that as old-damage amnesia — someone re-flagging because
// they did not know. His correction:
//
//   *"re-flagged the same damage because i wanted to keep on record that it was held, then released.
//    flagged would have also be considered we held that car for the entire time, but really damage
//    was recorded, then it got released. held again for the same damage, and got released before
//    being flipped to pre-existing to avoid being held again."*
//
// **One long hold would say the car was off the road for three months.** Two hold/release pairs say
// what actually happened: held briefly, released, held briefly again, released. So these rows are a
// compressed SERVICE HISTORY he built on purpose, not redundancy — which is why consolidating must
// keep the CYCLE COUNT and the FIRST date rather than quietly collapsing them to one.
import type { ScanHoldLine } from './scanHoldSummary';

export interface ConsolidatedDamage {
  /** The newest hold in the group — its id keys the rendered row. */
  id: string;
  typeLabel: string;
  detail: string;
  /** How many hold/release cycles this one defect has been through. 1 for most. */
  cycles: number;
  /** ⭐ When it was FIRST put on record — which is what "pre-existing" actually means. */
  firstFlaggedAt: string;
  /** The most recent time it was flagged. */
  lastFlaggedAt: string;
  /** Union of every panel across the merged holds. */
  zones: string[];
  /** True when ANY cycle went out on exception — the car is carrying this right now. */
  onException: boolean;
}

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const zoneSet = (z: readonly string[]) => new Set(z.map(k => k.trim().toLowerCase()));
const isSubset = (a: Set<string>, b: Set<string>) => [...a].every(x => b.has(x));

/**
 * ⚠️ TEXT ALONE IS THE WRONG KEY, and there is a live counter-example. The descriptions are canned
 * category labels rather than descriptions of a specific mark, so two genuinely different defects
 * produce identical text:
 *
 *   LFJ285  "scratches and scuffs on rear passenger-side bumper corner…"
 *           2026-07-03  [rear-bumper]
 *           2026-08-06  [passenger-rear-quarter]        ← a different panel entirely
 *
 * Merging those would hide one real damage. So the key is the description AND the panels, and two
 * groups join only when one zone set CONTAINS the other — Aaron's call on the superset case:
 *
 *   0ES646  "scratch — paint surface"
 *           2026-04-28  [passenger-rear-quarter]
 *           2026-06-08  [passenger-rear-door, passenger-rear-quarter]   → *"0ES646 merge"*
 *
 * ⚠️ A hold with NO zones falls back to text-only and joins any group with the same words — also
 * his call. It is the older shape (5 live holds, 4 of them "Missing part / accessory", which has no
 * panel to point at) and leaving them un-consolidated would put the wall back on exactly the cars
 * that have carried damage longest.
 *
 * ⚠️ Known transitive edge: [x] merges into [x,y], and [y] then also merges into [x,y], so [x] and
 * [y] end up in one group without either containing the other. With real zone lists of one to three
 * panels this has no instance in the live data; if it ever bites, the fix is to compare against the
 * group's ORIGINAL set rather than its growing union.
 */
export function consolidateDamage(lines: readonly ScanHoldLine[]): ConsolidatedDamage[] {
  const groups: { line: ScanHoldLine; zones: Set<string>; members: ScanHoldLine[] }[] = [];

  for (const line of lines) {
    const z = zoneSet(line.zones ?? []);
    const g = groups.find(gr => {
      if (key(gr.line.detail) !== key(line.detail)) return false;
      if (z.size === 0 || gr.zones.size === 0) return true;             // text-only fallback
      return isSubset(z, gr.zones) || isSubset(gr.zones, z);            // one contains the other
    });
    if (g) {
      g.members.push(line);
      for (const x of z) g.zones.add(x);
    } else {
      groups.push({ line, zones: z, members: [line] });
    }
  }

  return groups.map(g => {
    const flagged = g.members.map(m => m.flaggedAt).sort();
    // The NEWEST member keys the row and supplies the label — it is the most recent statement of
    // what this defect is called, and its id is stable for React.
    const newest = g.members.reduce((a, b) => (a.flaggedAt > b.flaggedAt ? a : b));
    return {
      id: newest.id,
      typeLabel: newest.typeLabel,
      detail: newest.detail,
      cycles: g.members.length,
      firstFlaggedAt: flagged[0],
      lastFlaggedAt: flagged[flagged.length - 1],
      // Union across the group, ordered for a stable render.
      zones: [...new Set(g.members.flatMap(m => m.zones ?? []))].sort(),
      // ⭐ ANY cycle out on exception makes the whole line amber. Collapsing must never soften the
      // one thing worth shouting about — the car is out there carrying this right now.
      onException: g.members.some(m => m.onException),
    };
  }).sort((a, b) => (a.lastFlaggedAt < b.lastFlaggedAt ? 1 : -1));
}

/**
 * "held 3× since Apr 28" — the history his re-flagging deliberately created, in one clause.
 * Empty string for a single cycle, because "held 1×" is noise on the common case.
 */
export function cycleLabel(d: ConsolidatedDamage, fmt: (iso: string) => string): string {
  return d.cycles > 1 ? `held ${d.cycles}× since ${fmt(d.firstFlaggedAt)}` : '';
}
