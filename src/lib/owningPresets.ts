// The owning-area buttons: branches FG can name, that this fleet actually carries, commonest first.
//
// ⭐ Aaron, 2026-08-29, auditing: *"what do you think of adding presets for me to tag for the known
// canadian ownings? typing them out is tedious and repetitive lol so i can only do them in batches
// before i go do something else."* The auditor's whole value is the cycle being frictionless, and
// eight keystrokes per car is exactly the kind of tax that turns a session into a batch.
//
// ⚠️ "KNOWN" IS NOT A NEW LIST. It is the `KNOWN` map in owningArea.ts, every entry of which was
// confirmed with him one at a time — so a preset is by definition a branch he has already named.
// That is also what keeps the two he asked to exclude out for free: `2294` (the US branch on the
// Florida Compass) and `8892` have no name, so neither can become a button. His words: *"leave an
// option to input manually if its a US car or something totally different from what's known."*
//
// Pure: no DB, no React.
import { knownOwningCodes, owningLabel } from '../../api/_lib/owningArea';

export interface OwningPreset {
  /** The number, as stored — no leading zero. */
  code: string;
  /** "Winnipeg (8199)" — for the button's title, never its face. */
  label: string;
  /** How many cars on the fleet carry it. Ordering only. */
  count: number;
}

/** The narrow shape this needs. */
export interface OwningPresetVehicle { owningArea?: string | null }

/**
 * Named branches this fleet actually uses, commonest first.
 *
 * ⭐ ORDERED BY LIVE COUNT rather than hardcoded, for the same reason the unit-prefix tally is a
 * tally: *"the numbers ROTATE... both the owning and the prefix list have already changed once in
 * his tenure."* Winnipeg is 284 of 365 today and sits first; if the fleet's shape changes, so does
 * the order, with nobody remembering to update anything.
 *
 * ⚠️ INTERSECTED WITH THE LIVE FLEET — a code nothing carries gets no button.
 *
 * ⚠⚠ **THIS COMMENT USED TO CLAIM THE INTERSECTION "QUIETLY DROPS 8999", AND IT DOES NOT
 * (corrected 2026-09-16, found by a pass-two sweep of everything `KNOWN` reaches).** The claim
 * rested on "no car wears it today", which is false and has been for a while: **`KUR261` (the lot
 * shuttle) and `LJF670` both carry 8999 right now**, so the list renders an 8999 button and always
 * has. The reasoning was sound — a button for a retired owning IS an invitation to file a car under
 * a branch that no longer exists — but it was a stated INTENT that no code implements, sitting in a
 * position that reads like a description of behaviour. ⭐ **A comment describing what the code does
 * is a claim, and a claim about live data expires.** Whether 8999 should be suppressed is Aaron's
 * call (the two cars are real and he scans the shuttle like anything else), so nothing was gated on
 * my opinion — only the false sentence removed. Same treatment as the archived badge's
 * "viewing only".
 *
 * The counts in the paragraph above are likewise a snapshot, not a guarantee — it was 284 of 365
 * when written and is 525 of 770 today.
 */
export function owningPresets(vehicles: readonly OwningPresetVehicle[]): OwningPreset[] {
  const known = new Set(knownOwningCodes());
  const counts = new Map<string, number>();
  for (const v of vehicles) {
    const code = (v.owningArea ?? '').trim();
    if (!code || !known.has(code)) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([code, count]) => ({ code, label: owningLabel(code), count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}
