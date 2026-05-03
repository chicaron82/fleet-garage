import { useState } from 'react';
import type { FacilityIssue, IssueSeverity, BranchId } from '../types';
import type { User } from '../types';
import { supabase } from '../lib/supabase';
import { mapIssue } from '../lib/garage-mappers';

export interface IssuesSlice {
  facilityIssues: FacilityIssue[];
  addIssue: (data: { title: string; description?: string; severity: IssueSeverity }) => Promise<void>;
  clearIssue: (issueId: string, notes?: string) => Promise<void>;
}

export function useIssues(
  user: User | null,
  activeBranch: BranchId | 'ALL',
): IssuesSlice & { setFacilityIssues: React.Dispatch<React.SetStateAction<FacilityIssue[]>> } {
  const [facilityIssues, setFacilityIssues] = useState<FacilityIssue[]>([]);

  const addIssue = async ({ title, description, severity }: { title: string; description?: string; severity: IssueSeverity }) => {
    const branchId = activeBranch === 'ALL' ? 'YWG' : activeBranch;
    const { data } = await supabase.from('facility_issues').insert({
      branch_id:   branchId,
      title,
      description,
      severity,
      reported_by: user!.id,
    }).select().single();
    if (data) setFacilityIssues(prev => [mapIssue(data), ...prev]);
  };

  const clearIssue = async (issueId: string, notes?: string) => {
    const clearedAt = new Date().toISOString();
    await supabase.from('facility_issues').update({
      cleared_by: user!.id,
      cleared_at: clearedAt,
      notes,
    }).eq('id', issueId);
    setFacilityIssues(prev =>
      prev.map(i => i.id === issueId
        ? { ...i, clearedById: user!.id, clearedAt, notes }
        : i
      )
    );
  };

  return { facilityIssues, addIssue, clearIssue, setFacilityIssues };
}
