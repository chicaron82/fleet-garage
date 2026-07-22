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
