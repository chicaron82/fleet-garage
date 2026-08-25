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
  return VIN_ALPHABET.test(corrected) ? corrected : '';
}
