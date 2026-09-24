// The ISSUES section of his shift report: what he logged today — new issues AND reopens.
//
// ⭐ Aaron's day, 2026-09-24: the auto wash's rinse pipe snapped off the arch and he reopened the
// machine at 17:02. His shift report filtered issues on `reported_at`, which a reopen never changes,
// so the day's one real breakdown was missing from his own report. Since 08d4bee (2026-09-20, "the
// machine is the record") FG deliberately steers a breakdown on a known machine into a REOPEN — so
// the report was undercounting exactly the breakdowns. docs/September/ticket-reopens-invisible-downstream.md

/** A `facility_issues` row he reported today. */
export interface NewIssueRow { reported_at: string; title: string; severity: string }

/** An `issue_events` reopen he made today, with its machine embedded. */
export interface ReopenRow {
  created_at: string;
  note: string | null;
  facility_issues: { title: string; severity: string } | null;
}

export interface ShiftIssueLine {
  reportedAt: string;
  title: string;
  severity: string;
  /** Present on a reopen: what he said broke this time ('' for an old blank reopen). */
  reopenedFault?: string;
}

export function shiftIssueLines(newIssues: readonly NewIssueRow[], reopens: readonly ReopenRow[]): ShiftIssueLine[] {
  const lines: ShiftIssueLine[] = newIssues.map(r => ({ reportedAt: r.reported_at, title: r.title, severity: r.severity }));
  for (const r of reopens) {
    // ⚠️ A reopen whose machine didn't come back with it is dropped, not printed as "undefined".
    if (!r.facility_issues) continue;
    lines.push({
      reportedAt: r.created_at,
      title: r.facility_issues.title,
      severity: r.facility_issues.severity,
      reopenedFault: r.note?.trim() ?? '',
    });
  }
  return lines.sort((a, b) => a.reportedAt.localeCompare(b.reportedAt));
}
