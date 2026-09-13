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

/** Digits only; the tag prints the unit spaced and FG stores it unspaced. */
const digits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');
const alnum  = (s: string | null | undefined) => (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Is this read missing the first character of every line?
 *
 * ⚠️ Deliberately requires BOTH fixed-length fields to be present and short. A read that is missing
 * one of them entirely tells us nothing — absence is not shortness, and inferring a clip from a
 * field that was never read would fire on every half-legible tag in the bay.
 */
export function isClippedRead(read: Pick<KeytagRead, 'unitNumber' | 'vinLast9'>): boolean {
  const unit = digits(read.unitNumber);
  const vin = alnum(read.vinLast9);
  return unit.length === UNIT_LEN - 1 && vin.length === VIN_LEN - 1;
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
