// The last 9 of the VIN, as printed on a key tag ("Last9vin: 9TR289777").
//
// Lives in api/_lib so BOTH sides can import it: the Vercel function that reads the tag and the
// client write that stores it (client → api/_lib is allowed; the reverse isn't). One definition, so
// the reader and the writer can never disagree about what counts as a usable VIN — the same reason
// LETTER_TO_DIGIT is "the one copy" in platePrefix.ts.
//
// ⚠️ NINE characters, not seventeen. No WMI, no plant code, no model-year digit — all of those live
// in the first eight, which the tag does not print. Nothing may decode a manufacturer from this.

/** Characters a VIN can legally contain. I, O and Q are excluded by the VIN standard itself. */
const VIN_ALPHABET = /^[A-HJ-NPR-Z0-9]{9}$/;

/**
 * ⭐ THE LAST 9 IS NOT AN OPAQUE STRING — it has structure, and the structure is checkable.
 *
 * A VIN's 17 characters are positionally meaningful, and the last nine are positions 9–17:
 *
 *   position  9  → CHECK DIGIT      → the 1st character here. Legal values: 0–9 or X. Nothing else.
 *   position 10  → MODEL YEAR       → the 2nd character here (see `vinYear`).
 *   position 11  → assembly plant
 *   positions 12–17 → serial
 *
 * I shipped this file on 2026-08-25 asserting "a VIN has no oracle" and built the backfill's whole
 * safety argument around that — two models must agree, because nothing could check them. **That was
 * wrong, and it was wrong in the direction that costs data:** two free, independent checks were
 * sitting inside the string the entire time. Aaron asked me to double-check the run, and the audit
 * they enabled caught `VXSL47717` — an illegal check digit AND a model year of 2029 — on which
 * BOTH models had agreed. The "unlikely but not impossible" case, once in 374.
 *
 * **Lesson worth keeping: "unverifiable" is a claim about my imagination, not about the data.**
 */
const CHECK_DIGIT = /^[0-9X]$/;

/** VIN position 10 → model year. Skips I, O, Q, U and Z; the letters cycle every 30 years. */
const YEAR_CODE: Record<number, string> = {
  2010: 'A', 2011: 'B', 2012: 'C', 2013: 'D', 2014: 'E', 2015: 'F', 2016: 'G', 2017: 'H',
  2018: 'J', 2019: 'K', 2020: 'L', 2021: 'M', 2022: 'N', 2023: 'P', 2024: 'R', 2025: 'S',
  2026: 'T', 2027: 'V', 2028: 'W', 2029: 'X', 2030: 'Y',
};

/** The model year a stored last-9 claims, or null when its year character isn't a known code. */
export function vinYear(vinLast9: string): number | null {
  const code = vinLast9?.[1];
  const hit = Object.entries(YEAR_CODE).find(([, c]) => c === code);
  return hit ? Number(hit[0]) : null;
}

/**
 * Does this VIN's own model-year character agree with the year FG has on record?
 *
 * ⚠️ ADVISORY, never a rejection — unlike the check digit, which is absolute. A mismatch means one
 * of the two is wrong and this cannot tell which: FG's year is itself operator- or codex-supplied
 * and can be off by a model year. Refusing the write would let a bad `year` permanently block a
 * good VIN. So it surfaces, and a human decides. (`LFJ285`, a Rogue on record as 2024 whose VIN
 * says 2025, is the live example.)
 */
export function vinYearDisagrees(vinLast9: string, recordYear: number | null | undefined): boolean {
  if (!vinLast9 || !recordYear) return false;
  const expected = YEAR_CODE[recordYear];
  return !!expected && vinLast9[1] !== expected;
}

/**
 * Clean a raw read into a storable last-9, or `''` when it isn't one.
 *
 * ⭐ The I/O/Q substitution is a CORRECTION, not a guess, and that distinction is the whole reason
 * it's safe: the VIN standard excludes those three letters precisely because they're confusable
 * with 1, 0 and 0. So a vision read containing one is, by construction, a misread of a digit —
 * there is no VIN it could legitimately belong to. Contrast `correctManitobaPlate`, which needs a
 * known-prefix gate before it dares touch a character, because plates have no such guarantee.
 *
 * Anything that isn't then exactly 9 alphanumerics is REJECTED rather than salvaged. A partial VIN
 * is worse than no VIN: it wears the shape of an identity key while being unable to identify
 * anything, and it would quietly poison a match the moment someone trusted it.
 */
export function normalizeVinLast9(raw: string | null | undefined): string {
  const stripped = (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const corrected = stripped.replace(/I/g, '1').replace(/[OQ]/g, '0');
  if (!VIN_ALPHABET.test(corrected)) return '';
  // The check digit is ABSOLUTE — position 9 of a VIN is 0–9 or X, with no exceptions and no
  // manufacturer variation. A read that fails it is not a VIN, whatever else it looks like, so it
  // is rejected here rather than stored and audited later. This alone would have stopped
  // `VXSL47717` at the door instead of letting it reach a real car's record.
  if (!CHECK_DIGIT.test(corrected[0])) return '';
  return corrected;
}
