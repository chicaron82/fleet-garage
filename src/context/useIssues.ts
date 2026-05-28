import { useState, useMemo } from 'react';
import type { FacilityIssue, IssueSeverity, BranchId } from '../types';
import type { User } from '../types';
import { supabase, writeWithRefresh } from '../lib/supabase';
import { mapIssue } from '../lib/garage-mappers';

export interface IssuesSlice {
  facilityIssues: FacilityIssue[];
  addIssue: (data: { title: string; description?: string; severity: IssueSeverity }) => Promise<void>;
  clearIssue: (issueId: string, notes?: string) => Promise<void>;
  reopenIssue: (issueId: string, note?: string) => Promise<void>;
}

export function useIssues(
  user: User | null,
  activeBranch: BranchId | 'ALL',
): IssuesSlice & { setFacilityIssues: React.Dispatch<React.SetStateAction<FacilityIssue[]>> } {
  const [facilityIssues, setFacilityIssues] = useState<FacilityIssue[]>([]);

  const addIssue = async ({ title, description, severity }: { title: string; description?: string; severity: IssueSeverity }) => {
    const branchId = activeBranch === 'ALL' ? 'YWG' : activeBranch;
    const { data } = await writeWithRefresh(() =>
      supabase.from('facility_issues').insert({
        branch_id:   branchId,
        title,
        description,
        severity,
        reported_by: user!.id,
      }).select().single()
    );
    if (data) {
      setFacilityIssues(prev => [mapIssue(data), ...prev]);
      await writeWithRefresh(() =>
        supabase.from('issue_events').insert({
          issue_id:   (data as Record<string, unknown>).id as string,
          event_type: 'opened',
          user_id:    user!.id,
          note:       null,
        })
      );
    }
  };

  const clearIssue = async (issueId: string, notes?: string) => {
    const clearedAt = new Date().toISOString();
    await writeWithRefresh(() =>
      supabase.from('facility_issues').update({
        cleared_by: user!.id,
        cleared_at: clearedAt,
        notes,
        status:     'resolved',
      }).eq('id', issueId)
    );
    await writeWithRefresh(() =>
      supabase.from('issue_events').insert({
        issue_id:   issueId,
        event_type: 'resolved',
        user_id:    user!.id,
        note:       notes || null,
      })
    );
    setFacilityIssues(prev =>
      prev.map(i => i.id === issueId
        ? { ...i, clearedById: user!.id, clearedAt, notes, status: 'resolved' as const }
        : i
      )
    );
  };

  const reopenIssue = async (issueId: string, note?: string) => {
    const currentCount = facilityIssues.find(i => i.id === issueId)?.reopenCount ?? 0;
    const newCount = currentCount + 1;
    await writeWithRefresh(() =>
      supabase.from('facility_issues').update({
        cleared_by:   null,
        cleared_at:   null,
        status:       'reopened',
        reopen_count: newCount,
      }).eq('id', issueId)
    );
    await writeWithRefresh(() =>
      supabase.from('issue_events').insert({
        issue_id:   issueId,
        event_type: 'reopened',
        user_id:    user!.id,
        note:       note || null,
      })
    );
    setFacilityIssues(prev =>
      prev.map(i => i.id === issueId
        ? { ...i, clearedById: undefined, clearedAt: undefined, status: 'reopened' as const, reopenCount: newCount }
        : i
      )
    );
  };

  const filteredIssues = useMemo(() => {
    if (activeBranch === 'ALL') return facilityIssues;
    return facilityIssues.filter(i => i.branchId === activeBranch);
  }, [facilityIssues, activeBranch]);

  return { facilityIssues: filteredIssues, addIssue, clearIssue, reopenIssue, setFacilityIssues };
}
