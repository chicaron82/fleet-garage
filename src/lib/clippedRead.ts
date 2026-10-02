// A key tag whose LEFT COLUMN never made it onto the label.
//
// ⭐ THE CASE (Aaron, 2026-09-13, FTR2260 / unit 5627245). The tag was printed so the PERFORATION
// cut through the left edge of the label: every line lost its first character.
//
//     MONTREAL  → ⌐ONTREAL      Last9vin: → ⌐ast9vin:
//     08194     → )8194         2SE150006 → ?SE150006
//     562 7245  → ⌐62 7245      FTR2260   → ⌐TR2260
//
// It is not a smudge, a blur, or a bad angle — the ink is crisp and the characters are ABSENT. No
// retake fixes it; the paper is short. *"that tag is perferated. so it was originally printed where
// the perferation was cutting off the left side of the tag."*
//
// ⚠️⚠️ WHAT FG DID WITH IT — two different wrong answers, from one defect:
//   • the leading `5` half-survives a read → unit matches exactly → plate `TR2260` ≠ `FTR2260` →
//     FG offers **"New plates — update"**, one tap from overwriting a hand-verified plate.
//   • the `5` is lost → unit reads `627245`, matches nothing, plate matches nothing →
//     FG offers to **register the car it already has**.
// *"each time i scan this tag it either asks me to register it or asks if its a replate."*
//
// ⭐⭐ THE DETECTOR NEEDS NO RECORD, AND THAT IS THE POINT. The obvious design compares the read to
// the matched vehicle — but the worse of the two failures is the one where NOTHING MATCHED, so a
// record-based check is unavailable exactly when it is most needed. What makes this provable from
// the read alone is that two of the tag's fields have FIXED lengths: a Hertz unit number is always
// 7 digits, a stored last-9 is always 9 characters. One field coming up short is a bad read; TWO
// fixed-length fields simultaneously short by exactly one is a shifted label.
//
// ⚠️ ONE FIELD IS NEVER ENOUGH. A single short field is the ordinary case — a thumb over the last
// digit, a glare on the VIN — and treating it as a clipped tag would send a normal bad read down a
// suffix-matching path it has no business on. The confidence comes entirely from the AGREEMENT of
// two independent fields, which is the same argument the VIN backfill's two-model rule rests on.
//
// Same family as `cityTailInRentalClass` (the keyring hole eating the TOP line, LUR247) — that one
// loses a row, this one loses a column.
import type { KeytagRead } from '../../api/_lib/keytagRead';

/** A Hertz unit number is seven digits, always — printed in two groups ("562 7245"). */
const UNIT_LEN = 7;
/** A stored last-9 is nine characters, always — it is literally VIN positions 9–17. */
const VIN_LEN = 9;
/** A model code is four characters, always ("CTXF"). The third fixed-length field on the tag. */
const CODE_LEN = 4;

