import { useState, useMemo } from 'react';
import type { FacilityIssue, IssueSeverity, BranchId } from '../types';
import type { User } from '../types';
import { supabase, writeWithRefresh } from '../lib/supabase';
import { uploadIssuePhoto } from '../lib/garage-uploads';

export interface IssuesSlice {
  facilityIssues: FacilityIssue[];
  addIssue: (data: { title: string; description?: string; severity: IssueSeverity; photo?: string }) => Promise<void>;
  attachPhoto: (issueId: string, photo: string) => Promise<void>;
  clearIssue: (issueId: string, notes?: string) => Promise<void>;
  reopenIssue: (issueId: string, note?: string) => Promise<void>;
}

export function useIssues(
  user: User | null,
  activeBranch: BranchId | 'ALL',
): IssuesSlice & { setFacilityIssues: React.Dispatch<React.SetStateAction<FacilityIssue[]>> } {
  const [facilityIssues, setFacilityIssues] = useState<FacilityIssue[]>([]);

  const addIssue = async ({ title, description, severity, photo }: { title: string; description?: string; severity: IssueSeverity; photo?: string }) => {
    const issueId   = crypto.randomUUID();
    const branchId  = activeBranch === 'ALL' ? 'YWG' : activeBranch;
    const reportedAt = new Date().toISOString();
    const photoUrl  = photo ? await uploadIssuePhoto(photo, issueId) : null;
    const { error } = await writeWithRefresh(() =>
      supabase.from('facility_issues').insert({
        id:          issueId,
        branch_id:   branchId,
        title,
        description: description ?? null,
        severity,
        reported_by: user!.id,
        reported_at: reportedAt,
        photo_url:   photoUrl ?? null,
      })
    );
    if (!error) {
      setFacilityIssues(prev => [
        { id: issueId, branchId, title, description, severity, reportedById: user!.id, reportedAt, photoUrl: photoUrl ?? undefined, status: 'open', reopenCount: 0 },
        ...prev,
      ]);
      await writeWithRefresh(() =>
        supabase.from('issue_events').insert({
          issue_id:   issueId,
          event_type: 'opened',
          user_id:    user!.id,
          note:       null,
        })
      );
    }
  };

  const attachPhoto = async (issueId: string, photo: string) => {
    const photoUrl = await uploadIssuePhoto(photo, issueId);
    if (!photoUrl) return;
    await writeWithRefresh(() =>
      supabase.from('facility_issues').update({ photo_url: photoUrl }).eq('id', issueId)
    );
    setFacilityIssues(prev =>
      prev.map(i => i.id === issueId ? { ...i, photoUrl } : i)
    );
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

  return { facilityIssues: filteredIssues, addIssue, attachPhoto, clearIssue, reopenIssue, setFacilityIssues };
}
