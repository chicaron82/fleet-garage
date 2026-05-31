function formatPtoDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-CA', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

/**
 * A boss-ready PTO approval request: the requested days plus the running balance.
 * `used` already includes the entered PTO days, so `remaining` is the post-request
 * figure. Shareable as plain text (Web Share / clipboard / email).
 */
export function buildPtoRequest(userName: string, ptoDates: string[], entitlement: number, used: number): string {
  const lines = [`PTO Request — ${userName}`, ''];
  if (ptoDates.length === 0) {
    lines.push('No upcoming PTO days entered.');
    return lines.join('\n');
  }
  const remaining = Math.max(0, entitlement - used);
  lines.push('Requesting the following day(s) off:');
  for (const d of ptoDates) lines.push(` • ${formatPtoDate(d)}`);
  lines.push('');
  lines.push(`${ptoDates.length} day${ptoDates.length !== 1 ? 's' : ''} requested.`);
  lines.push(`Balance: ${used} of ${entitlement} used · ${remaining} remaining.`);
  lines.push('');
  lines.push('Please confirm approval — thanks!');
  return lines.join('\n');
}
