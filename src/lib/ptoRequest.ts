function formatPtoDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-CA', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function plural(n: number): string {
  return n !== 1 ? 's' : '';
}

/**
 * A boss-ready PTO approval request: the days being requested, any upcoming days
 * already approved (shown for the full picture so the balance reconciles), and
 * the running balance. `used` already includes every entered PTO day, so
 * `remaining` is the post-request figure. Shareable as plain text (Web Share /
 * clipboard / email).
 */
export function buildPtoRequest(
  userName: string,
  ptoDates: string[],
  entitlement: number,
  used: number,
  approvedDates: string[] = [],
): string {
  const lines = [`PTO Request — ${userName}`, ''];
  if (ptoDates.length === 0 && approvedDates.length === 0) {
    lines.push('No upcoming PTO days entered.');
    return lines.join('\n');
  }
  const remaining = Math.max(0, entitlement - used);

  if (ptoDates.length > 0) {
    lines.push('Requesting the following day(s) off:');
    for (const d of ptoDates) lines.push(` • ${formatPtoDate(d)}`);
    lines.push('');
    lines.push(`${ptoDates.length} day${plural(ptoDates.length)} requested.`);
  }

  if (approvedDates.length > 0) {
    if (ptoDates.length > 0) lines.push('');
    lines.push('Already approved this year:');
    for (const d of approvedDates) lines.push(` • ${formatPtoDate(d)}`);
    lines.push('');
    lines.push(`${approvedDates.length} day${plural(approvedDates.length)} already approved.`);
  }

  lines.push(`Balance: ${used} of ${entitlement} used · ${remaining} remaining.`);
  if (ptoDates.length > 0) {
    lines.push('');
    lines.push('Please confirm approval — thanks!');
  }
  return lines.join('\n');
}