/** Digits only; the tag prints the unit spaced and FG stores it unspaced. */
const digits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');
const alnum  = (s: string | null | undefined) => (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Is this read missing the first character of every line?
 *
 * ⚠️ Deliberately requires TWO fixed-length fields to be present and short. A read that is missing
 * one of them entirely tells us nothing — absence is not shortness, and inferring a clip from a
 * field that was never read would fire on every half-legible tag in the bay.
 *
 * ⭐⭐ ANY TWO OF THREE, since 2026-10-01 (FWC4510 / unit 5601463, a Montreal Trax). It used to be
 * exactly unit AND last-9. Then the reader met `⌐60 1463` and returned **`6601463`**: it invented
 * the digit the perforation removed, from the sliver left behind. Seven digits is not short, so the
 * gate stayed shut and FG offered to register a car it had held for three weeks. The last-9 came
 * back `TC128877` (8) and the code `TXF` (3) — two fixed-length fields, each exactly one short, which
 * is the same proof this function has always asked for. It was only looking in one pair of places.
 *
 * ⚠️ So a full-length field is NOT evidence against a clip. The reader fills a missing first
 * character with a guess (`6601463` here; `TWC4510` for the plate on 2026-09-08). Only short fields
 * are counted, and a guessed one simply contributes nothing.
 */
export function isClippedRead(read: Pick<KeytagRead, 'unitNumber' | 'vinLast9' | 'classCode'>): boolean {
  const short = [
    digits(read.unitNumber).length === UNIT_LEN - 1,
    alnum(read.vinLast9).length === VIN_LEN - 1,
    alnum(read.classCode).length === CODE_LEN - 1,
  ].filter(Boolean).length;
  return short >= 2;
}

/**
 * Is `short` what `full` looks like with its first character sliced off?
 *
 * ⚠️ EXACTLY ONE CHARACTER, and a strict suffix. Not "endsWith", which would accept two missing
 * characters and quietly widen every match below — the tag loses a COLUMN, so the loss is one
 * character per line by construction, and anything else is a different failure that should not be
 * silently absorbed by this one.
 */
export function isLeadingTruncation(short: string, full: string): boolean {
  const s = alnum(short), f = alnum(full);
  return s.length > 0 && f.length === s.length + 1 && f.slice(1) === s;
}

/** Same three-way contract as `matchByUnitNumber` — identify, or hand it back. Never guess. */
export type ClippedMatch<V> =
  | { kind: 'none' }
  | { kind: 'one'; vehicle: V }
  | { kind: 'ambiguous'; vehicles: V[] };

/**
 * Find the car a clipped value belongs to, by restoring the missing leading character.
 *
 * ⭐ MEASURED BEFORE IT WAS WRITTEN (2026-09-13, 778 live cars): 762 seven-digit units produce
 * **762 distinct six-digit suffixes — zero collisions**, and no live plate's own suffix is itself
 * another live plate. So this is not a heuristic that usually works; on today's fleet it is exact.
 *
 * ⚠️ AND THE AMBIGUOUS BRANCH IS STILL LIVE, because "today's fleet" is not a guarantee: `LUR271`
 * and `KUR271` both end in `UR271`. A rule that is currently unique is not the same as a rule that
 * is unique by construction, and the difference is a wrong car attached to a scan. Hand it back.
 */
export function matchByLeadingTruncation<V>(
  short: string | null | undefined,
  vehicles: readonly V[],
  valueOf: (v: V) => string | null | undefined,
): ClippedMatch<V> {
  const s = alnum(short);
  if (!s) return { kind: 'none' };
  const hits = vehicles.filter(v => isLeadingTruncation(s, alnum(valueOf(v))));
  if (hits.length === 0) return { kind: 'none' };
  if (hits.length === 1) return { kind: 'one', vehicle: hits[0] };
  return { kind: 'ambiguous', vehicles: hits };
}

/**
 * Does `read` name `full` once the first character is discounted?
 *
 * One short → the character is missing, restore it (`isLeadingTruncation`). Same length → the reader
 * supplied a first character the tag does not show, so everything AFTER it must match and the first
 * is ignored. ⚠️ Only ever called on a read `isClippedRead` has already proved is clipped: on a whole
 * tag, ignoring the first character would be exactly the speculative suffix match this file refuses.
 */
export function isClippedForm(read: string | null | undefined, full: string | null | undefined): boolean {
  const r = alnum(read), f = alnum(full);
  if (r.length < 2 || !f) return false;
  if (f.length === r.length + 1) return f.slice(1) === r;
  return f.length === r.length && f.slice(1) === r.slice(1);
}

/** The three identity keys a tag prints, as read. `plates` is every form of the plate worth trying. */
export interface ClippedKeys {
  unit?: string | null;
  vin?: string | null;
  plates?: readonly (string | null | undefined)[];
}

/**
 * Find the car a proven-clipped read belongs to, consulting ALL THREE keys.
 *
 * ⭐ The keys are independent — a fleet-assignment number, a VIN tail and a plate — so they are
 * allowed to rescue each other and are NOT allowed to disagree:
 *   • every key that singles out a car names the SAME car → that car;
 *   • two keys single out DIFFERENT cars → both are handed back. Never the "stronger" one: a clipped
 *     read is already the weakest evidence FG acts on, and a conflict inside it is a reason to ask;
 *   • no key singles one out, but one is ambiguous (`LUR271`/`KUR271` both end `UR271`) → its
 *     candidates are handed back.
 *
 * Measured 2026-10-01 on 812 live cars: 812 distinct six-digit unit tails, 780 carry a last-9.
 */
export function matchClippedRead<V>(
  read: ClippedKeys,
  vehicles: readonly V[],
  keysOf: (v: V) => { unit?: string | null; vin?: string | null; plate?: string | null },
): ClippedMatch<V> {
  const plates = (read.plates ?? []).filter(p => alnum(p).length > 0);
  const hitsPerKey: V[][] = [
    vehicles.filter(v => isClippedForm(read.unit, keysOf(v).unit)),
    vehicles.filter(v => isClippedForm(read.vin, keysOf(v).vin)),
    vehicles.filter(v => plates.some(p => isClippedForm(p, keysOf(v).plate))),
  ];
  const singled = [...new Set(hitsPerKey.filter(h => h.length === 1).map(h => h[0]))];
  if (singled.length === 1) return { kind: 'one', vehicle: singled[0] };
  if (singled.length > 1) return { kind: 'ambiguous', vehicles: singled };
  const several = hitsPerKey.find(h => h.length > 1);
  return several ? { kind: 'ambiguous', vehicles: several } : { kind: 'none' };
}
