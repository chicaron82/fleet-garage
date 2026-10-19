import { supabase } from './supabase';
import { readOnce, throwIfAnyFailed } from './networkBlip';
import { shiftIssueLines, type FaultOpenedRow, type ShiftIssueLine } from './shiftReportIssues';

/**
 * The ISSUES section's data for his shift report: every fault he opened today (migration 150) — a new
 * issue, a reopen, or a fault added to a machine already down. Its own file because ShiftReportExport
 * sits at the enforced line cap; the rule lives, pure and tested, in shiftReportIssues.
 */
export async function fetchShiftIssueLines(userId: string, dayStartISO: string, dayEndISO: string): Promise<ShiftIssueLine[]> {
  // Waited on (the export he taps), so the fast path; and a failure THROWS (2026-10-18): it used to read as "no
  // issues today", the same report a quiet shift prints.
  const { data, error } = await readOnce(() => supabase.from('issue_faults')
    .select('opened_at, note, facility_issues(title, severity)')
    .eq('opened_by', userId)
    .gte('opened_at', dayStartISO).lt('opened_at', dayEndISO));
  throwIfAnyFailed([{ error }], "Couldn't load your whole shift. Check the signal and try again.");
  return shiftIssueLines((data ?? []) as unknown as FaultOpenedRow[]);
}
