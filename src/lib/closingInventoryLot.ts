// The Erin St LOT, as the closing write-up needs to know it — which class belongs in which band of
// rows, how many cars a row holds, and how he writes a row on the sheet.
//
// ⭐ Split out of `closingInventory` on 2026-09-03 purely for the 330-line cap. It is re-exported
// from there, so callers still see ONE model interface and nothing had to learn a new import.
//
// ⚠️ Everything here is READ OFF A HAND-DRAWN MAP and corrected by Aaron in conversation. The map's
// full vocabulary — numbered overflow stalls, the 6+ strip, the BR/FF fence zones, and the south
// fence where the dirties live — is in the memory `reference_erin_st_lot_rows`.

// ── the rows ──────────────────────────────────────────────────────────────────────────────────
//
// Erin St, from Aaron 2026-09-02 and the hand-drawn lot map. Rows 1–5 stage FOR THE AIRPORT and are
// banded by class; row 6 is Erin St's own reservations; 7–12 are overflow and where some held cars
// sit. See the memory `reference_erin_st_lot_rows` for the map's full vocabulary (numbered stalls,
// the 6+ strip, the BR/FF fence zones, and the south fence being where dirties live).

/** Row → how many cars it holds. Used for the live tally, never to refuse a row. */
export const ROW_CAPACITY: Readonly<Record<string, number>> = {
  '1': 8, '2': 8, '3': 8, '4': 8, '5': 8, '6': 8,
  '7': 4, '8': 4, '9': 4, '10': 4, '11': 4, '12': 4,
};

/**
 * ⚠️⚠️ EXACT MATCH ON THE WHOLE CLASS STRING. NEVER A PREFIX.
 *
 * ⭐ Aaron, reading his own lot map back to me: *"B5 is a crossover. someone lumped it in with B
 * because it shares a letter."* A person already made this mistake in pencil, years ago, and it has
 * been wrong on the wall ever since. A `startsWith` would reproduce it in TypeScript.
 *
 * ⭐ And the counter-case proves the rule rather than weakening it: `L` and `L2` ARE both large SUVs
 * (L2 is the 6–7 seater) — so a prefix match would have got `L2` right BY LUCK and `B5` wrong by the
 * same rule. Both are listed by their whole name because both were ASKED about.
 */
/**
 * ⭐⭐ HIS SIMPLE VERSION, which is the real rule — *"simple version of the rows, without having to
 * remember classes: 1 large vehicles/premiums · 2 and 3 SUV style · 4 and 5 sedans and small
 * vehicles · 6 erin st reservations."* The bands are about the CAR, not the code; the class lists
 * below are just how FG recognises which band a car is in.
 *
 * ⭐ A BAND IS SEVERAL ROWS, and which one a car sits in is a FILL question, not a class question —
 * R2 and R3 hold the same thing, so the second only starts when the first is full. That is why this
 * returns an ordered band rather than one row.
 */
const BANDS: readonly { rows: readonly string[]; classes: readonly string[]; label: string }[] = [
  // Minivans (R), F-150s (S), the T family, and O6 — *"naturally an O6 midsize truck is parked
  // where the other trucks are parked. row 1"*. "T's on the map are on 1, covers T, T4, T6."
  { rows: ['1'], classes: ['R', 'S', 'T', 'T4', 'T6', 'O6'], label: 'large / premium' },
  { rows: ['2', '3'], classes: ['B4', 'B5', 'Q4', 'L', 'L2'], label: 'SUV style' },
  // ⭐ "B, C, F, sedans. compact, mid-size, full size." And "small vehicles" is what resolves B —
  // it holds a Kona, a Versa and a Corolla Hatchback, three body types that are all SMALL. The
  // ambiguity I flagged in that class was mine, not the lot's.
  { rows: ['4', '5'], classes: ['B', 'C', 'F'], label: 'sedans / small' },
];

/**
 * Which row a class usually sits in — a SUGGESTION, never a decision.
 *
 * ⭐ It works at all because he parks by class in the first place (closing checklist step 2: *"put
 * clean cars on their designated row/ring, load from the back"*), so the suggestion is usually
 * already right about a car he has already parked.
 *
 * ⚠️⚠️ AN UNBANDED CLASS RETURNS NULL, AND THAT IS CORRECT RATHER THAN TIMID — because a rental
 * class is not necessarily a body type at all:
 *   • `E6` is the HYBRID class (FG already knows: `HYBRID_RENTAL_CLASSES`). Its 43 cars are Civic,
 *     Camry, Corolla, Prius — AND Sportage and RAV4. A hybrid Camry is a sedan and a hybrid RAV4 is
 *     an SUV, so E6 has no single row and never will.
 *   • The Volvos (`W4` `Z4` `H4`), the Teslas (`E7` `E8` `B9` `E9`), `E1` and `V` are simply not
 *     banded yet — "premiums" is in row 1's description and a subcompact XC40 is not obviously a
 *     row-1 car, so this waits for an answer instead of inventing one.
 * Measured across the live fleet 2026-09-02; see the memory `reference_erin_st_lot_rows`.
 */
export function suggestBand(rentalClass: string | null | undefined): readonly string[] | null {
  const c = (rentalClass ?? '').trim().toUpperCase();
  if (!c) return null;
  return BANDS.find(b => b.classes.includes(c))?.rows ?? null;
}

/**
 * The row to actually suggest: the first in the band with space left.
 *
 * ⚠️ Fill is counted from THIS SESSION only, so it is a hint about what he has already written down
 * tonight — not a claim about the lot. A row can be full of cars he has not scanned yet, and the
 * suggestion being wrong costs one tap.
 */
export function suggestRow(
  rentalClass: string | null | undefined,
  filled: Readonly<Record<string, number>> = {},
): string | null {
  const band = suggestBand(rentalClass);
  if (!band) return null;
  for (const r of band) {
    const cap = ROW_CAPACITY[r];
    if (cap === undefined || (filled[r] ?? 0) < cap) return r;
  }
  return band[band.length - 1];   // every row in the band is full — still name the band's last
}

/** "R-5" for a numbered row; a fence zone or stall ("SF", "BR-2A", "8-3") passes through as-is. */
export function rowLabel(row: string | null | undefined): string {
  const r = (row ?? '').trim();
  if (!r) return '';
  return /^\d+$/.test(r) ? `R-${r}` : r.toUpperCase();
}
