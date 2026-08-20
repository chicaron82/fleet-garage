// Keys on the ring, compared against what the car is supposed to have.
//
// The point isn't recording a number — it's the COMPARISON. If FG only stored "3 keys", Aaron is
// still the one who has to remember this Carnival went out with 4. Storing the expected count and
// diffing it at the check-in is what turns recall into knowing, and it has to happen AT the flip:
// that capture closes the contract, so a missing key is chargeable then and simply gone later.

export interface KeyCheck {
  /** What the car is supposed to carry. Null when FG has never been told. */
  expected: number | null;
  observed: number;
  /** How many are missing. 0 when it's whole, or when there's no baseline to compare against. */
  short: number;
  /** True the first time a car is counted — nothing to compare, so this observation IS the baseline. */
  seedsBaseline: boolean;
}

export function checkKeys(expected: number | null, observed: number): KeyCheck {
  const hasBaseline = typeof expected === 'number' && expected > 0;
  return {
    expected: hasBaseline ? expected : null,
    observed,
    short: hasBaseline ? Math.max(0, expected - observed) : 0,
    seedsBaseline: !hasBaseline,
  };
}

/**
 * The counter-facing fragment for a short return — rides the flip's copy-out so the loss is
 * actionable while the rental is still open. Empty string when nothing's missing, so callers can
 * append it unconditionally.
 */
export function keyShortNote(check: KeyCheck): string {
  if (check.short <= 0) return '';
  const unit = check.short === 1 ? 'key' : 'keys';
  return `⚠️ ${check.short} ${unit} short (${check.observed}/${check.expected})`;
}

// ── Teslas: one keycard, ever ─────────────────────────────────────────────────────────────────
//
// Aaron, 2026-08-19: *"only 1 ever 1 keycard. if it's lost its grounded and cannot be driven"*
//
// Two facts, and the second is the one that matters. The count is never in question — a Tesla
// carries exactly one card, so offering 2/3/4 on a Tesla is FG asking a question with no true
// answer, on a picker he taps with nitrile gloves on.
//
// ⭐ And a missing card is not a shortfall, it is an IMMOBILISATION. On any other car a missing key
// is a gap to chase: the car still drives, still rents, still gets cleaned, and the loss is
// chargeable at the counter. A Tesla without its card **cannot be driven at all** — same missing
// datum, categorically different consequence. The copy has to say so, because "1 key short" reads
// like paperwork and this is a car that has left the fleet.

export const TESLA_KEYCARD_COUNT = 1;

/** What the picker may legitimately offer. A choice that cannot be true is not a choice. */
export function keyOptionsFor(isTesla: boolean): readonly number[] {
  return isTesla ? [TESLA_KEYCARD_COUNT] : [1, 2, 3, 4];
}

/** What the thing is called. A Tesla has a keycard; everything else has keys on a ring. */
export function keyNoun(isTesla: boolean, count: number): string {
  if (isTesla) return 'keycard';
  return count === 1 ? 'key on the ring' : 'keys on the ring';
}

/**
 * How bad is this shortfall?
 *
 * `grounded` exists so no caller can render a missing Tesla card in the same tone as a missing
 * second key. The severity is a property of the CAR, not of the number.
 */
export type KeyShortSeverity = 'none' | 'short' | 'grounded';

export function keyShortSeverity(check: KeyCheck, isTesla: boolean): KeyShortSeverity {
  if (check.short <= 0) return 'none';
  return isTesla ? 'grounded' : 'short';
}

/**
 * The counter-facing fragment, aware of what kind of car it is describing.
 *
 * Kept separate from `keyShortNote` rather than replacing it: that one has callers who pass no
 * vehicle context, and silently treating them all as non-Teslas would be a quieter version of the
 * same bug.
 */
export function keyShortNoteFor(check: KeyCheck, isTesla: boolean): string {
  if (keyShortSeverity(check, isTesla) === 'grounded') {
    return `🛑 Keycard missing — this Tesla is GROUNDED and cannot be driven (${check.observed}/${check.expected})`;
  }
  return keyShortNote(check);
}

