// Resolving a plate the reader got wrong, using the OWNING AREA printed on the same key tag.
//
// ⭐⭐ Aaron, 2026-09-06, correcting three of my reads off a pump card in one line: *"8193 is calgary
// their plates are 1AB234 so that OHH120, is really 0HH120"*. A branch's plates have a SHAPE, and
// the shape says which character you got wrong.
//
// ⚠️⚠️ FG ALREADY KNEW THIS AND NEVER USED IT WHERE IT WOULD HELP. `expectedPlateShape` lives in
// api/_lib/owningArea and was imported by exactly two files: `fleetAudit` (which runs over records
// already SAVED) and the module defining it. The scan path applied only `correctManitobaPlate` —
// Manitoba, by name and design. So with the tag in his hand and the owning area printed on it, FG
// could not use the one fact that resolves the read. The knowledge and the moment it was needed
// lived in different files. (The `capability parity` line-check station, same week.)
//
// ⚠️⚠️ THE RULE THIS MUST NOT BREAK — `fleetAudit` bought it the hard way with `0ES919`, an
// Alberta-shaped plate on a Winnipeg-owned car where the spec said to suggest `OES919`, and the key
// tag showed the OWNING CODE was the wrong half. **The data cannot say which half is wrong.**
//
// ⭐ So this never argues from shape alone. A correction is offered ONLY when the corrected string
// RESOLVES TO A REAL VEHICLE — which turns a guess into a lookup. `OHH120` + area 8193 → try the
// digit-leading variant → `0HH120` EXISTS → offer that car. Nothing resolves, nothing is said.
import { LETTER_TO_DIGIT } from '../../api/_lib/platePrefix';
import { expectedPlateShape } from '../../api/_lib/owningArea';
import { normalizePlate, plateShape } from './fleetAudit';

/** The inverse of LETTER_TO_DIGIT — what a vision read produces where a LETTER belongs.
 *  ⚠️ Derived, never hand-written: two hand-maintained confusable maps drift the moment a pair is
 *  added to one, which is the same reasoning that made LETTER_TO_DIGIT "the one copy". */
const DIGIT_TO_LETTERS: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const [letter, digit] of Object.entries(LETTER_TO_DIGIT)) (out[digit] ??= []).push(letter);
  return out;
})();

/**
 * Single-character rewrites that move `plate` toward `expected`, at the positions where its shape
 * actually disagrees. Only those positions — a plate is not re-spelled, one character is unswapped.
 *
 * ⚠️ Returns [] when the lengths differ. A different LENGTH is a different format, not a misread:
 * a misread swaps a character, it does not add or drop one (`fleetAudit` states the same rule).
 */
export function shapeCandidates(plate: string, expected: string): string[] {
  const p = normalizePlate(plate);
  if (!expected || p.length !== expected.length) return [];
  const out: string[] = [];
  for (let i = 0; i < expected.length; i++) {
    const c = p[i];
    const wantDigit = expected[i] === '9';
    const isDigit = c >= '0' && c <= '9';
    if (wantDigit === isDigit) continue;              // this position already agrees
    const swaps = wantDigit ? [LETTER_TO_DIGIT[c]].filter(Boolean) : (DIGIT_TO_LETTERS[c] ?? []);
    for (const s of swaps) out.push(p.slice(0, i) + s + p.slice(i + 1));
  }
  return out;
}

export interface ShapeSuggestion { plate: string; from: string; shape: string }

/**
 * The car a misread plate probably belongs to, or null.
 *
 * ⚠️ EXACTLY ONE CANDIDATE OR NOTHING. Two plausible cars is not a suggestion, it is a coin toss —
 * and a coin toss offered with confidence is worse than silence at a lot at 6am.
 *
 * ⚠️ Silent when the plate ALREADY resolves: FG found the car, and second-guessing a hit is how a
 * good record gets overwritten by a cleverer wrong one.
 */
export function suggestPlateByShape(
  readPlate: string | null | undefined,
  owningArea: string | null | undefined,
  fleet: readonly { licensePlate: string }[],
): ShapeSuggestion | null {
  const p = normalizePlate(readPlate);
  if (!p) return null;
  const known = new Set(fleet.map(v => normalizePlate(v.licensePlate)));
  if (known.has(p)) return null;                      // it resolved — nothing to fix
  const expected = expectedPlateShape(owningArea);
  if (!expected || plateShape(p) === expected) return null;

  const hits = [...new Set(shapeCandidates(p, expected))].filter(c => known.has(c));
  return hits.length === 1 ? { plate: hits[0], from: p, shape: expected } : null;
}
