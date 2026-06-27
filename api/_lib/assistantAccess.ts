// Who's allowed to use the "Hey FG" assistant. It runs on Aaron's personal
// Anthropic key, so by default it's gated to his account — configured by the
// VITE_FG_ASSISTANT_ALLOWED_EMPLOYEE_IDS env var (comma-separated employee IDs),
// read by BOTH the server (process.env, the real cost boundary) and the client
// (import.meta.env, to hide the FAB). Pure + tested so the gate logic is one place.
//
// Open-when-unset: an empty/missing allowlist means "any authed account" (today's
// behaviour) — the gate only engages once the var names specific IDs. Set it to a
// single employee ID to lock the assistant to that one account.

/** Parse the comma-separated allowlist into normalized (trimmed, lower-cased) IDs. */
export function parseAllowlist(csv: string | undefined): string[] {
  return (csv ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** True if this employee ID may use the assistant. Empty allowlist = open to all. */
export function isAllowed(employeeId: string | null | undefined, csv: string | undefined): boolean {
  const allow = parseAllowlist(csv);
  if (allow.length === 0) return true; // unset → open to all authed
  return allow.includes((employeeId ?? '').trim().toLowerCase());
}
