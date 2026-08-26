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
  const tag = (tagClass ?? '').trim().toUpperCase() || undefined;
  const stored = (known?.rental_class ?? '').trim().toUpperCase() || undefined;

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
