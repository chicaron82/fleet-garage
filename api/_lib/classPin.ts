// Who wins when the key tag and FG disagree about a car's rental class.
//
// ⭐⭐ THE RULE, AND WHY IT ISN'T "THE TAG ALWAYS WINS". `keytag-read` used to upsert the code→class
// mapping on every scan that read both a code and a class — unconditional, last-write-wins, under
// the comment *"Ground truth only — the tags are the chart."* That is correct for what a tag
// actually knows: the plate, the unit number, the VIN, the class CODE. It is wrong for the rental
// CLASS, which is whatever was assigned when that tag was printed, and goes stale.
//
// Aaron, 2026-08-25: *"what do you think of FG just mapping CRHX to E6 despite what the tag says.
// saves me from constantly changing it."* He was in a loop he could not win — every CRHX scan
// re-taught Q4 and erased his correction, so his fix never survived a single scan. FG had already
// documented the right answer in vehicleClassCodex.ts since 2026-07-22 ("the real class is E6, per
// the Hertz chart he photographed") — **as a comment, while the code went on doing the opposite.**
//
// This lives as a pure function rather than inline in the handler for exactly that reason: a rule
// that only exists in prose is a rule nothing can check.

/**
 * ⚠️⚠️ A MODEL CODE IS NOT A RENTAL CLASS — a rule of SHAPE, not of what the fleet happens to store.
 *
 * Aaron, 2026-10-01, on the audit card for 0EZ443 (a Calgary tag: `08193  C` · `CK4L 25`): *"Do we still
 * have CK4L as a rental class somewhere?"* It did, twice. On 2026-09-29 a scan filed the tag's model
 * code in the class slot; the learner taught `CK4L → CK4L` over the correct `CK4L → C`, and the car
 * stored rental class `CK4L`. ⭐ Then the audit's wrong-box guard, which builds "known rental classes"
 * from what the fleet stores, BELIEVED it: it accused the correct Model code box and waved the wrong
 * Rental class box through. One bad row had taught the check that the bad value was legitimate.
 *
 * A vocabulary learned from the data cannot catch an error that is already in the data. A shape can:
 * every rental class on the fleet is one or two characters (C, T, B5, Q4, E8 — 846 cars, 25 kinds) and
 * every model code is four. So a value of four or more characters, or one equal to the car's own model
 * code, is a code sitting in the wrong slot — whatever any table says.
 * docs/October/ticket-model-code-is-not-a-rental-class.md
 */
export function isCodeShapedClass(
  value: string | null | undefined,
  /** The car's model code, when the caller has it — an exact echo of it is never a class. */
  classCode?: string | null,
): boolean {
  const v = (value ?? '').trim().toUpperCase();
  if (!v) return false;
  const code = (classCode ?? '').trim().toUpperCase();
  return v.length >= 4 || (!!code && v === code);
}

export interface ClassPinDecision {
  /** The class the scan should report, or undefined when nothing can say. */
  rentalClass?: string;
  /** What the TAG said, only when a pin overrode it AND they disagree. */
  rentalClassOnTag?: string;
  /** The class came from a human pin. */
  rentalClassPinned?: boolean;
  /** The class came from a learned mapping because the tag's own field was unreadable. */
  rentalClassInferred?: boolean;
  /** May this scan teach code→class? False whenever a person has pinned it. */
  teach: boolean;
}

/**
 * @param known    the stored mapping for this class code, if any
 * @param tagClass the rental class read off the tag this scan, if legible
 */
export function resolveRentalClass(
  known: { rental_class?: string | null; pinned_at?: string | null } | null | undefined,
  tagClass: string | null | undefined,
): ClassPinDecision {
  // ⚠️ A code-shaped value is treated as NOT READ, on both sides. As the tag's class it would be taught
  // (`CK4L → CK4L`, 2026-09-29); as the stored mapping it is that same poison coming back out as an
  // "inferred" class on the next scan. Neither may be reported, and neither may teach.
  const usable = (v: string | null | undefined) => {
    const s = (v ?? '').trim().toUpperCase();
    return s && !isCodeShapedClass(s) ? s : undefined;
  };
  const tag = usable(tagClass);
  const stored = usable(known?.rental_class);

  // A PIN OUTRANKS THE TAG — the whole point.
  if (known?.pinned_at && stored) {
    return {
      rentalClass: stored,
      rentalClassPinned: true,
      // ⚠️ SURFACE THE DISAGREEMENT, NEVER LEAN. The pin wins, but a tag saying something else is
      // evidence, not noise: silently rewriting it is how a REAL Hertz reclassification would slip
      // past unnoticed. Both values travel so the surface can say "E6 · pinned (tag says Q4)".
      ...(tag && tag !== stored ? { rentalClassOnTag: tag } : {}),
      teach: false,
    };
  }

  // Unpinned and the tag is legible → the tag is the chart, exactly as before.
  if (tag) return { rentalClass: tag, teach: true };

  // Unpinned and the tag's class field is unreadable → fall back to what a prior clean scan taught.
  if (stored) return { rentalClass: stored, rentalClassInferred: true, teach: false };

  // Nothing to say. Note `teach: false` — there is no class to teach WITH, so a caller that
  // blindly trusted `teach` could not write a null over a good row.
  return { teach: false };
}
