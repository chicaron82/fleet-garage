import { supabase } from './supabase';
import { shiftIssueLines, type NewIssueRow, type ReopenRow, type ShiftIssueLine } from './shiftReportIssues';

/**
 * The ISSUES section's data for his shift report: issues he CREATED today and machines he REOPENED
 * today, merged by `shiftIssueLines`. Its own file because ShiftReportExport sits at the enforced
 * line cap — the cap asked for a module, and this is the module (2026-09-24,
 * ticket-reopens-invisible-downstream). The merge rule lives, pure and tested, in shiftReportIssues.
 */
export async function fetchShiftIssueLines(userId: string, dayStartISO: string, dayEndISO: string): Promise<ShiftIssueLine[]> {
  const [created, reopened] = await Promise.all([
    supabase.from('facility_issues')
      .select('reported_at, title, severity')
      .eq('reported_by', userId)
      .gte('reported_at', dayStartISO).lt('reported_at', dayEndISO)
      .order('reported_at', { ascending: true }),
    // ⭐ A reopen never changes `reported_at`, so the query above cannot see it — and since 08d4bee
    // a breakdown on a known machine IS a reopen.
    supabase.from('issue_events')
      .select('created_at, note, facility_issues(title, severity)')
      .eq('event_type', 'reopened').eq('user_id', userId)
      .gte('created_at', dayStartISO).lt('created_at', dayEndISO),
  ]);
  return shiftIssueLines(
    (created.data ?? []) as unknown as NewIssueRow[],
    (reopened.data ?? []) as unknown as ReopenRow[],
  );
}
