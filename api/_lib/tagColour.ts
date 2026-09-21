// A key tag prints the colour as its FIRST THREE LETTERS — `GRA`, `BLA`, `GRE`. This turns that
// back into the word, deterministically.
//
// ⚠️⚠️ WHY THIS EXISTS AS CODE AND NOT AS A PROMPT LINE. `keytagReader`'s schema already asks the
// model for *"Colour name mapped from the code (WHI→White…)"* — and on 2026-09-20 a line-check found
// **31 live cars holding the raw code anyway** (GRA ×13, BLA ×9, GRE ×4, BRO ×2, PLU ×1, plus two
// spelled `Grey`). Every one rendered raw on the Holds list: *"2026 Kia Seltos · BLA"*, sitting
// between cars that said Black and Silver. **An instruction the model usually follows is not a
// guarantee, and nothing downstream was checking.**
//
// ⭐ Derived from the RULE, not from a hand-typed code table: a code is the first three letters of a
// colour name, so the mapping is generated from the names. Inventing `ORA → Orange` in a table would
// be guessing; deriving it from "Orange" is the rule doing the work.

/**
 * The colour words FG uses. Order is irrelevant; spelling is not.
 *
 * ⚠️⚠️ `Grey` IS DELIBERATELY ABSENT, and it is the one entry that could break this file. Aaron,
 * 2026-09-20: *"keep the consistency. in FG GRA is GRAY, outside of FG i just personally spell it
 * Grey."* Adding `Grey` would make `GRE` ambiguous with `Green` — the derivation would have two
 * answers for one code. **His spelling preference lives outside FG precisely so this stays
 * decidable.** See `tagColour.test.ts`, which fails if any two names share a three-letter prefix.
 */
export const FG_COLOUR_NAMES: readonly string[] = [
  'White', 'Black', 'Gray', 'Silver', 'Blue', 'Red', 'Green', 'Brown',
  'Plum', 'Orange', 'Gold', 'Beige', 'Yellow', 'Maroon', 'Tan', 'Purple', 'Pink', 'Charcoal',
];

/** `GRA` → `Gray`, built from the names so no code is ever typed by hand. */
export const TAG_COLOUR_CODES: Readonly<Record<string, string>> = Object.fromEntries(
  FG_COLOUR_NAMES.map((name) => [name.slice(0, 3).toUpperCase(), name]),
);

/**
 * The colour as a WORD.
 *
 * ⚠️ Passes anything it does not recognise straight through, unchanged. A tag colour FG has never
 * seen must survive the read — silently blanking it would lose a fact the operator can still use,
 * and a code nobody expanded is at least visible as a code. Only a known three-letter code is
 * rewritten; a value that is already a word is returned as-is.
 */
export function normalizeTagColour(raw: string | null | undefined): string | undefined {
  const v = (raw ?? '').trim();
  if (!v) return undefined;
  return TAG_COLOUR_CODES[v.toUpperCase()] ?? v;
}
