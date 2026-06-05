function formatPtoDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-CA', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function plural(n: number): string {
  return n !== 1 ? 's' : '';
}

/** Stat-day annotation per requested date: the stat name + an optional backup date.
 *  Kept as data the caller supplies (it owns the holiday calendar) so this stays a
 *  pure formatter. */
export type StatInfo = Record<string, { name: string; alternate?: string }>;

function statSuffix(iso: string, statInfo: StatInfo): string {
  const info = statInfo[iso];
  if (!info) return '';
  const alt = info.alternate ? ` — alternate: ${formatPtoDate(info.alternate)}` : '';
  return ` (${info.name} — stat)${alt}`;
}

/**
 * PTO days actually *taken* (consumed in the past): the total entered minus the
 * upcoming requested + approved days, which are allocated but not yet taken. Lets
 * the balance read "taken / entitlement used · remaining left" — a fully-booked
 * year shows "2 / 15 used · 13 left" (the 13 itemized as requested + approved
 * below) instead of the misleading "15 / 15 used · 0 left". Shared by all three
 * surfaces (text / sheet / PDF) so the figure can't drift between them.
 */
export function ptoTaken(used: number, requestedCount: number, approvedCount: number): number {
  return Math.max(0, used - requestedCount - approvedCount);
}

/**
 * A boss-ready PTO approval request: the days being requested, any upcoming days
 * already approved (shown for the full picture so the balance reconciles), and
 * the running balance. The balance shows days *taken* (consumed) over entitlement;
 * `remaining` (entitlement − taken) is what's left to take, itemized below as the
 * requested + approved days. Shareable as plain text (Web Share / clipboard / email).
 */
export function buildPtoRequest(
  userName: string,
  ptoDates: string[],
  entitlement: number,
  used: number,
  approvedDates: string[] = [],
  statInfo: StatInfo = {},
): string {
  const lines = [`PTO Request — ${userName}`, ''];
  if (ptoDates.length === 0 && approvedDates.length === 0) {
    lines.push('No upcoming PTO days entered.');
    return lines.join('\n');
  }
  const taken = ptoTaken(used, ptoDates.length, approvedDates.length);
  const remaining = Math.max(0, entitlement - taken);

  if (ptoDates.length > 0) {
    lines.push('Requesting the following day(s) off:');
    for (const d of ptoDates) lines.push(` • ${formatPtoDate(d)}${statSuffix(d, statInfo)}`);
    lines.push('');
    lines.push(`${ptoDates.length} day${plural(ptoDates.length)} requested.`);
  }

  if (approvedDates.length > 0) {
    if (ptoDates.length > 0) lines.push('');
    lines.push('Already approved this year:');
    for (const d of approvedDates) lines.push(` • ${formatPtoDate(d)}${statSuffix(d, statInfo)}`);
    lines.push('');
    lines.push(`${approvedDates.length} day${plural(approvedDates.length)} already approved.`);
  }

  lines.push(`Balance: ${taken} of ${entitlement} used · ${remaining} remaining.`);
  if (ptoDates.length > 0) {
    lines.push('');
    lines.push('Please confirm approval — thanks!');
  }
  return lines.join('\n');
}
