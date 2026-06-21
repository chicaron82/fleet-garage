// Real production employees. These accounts only ever see live data — the
// demo/live toggle (Movement, Analytics, Audit, Notifications) is hidden for
// them so the app reads as a finished tool, not a showcase. Every other
// account (the demo personas) keeps the toggle for demos and screenshots.
//
// Three stable accounts, so a hardcoded allowlist is intentional — promote to
// an `is_demo` profiles column only if this set starts to churn.
const REAL_EMPLOYEE_IDS = new Set<string>([
  '331965', // Aaron
  '300210', // Ray T
  '256163', // Geoff N
]);

/** True if this employee id belongs to a real production account. */
export function isRealAccount(employeeId: string | undefined | null): boolean {
  return !!employeeId && REAL_EMPLOYEE_IDS.has(employeeId);
}

/**
 * A demo/mock persona — present in the app for demos and screenshots, but not a
 * real production employee NOR board-only roster staff. This is the set the
 * schedule hides by default (the UV7 crew accounts), while keeping real crew and
 * the roster ghosts who genuinely work the floor.
 */
export function isMockPersona(p: { employeeId?: string | null; rosterOnly?: boolean | null }): boolean {
  return !isRealAccount(p.employeeId) && !p.rosterOnly;
}
