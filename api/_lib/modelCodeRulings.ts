import { normalizeClassCode } from './vehicleClassCodex.js';

// What Aaron has RULED about a model code — written where the code is used, in his words.
//
// ⭐⭐ WHY THIS FILE EXISTS. Aaron, 2026-10-01, reading the Model codes audit an hour after it shipped:
// *"CBRS, we keep discussing this, but past you doesn't write it down."* It was written down — at
// length, in a memory file, on 2026-09-20. It was not written HERE. So the built-in list carried a bare
// "1 car" comment, and the audit told him *"You taught Chevrolet Blazer, but FG's built-in list says
// Trailblazer and wins"*: his own correct reading of the code, presented back to him as the mistake.
//
// A ruling does two jobs. The card SHOWS it, so the screen carries the answer instead of the question.
// And the audit stops raising the taught-versus-built-in conflict for that code, because that conflict
// is the thing he ruled on.
//
// ⚠️ A ruling is his sentence, not an inference. Add one only when he has said it, and keep it short
// enough to read on a phone. It never changes what FG fills in — the built-in list does that.

const RULINGS: Record<string, string> = {
  // 2026-09-20: "who ever did this tag reached for the wrong code. went for blazer instead of
  // trailblazer". 2026-10-01: "C, BRS - Canadian Blazer RS. just going with whatever the majority is
  // because its a mess."
  CBRS: 'Reads as Blazer RS, but it was keyed onto a Trailblazer. FG follows the cars that carry it.',
  // 2026-10-01: "CCMR a misread for CCMH". The tag on the one car carrying it prints `CCMH 25`.
  CCMR: 'A misread of CCMH, the Camry SE Hybrid.',
};

/**
 * Codes he has ruled are a MISREAD of another code, and which one.
 *
 * ⚠️ Not a correction table: nothing rewrites `CCMR` into `CCMH` on its own. The audit uses it to keep
 * the code in front of him until no car carries it and nothing is learned for it; fixing the car and
 * forgetting the lesson stay his decisions.
 */
const MISREAD_OF: Record<string, string> = {
  CCMR: 'CCMH',
};

/** The code this one is a ruled misread of, or null. */
export function misreadOf(code: string | undefined | null): string | null {
  return MISREAD_OF[normalizeClassCode(code)] ?? null;
}

/** His ruling on a code, or null when he has not made one. */
export function modelCodeRuling(code: string | undefined | null): string | null {
  return RULINGS[normalizeClassCode(code)] ?? null;
}
