// A key tag prints the colour as a THREE-LETTER CODE. This turns the ones we can actually vouch for
// back into a word, and leaves every other one alone.
//
// ⚠️⚠️ WHY THIS EXISTS AS CODE AND NOT AS A PROMPT LINE. `keytagReader`'s schema already asks the
// model for *"Colour name mapped from the code (WHI→White…)"* — and on 2026-09-20 a line-check found
// **31 live cars holding the raw code anyway** (GRA ×13, BLA ×9, GRE ×4, BRO ×2, PLU ×1, plus two
// spelled `Grey`), rendering as *"2026 Kia Seltos · BLA"* on the Holds list. An instruction a model
// usually follows is not a guarantee, and nothing downstream was checking.
//
// ⚠️⚠️⚠️ AND THE FIRST VERSION OF THIS FILE WAS WRONG WITHIN THE HOUR — read this before adding a code.
// It DERIVED the table from a list of colour words ("a code is the first three letters of a colour"),
// which felt principled and was a guess wearing a rule's clothes. Aaron killed it with one screenshot
// of Kia's own configurator: `exteriorColourCode=PLU` → **Pluton Blue**. The code is the first three
// letters of whatever the MANUFACTURER MARKETS THE COLOUR AS, not of a generic colour word. So
// `PLU` is Blue on a Seltos, and my derivation had written **Plum** onto a blue car (LFJ306).
//
// ⭐ The generated table also carried `TAN`, `MAR`, `ORA`, `BEI`, `GOL`, `PIN`, `PUR`, `YEL`, `CHA`
// — none of which FG has ever seen on a tag. Every one is a landmine of the same shape: `TAN` would
// swallow *Tangerine*, `MAR` would swallow *Marine Blue*. **They are all gone.** A code earns a place
// here by being SEEN, and by someone confirming what the car actually looks like.
//
// ⚠️ AND THEN THE OVER-CORRECTION, which is its own lesson. Told PLU was wrong, DiZee also pulled
// `GRE` and `BRO` out on the theory that they *might* be Grey and Bronze. Aaron: *"everything else
// remains the same. PLU was the only thing i couldn't get right and that's why its the only one i
// brought up."* **One counterexample discredits the inference that produced it, not every neighbour
// of that inference.** He had already checked the rest by looking at the cars — which is exactly the
// evidence the table is supposed to rest on.

/**
 * Codes FG will rewrite. Deliberately short, and **every entry is evidenced** — by being seen on a
 * real tag and confirmed against the car, never by inference from the letters.
 *
 * ⚠️ `Grey` is not a target spelling anywhere in FG. Aaron, 2026-09-20: *"keep the consistency. in FG
 * GRA is GRAY, outside of FG i just personally spell it Grey."*
 */
export const TAG_COLOUR_CODES: Readonly<Record<string, string>> = {
  WHI: 'White',
  BLA: 'Black',
  GRA: 'Gray',
  SIL: 'Silver',
  BLU: 'Blue',
  RED: 'Red',
  // ⭐ Confirmed by Aaron 2026-09-20 against the actual cars, after DiZee over-corrected and pulled
  // them out: *"everything else remains the same. PLU was the only thing i couldn't get right."*
  // GREEN not Grey (LZM520, MCN112, LFJ289, LZM573) and BROWN not Bronze (LUR367, LUR370) — both
  // were live worries, both answered by the man who has stood in front of the cars.
  GRE: 'Green',
  BRO: 'Brown',
  // ⭐ Kia's own build-and-price URL, from Aaron 2026-09-20: `exteriorColourCode=PLU` = "Pluton Blue".
  // FG's colour vocabulary is what you'd say looking at the car, so it lands on Blue — not on the
  // marketing name, and emphatically not on Plum. ⚠️ Manufacturer-scoped: PLU is evidence about KIA.
  PLU: 'Blue',
};

/**
 * The colour as a WORD, when we can vouch for the code.
 *
 * ⚠️ Anything unrecognised passes straight through, unchanged — including a three-letter code this
 * table does not know. **A code nobody expanded is visible as a code and gets asked about; a wrong
 * colour looks exactly like a right one.** That asymmetry is the whole design of this function.
 */
export function normalizeTagColour(raw: string | null | undefined): string | undefined {
  const v = (raw ?? '').trim();
  if (!v) return undefined;
  return TAG_COLOUR_CODES[v.toUpperCase()] ?? v;
}
