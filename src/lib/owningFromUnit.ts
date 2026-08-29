// What the fleet's own unit numbers say about a car's owning branch.
//
// ⭐ AARON'S SHORTCUT, MECHANISED. Working the audit queue: *"its kinda easy to knock out... see
// calgary, 8193 — anything with unit number 542**** or 549**** enter owning 8199, vancouver 8191 and
// so on. the ones that i'll stop on are ones i'm unsure of."* He reads a unit prefix and knows the
// branch. This computes the same thing, and — the actual point — computes **which ones he should
// stop on**.
//
// ⚠️⚠️ WHY THIS IS A LIVE TALLY AND NOT A PREFIX TABLE. `owningArea.ts` opens with the reason a
// table must never be hardcoded: *"The numbers ROTATE. When Aaron started, Winnipeg's owning was
// 8999 with units 589xxxx... Both the owning and the prefix list have already changed once in his
// tenure. So a prefix→branch table is a convention that silently rots."* That warning is right and
// it is why this file derives from the CURRENT fleet on every call. A constant would go on
// confidently answering after the next renumber; a tally re-reads reality and moves with it.
//
// ⚠️ AND IT NEVER FILLS A FIELD. Measured 2026-08-28: 26 of 29 prefixes map to exactly one branch,
// and THREE DO NOT — 577 is 6× Calgary and 1× Winnipeg, 586 is 3 and 1, 711 is 1 and 1. Those
// minority rows came off scanned tags, so the ambiguity is real rather than dirty data. A silent
// autofill would have written Calgary onto a Winnipeg car and stamped it 'manual', locked, from a
// tap he made without looking.
//
// Pure: no DB, no React. The caller hands in the fleet it already holds.

/** The narrow shape this needs — a subset of Vehicle, so the module stays decoupled. */
export interface UnitOwningVehicle {
  unitNumber?: string | null;
  owningArea?: string | null;
}

/** One branch the prefix has been seen on, and how often. */
export interface OwningTally { owningArea: string; count: number }

export interface OwningGuess {
  /** The prefix the guess is keyed on, e.g. "542". Empty when the unit is unusable. */
  prefix: string;
  /** Every branch seen on this prefix, commonest first. Empty when FG has never seen it. */
  tally: OwningTally[];
  /** Total cars behind the tally. */
  seen: number;
  /** The branch to offer — null when the evidence does not justify offering one. */
  suggestion: string | null;
  /** True when more than one branch has been seen on this prefix. He should look at the tag. */
  ambiguous: boolean;
}

/** The number of leading digits that identify a fleet block. Aaron's own examples are three
 *  ("542****", "549****"), and the measured data agrees: at 3 digits the fleet splits into 29
 *  blocks, 26 of them single-branch. */
export const UNIT_PREFIX_LEN = 3;

/** Below this many observations a "majority" is noise — two cars agreeing proves very little, and
 *  offering a value he then locks as 'manual' deserves more than that. */
const MIN_SEEN = 3;

/** How much of the block must agree before FG offers anything. 711 (one and one) offers nothing;
 *  577 (six and one, 86%) offers Calgary AND shows the dissent, which is the case he described
 *  stopping on. */
const MIN_SHARE = 0.8;

function prefixOf(unitNumber: string | null | undefined): string {
  const digits = (unitNumber ?? '').replace(/\D/g, '');
  return digits.length >= UNIT_PREFIX_LEN ? digits.slice(0, UNIT_PREFIX_LEN) : '';
}

/**
 * What the fleet says about this unit's branch.
 *
 * ⚠️ Excludes the car being asked about — otherwise a record would corroborate itself, which is
 * only invisible until the day it is wrong.
 */
export function owningFromUnit(
  unitNumber: string | null | undefined,
  fleet: readonly UnitOwningVehicle[],
  /** Unit number of the car being audited, so it cannot vote on its own answer. */
  excludeUnit?: string | null,
): OwningGuess {
  const prefix = prefixOf(unitNumber);
  const empty: OwningGuess = { prefix, tally: [], seen: 0, suggestion: null, ambiguous: false };
  if (!prefix) return empty;

  const skip = (excludeUnit ?? '').replace(/\D/g, '');
  const counts = new Map<string, number>();
  let seen = 0;
  for (const v of fleet) {
    const area = v.owningArea?.trim();
    if (!area) continue;
    const digits = (v.unitNumber ?? '').replace(/\D/g, '');
    if (digits.slice(0, UNIT_PREFIX_LEN) !== prefix) continue;
    if (skip && digits === skip) continue;
    counts.set(area, (counts.get(area) ?? 0) + 1);
    seen++;
  }
  if (seen === 0) return empty;

  const tally = [...counts.entries()]
    .map(([owningArea, count]) => ({ owningArea, count }))
    .sort((a, b) => b.count - a.count || a.owningArea.localeCompare(b.owningArea));

  const top = tally[0];
  const confident = seen >= MIN_SEEN && top.count / seen >= MIN_SHARE;
  return {
    prefix,
    tally,
    seen,
    suggestion: confident ? top.owningArea : null,
    ambiguous: tally.length > 1,
  };
}

/** One line he can read at a glance: "274 of 274 cars on 542 are 8199" / "6 of 7 · 1 says 8199". */
export function describeOwningGuess(guess: OwningGuess): string {
  if (guess.seen === 0) return '';
  const [top, ...rest] = guess.tally;
  const head = `${top.count} of ${guess.seen} cars on ${guess.prefix} — ${top.owningArea}`;
  if (rest.length === 0) return head;
  return `${head} · ${rest.map(t => `${t.count} say ${t.owningArea}`).join(', ')}`;
}
