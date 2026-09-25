import { supabase } from './supabase';
import { shiftIssueLines, type FaultOpenedRow, type ShiftIssueLine } from './shiftReportIssues';

/**
 * The ISSUES section's data for his shift report: every fault he opened today (migration 150) — a new
 * issue, a reopen, or a fault added to a machine already down. Its own file because ShiftReportExport
 * sits at the enforced line cap; the rule lives, pure and tested, in shiftReportIssues.
 */
export async function fetchShiftIssueLines(userId: string, dayStartISO: string, dayEndISO: string): Promise<ShiftIssueLine[]> {
  const { data } = await supabase.from('issue_faults')
    .select('opened_at, note, facility_issues(title, severity)')
    .eq('opened_by', userId)
    .gte('opened_at', dayStartISO).lt('opened_at', dayEndISO);
  return shiftIssueLines((data ?? []) as unknown as FaultOpenedRow[]);
}
