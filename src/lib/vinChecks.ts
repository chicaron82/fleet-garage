// The VIN tells you its own year — two independent checks on a stored `vin_last9`.
//
// ⭐ AARON DERIVED THE RULE HIMSELF, from tags he had read: *"i remember past you reading some.. and
// 'T' was 2026 so pieced together that 'S' was 2025. noticed some 2025 had '5' so may need to
// recheck those"* (2026-08-29). He was right, and he corrected two cars by hand before I had
// finished verifying it:
//
//   HMT717  2025 Seltos   357792108 → 3S7792108   (5 → S)
//   LFJ354  2025 Seltos   287762260 → 2S7762260   (8 → S)
//
// Verified against 560 stored VINs: 98% agreement. The confusion map his corrections revealed is
// S → 5 or 8, and T → 1, 2, 7, 9 or U.
//
// ⚠️ REPORT, NEVER AUTO-CORRECT. The year code is derivable from the stored `year`, which is
// tempting — but LJF698 was filed as a 2025 with a `T` in its VIN and Aaron's answer was *"LJF698 is
// a 2026. a misread"*: the YEAR was the wrong field, not the VIN. When two fields disagree, surface
// it and let the person holding the tag decide. [[feedback_read_the_source_artifact]]

/** VIN position 10. I, O, Q are barred from a VIN entirely; U and Z are barred from THIS position;
 *  a digit here means 2031-2039, so on a current fleet a digit is always a misread. */
const YEAR_CODES: Readonly<Record<string, number>> = {
  F: 2015, G: 2016, H: 2017, J: 2018, K: 2019, L: 2020, M: 2021,
  N: 2022, P: 2023, R: 2024, S: 2025, T: 2026, V: 2027, W: 2028, X: 2029, Y: 2030,
};

const CODE_FOR_YEAR: Readonly<Record<number, string>> = Object.fromEntries(
  Object.entries(YEAR_CODES).map(([code, yr]) => [yr, code]),
);

export type VinFinding =
  /** The 9-character window itself is wrong — position 9 is not a legal check digit. */
  | { kind: 'framing'; got: string; detail: string }
  /** One character is wrong: the year code contradicts the year on the record. */
  | { kind: 'year-code'; got: string; expected: string; storedYear: number; codeYear: number | null; detail: string };

/**
 * ⚠️ CHECK ONE — THE CHECK DIGIT, and it finds a completely different bug from check two.
 *
 * VIN position 9 is the check digit and can only ever be 0-9 or X. We store the last nine
 * characters, so it is the FIRST character of `vin_last9`. Anything else means the window was
 * framed wrong — the reader started a position too early or too late — rather than one glyph being
 * misread.
 *
 * The live example, and the only one in 560 VINs: LFJ400, a 2025 Kicks stored as `VXSL47717`. Every
 * other Kicks reads `?SL######` for 2025 and `?TL######` for 2026, without exception across 54 cars.
 * Drop the leading `V` and `XSL47717` matches its siblings exactly. Aaron had verified both the `X`
 * and the `S` on the tag and **both were correct** — the window was not.
 *
 * ⭐ A rule that only knows about wrong CHARACTERS would have called this a wrong character, and the
 * fix it implied (re-read one glyph) would not have worked. This one says re-capture the field.
 */
export function checkVinFraming(vinLast9: string | null | undefined): VinFinding | null {
  const vin = (vinLast9 ?? '').trim().toUpperCase();
  if (vin.length === 0) return null;
  const first = vin[0];
  if (/^[0-9X]$/.test(first)) return null;
  return {
    kind: 'framing',
    got: first,
    detail: `"${first}" can't be a check digit — the read is framed wrong, not misread. Re-capture the whole VIN.`,
  };
}

/**
 * CHECK TWO — the model-year code against the year already on the record.
 *
 * Returns null when they agree, when either side is missing, or when the framing is already known
 * to be wrong (a shifted window makes every position meaningless, and reporting both findings on
 * one car would just be the same defect twice).
 */
export function checkVinYear(
  vinLast9: string | null | undefined,
  storedYear: number | null | undefined,
): VinFinding | null {
  const vin = (vinLast9 ?? '').trim().toUpperCase();
  if (vin.length < 2 || !storedYear) return null;
  if (checkVinFraming(vin)) return null;              // framing wins; don't double-report

  const expected = CODE_FOR_YEAR[storedYear];
  if (!expected) return null;                         // a year outside the table — say nothing
  const got = vin[1];
  if (got === expected) return null;

  const codeYear = YEAR_CODES[got] ?? null;
  return {
    kind: 'year-code',
    got, expected, storedYear, codeYear,
    detail: codeYear === null
      // A digit means 2031-2039 and U/Z/I/O/Q are barred outright, so this cannot be any year.
      ? `"${got}" isn't a model-year code at all — a ${storedYear} reads "${expected}" here.`
      : `"${got}" means ${codeYear}, but the record says ${storedYear} (which reads "${expected}").`,
  };
}

/** Both checks, in the order a person should act on them. At most one fires per car. */
export function vinFindings(
  vinLast9: string | null | undefined,
  storedYear: number | null | undefined,
): VinFinding[] {
  const framing = checkVinFraming(vinLast9);
  if (framing) return [framing];
  const year = checkVinYear(vinLast9, storedYear);
  return year ? [year] : [];
}

/**
 * ⚠️ WHICH FIELD IS WRONG IS NOT KNOWABLE FROM HERE, and the copy has to say so. On LJF698 the VIN
 * was right and the YEAR was the misread; on the eight cars carrying an impossible character the
 * VIN was wrong. Both look identical to this code. So the line names the disagreement and asks for
 * the tag — it never proposes a value.
 */
export function vinFindingHint(f: VinFinding): string {
  return f.kind === 'framing'
    ? 'Re-capture the VIN off the door jamb — one character short or shifted.'
    : 'Check the tag: either the VIN or the year on this record is wrong.';
}
