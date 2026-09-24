import { useState, useMemo } from 'react';
import type { FacilityIssue, IssueSeverity, BranchId } from '../types';
import type { User } from '../types';
import { supabase, writeWithRefresh } from '../lib/supabase';
import { uploadIssuePhoto, uploadIssueFaultPhoto } from '../lib/garage-uploads';
import { currentFaultEvents } from '../lib/currentFault';
import { withSubmitLock } from '../lib/submitLock';

export interface IssuesSlice {
  facilityIssues: FacilityIssue[];
  addIssue: (data: { title: string; description?: string; severity: IssueSeverity; photo?: string }) => Promise<void>;
  attachPhoto: (issueId: string, photo: string) => Promise<void>;
  clearIssue: (issueId: string, notes?: string) => Promise<void>;
  reopenIssue: (issueId: string, note?: string, photo?: string) => Promise<void>;
}

export function useIssues(
  user: User | null,
  activeBranch: BranchId | 'ALL',
): IssuesSlice & { setFacilityIssues: React.Dispatch<React.SetStateAction<FacilityIssue[]>> } {
  const [facilityIssues, setFacilityIssues] = useState<FacilityIssue[]>([]);

  const addIssue = async ({ title, description, severity, photo }: { title: string; description?: string; severity: IssueSeverity; photo?: string }) => {
    // The handler doesn't gate on its submitting flag at all, so a double-tap can
    // file two identical facility issues. Keyed per reporter+title.
    await withSubmitLock(`issue:${user?.id}:${title.trim().toLowerCase()}`, async () => {
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
        setFacilityIssues(prev => prev.some(i => i.id === issueId) ? prev : [
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
    });
  };

  // ⭐ FAULT-AWARE (2026-09-24, migration 149). A machine with a CURRENT fault gets the photo on that
  // fault's reopen event — the one the card reads (lib/currentFault) — so "+ Add photo" after a
  // reopen pictures what broke THIS time. Only a machine with no later fault takes it on the issue
  // itself, as its first-fault photo. Aaron: *"couldn't … attach a new photo of it in the issue log."*
  const attachPhoto = async (issueId: string, photo: string) => {
    if (facilityIssues.find(i => i.id === issueId)?.currentFault) {
      const { data: trail } = await supabase.from('issue_events')
        .select('id, issue_id, event_type, note, created_at')
        .eq('issue_id', issueId).eq('event_type', 'reopened');
      const target = currentFaultEvents((trail ?? []).map(r => ({
        issueId: r.issue_id as string, eventType: r.event_type as string,
        note: r.note as string | null, createdAt: r.created_at as string, id: r.id as string,
      }))).get(issueId);
      if (!target?.id) return;
      const url = await uploadIssueFaultPhoto(photo, issueId);
      if (!url) return;
      await writeWithRefresh(() => supabase.from('issue_events').update({ photo_url: url }).eq('id', target.id!));
      setFacilityIssues(prev => prev.map(i => i.id === issueId ? { ...i, currentPhoto: url } : i));
      return;
    }
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

  // ⚠️ `note` is the FAULT now, not a nicety — the card requires it (2026-09-20,
  // docs/September/ticket-the-machine-is-the-record.md). Kept optional in the signature because the
  // assistant path and older callers exist; a blank one simply leaves the card showing the first
  // fault, which is what every reopen before today did.
  const reopenIssue = async (issueId: string, note?: string, photo?: string) => {
    const currentCount = facilityIssues.find(i => i.id === issueId)?.reopenCount ?? 0;
    // A photo of THIS fault rides on its own event (migration 149); a failed upload still reopens.
    const photoUrl = photo ? await uploadIssueFaultPhoto(photo, issueId) : null;
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
        photo_url:  photoUrl,
      })
    );
    setFacilityIssues(prev =>
      prev.map(i => i.id === issueId
        ? {
            ...i,
            clearedById: undefined, clearedAt: undefined,
            status: 'reopened' as const,
            reopenCount: newCount,
            // ⭐ Optimistic, so the card says what's wrong the moment he taps rather than after a
            // reload — the derived value the loader would compute from the event just written.
            currentFault: note?.trim() || i.currentFault,
            // A new fault replaces the picture too — its own photo, or none. Never the old fault's.
            currentPhoto: note?.trim() ? (photoUrl ?? undefined) : i.currentPhoto,
          }
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
