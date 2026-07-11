// Account classification for the schedule + roster views. Two groups coexist in FG: the actual
// crew (real production employees) and the mock UV7 personas kept as a test harness. This is how
// the schedule hides the mock personas from the real roster while keeping them usable for testing.
// (The old demo/live toggle these once gated was removed with the demo-side —
// docs/ticket-remove-demo-side.md.)
//
// Three stable real accounts, so a hardcoded allowlist is intentional — promote to an
// `is_mock` profiles column only if this set starts to churn.
const REAL_EMPLOYEE_IDS = new Set<string>([
  '331965', // Aaron
  '300210', // Ray T
  '256163', // Geoff N
]);

/** True if this employee id belongs to a real production account (the actual crew). */
export function isRealAccount(employeeId: string | undefined | null): boolean {
  return !!employeeId && REAL_EMPLOYEE_IDS.has(employeeId);
}

/**
 * A mock persona — a UV7 crew account kept for testing, not a real production employee NOR
 * board-only roster staff. This is the set the schedule hides by default, while keeping the real
 * crew and the roster ghosts who genuinely work the floor.
 */
export function isMockPersona(p: { employeeId?: string | null; rosterOnly?: boolean | null }): boolean {
  return !isRealAccount(p.employeeId) && !p.rosterOnly;
}
