// The ISSUES section of his shift report: every fault he OPENED today.
//
// ⭐ History. The report first listed issues by `reported_at`, which a reopen never changes — so the
// auto wash's snapped rinse pipe (reopened 17:02, 2026-09-24) was missing from his own day. The fix
// read reopen events too. Then faults became rows (migration 150): a new issue, a reopen and a
// "+ Add fault" on a machine already down ALL open a fault — so one question now covers all three:
// *which faults did he open today?* docs/September/ticket-faults-as-rows.md

/** An `issue_faults` row he opened today, with its machine embedded. */
export interface FaultOpenedRow {
  opened_at: string;
  note: string;
  facility_issues: { title: string; severity: string } | null;
}

export interface ShiftIssueLine {
  reportedAt: string;
  title: string;
  severity: string;
  /** What broke — omitted when it only repeats the machine's title (a new issue with no description). */
  note?: string;
}

export function shiftIssueLines(rows: readonly FaultOpenedRow[]): ShiftIssueLine[] {
  const lines: ShiftIssueLine[] = [];
  for (const r of rows) {
    // ⚠️ A fault whose machine didn't come back with it is dropped, not printed as "undefined".
    if (!r.facility_issues) continue;
    const note = r.note?.trim();
    const { title, severity } = r.facility_issues;
    lines.push(note && note !== title.trim()
      ? { reportedAt: r.opened_at, title, severity, note }
      : { reportedAt: r.opened_at, title, severity });
  }
  return lines.sort((a, b) => a.reportedAt.localeCompare(b.reportedAt));
}
