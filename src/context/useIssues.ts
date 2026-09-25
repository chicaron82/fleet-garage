import { useState, useMemo } from 'react';
import type { FacilityIssue, IssueSeverity, BranchId } from '../types';
import type { User } from '../types';
import type { IssueFault } from '../../api/_lib/issueFaults';
import { supabase, writeWithRefresh } from '../lib/supabase';
import { uploadIssuePhoto, uploadIssueFaultPhoto } from '../lib/garage-uploads';
import { withSubmitLock } from '../lib/submitLock';

// ⭐ FAULTS AS ROWS (migration 150, 2026-09-24). The machine is the record; each thing wrong with it
// is a fault with its own note, photo, start and Clear. Aaron, at the auto wash: *"there's also
// another issue … The wheel brush on the passenger side isn't spinning."* The machine is open while
// any fault is open. `issue_events` keeps the machine's open / clear / reopen history as before.
// docs/September/ticket-faults-as-rows.md
export interface IssuesSlice {
  facilityIssues: FacilityIssue[];
  addIssue: (data: { title: string; description?: string; severity: IssueSeverity; photo?: string }) => Promise<void>;
  /** Clear the WHOLE machine — every open fault — as fixed. */
  clearIssue: (issueId: string, notes?: string) => Promise<void>;
  /** A resolved machine is down again. The note is the fault — required by every caller's UI. */
  reopenIssue: (issueId: string, note?: string, photo?: string) => Promise<void>;
  /** One MORE thing wrong with a machine that is already down. */
  addFault: (issueId: string, note: string, photo?: string) => Promise<void>;
  /** One fault fixed. Clearing the machine's LAST open fault clears the machine. */
  clearFault: (fault: IssueFault, note?: string) => Promise<void>;
  attachFaultPhoto: (fault: IssueFault, photo: string) => Promise<void>;
}

export function useIssues(
  user: User | null,
  activeBranch: BranchId | 'ALL',
): IssuesSlice & { setFacilityIssues: React.Dispatch<React.SetStateAction<FacilityIssue[]>> } {
  const [facilityIssues, setFacilityIssues] = useState<FacilityIssue[]>([]);

  /** Write one fault row and put it on the card. Every way a fault comes to exist goes through here. */
  const insertFault = async (issueId: string, note: string, photoUrl: string | null): Promise<void> => {
    const openedAt = new Date().toISOString();
    const { data } = await writeWithRefresh(() =>
      supabase.from('issue_faults').insert({
        issue_id: issueId, note, photo_url: photoUrl, opened_at: openedAt, opened_by: user!.id,
      }).select('id').single()
    );
    const fault: IssueFault = {
      id: (data as { id?: string } | null)?.id ?? crypto.randomUUID(),
      issueId, note, openedAt, openedBy: user!.id, ...(photoUrl ? { photoUrl } : {}),
    };
    setFacilityIssues(prev => prev.map(i => i.id === issueId ? { ...i, faults: [...(i.faults ?? []), fault] } : i));
  };

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
          { id: issueId, branchId, title, description, severity, reportedById: user!.id, reportedAt, photoUrl: photoUrl ?? undefined, status: 'open', reopenCount: 0, faults: [] },
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
        // ⭐ Its FIRST fault — so every open machine has at least one, and one shape serves the card,
        // Effie and the shift report. The first fault's words are the description (or the title).
        await insertFault(issueId, description?.trim() || title, photoUrl);
      }
    });
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
    // The machine is fixed → every fault still open on it is fixed with it.
    await writeWithRefresh(() =>
      supabase.from('issue_faults').update({ cleared_at: clearedAt, cleared_by: user!.id, clear_note: notes ?? null })
        .eq('issue_id', issueId).is('cleared_at', null)
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
        ? { ...i, clearedById: user!.id, clearedAt, notes, status: 'resolved' as const, faults: [] }
        : i
      )
    );
  };

  const reopenIssue = async (issueId: string, note?: string, photo?: string) => {
    // ⚠️ LOCKED — a reopen now MINTS a fault row, so a same-frame double-tap would log the breakdown
    // twice. Keyed per person + machine + what broke (CLAUDE.md "Writing data").
    await withSubmitLock(`fault:${user?.id}:${issueId}:${(note ?? '').trim().toLowerCase()}`, async () => {
      const currentCount = facilityIssues.find(i => i.id === issueId)?.reopenCount ?? 0;
      // A photo of THIS fault rides on its own row; a failed upload still reopens.
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
        })
      );
      setFacilityIssues(prev =>
        prev.map(i => i.id === issueId
          ? { ...i, clearedById: undefined, clearedAt: undefined, status: 'reopened' as const, reopenCount: newCount, faults: [] }
          : i
        )
      );
      await insertFault(issueId, note?.trim() || 'Not recorded', photoUrl);
    });
  };

  const addFault = async (issueId: string, note: string, photo?: string) => {
    const issue = facilityIssues.find(i => i.id === issueId);
    // Adding to a machine that has been cleared IS reopening it — one path, not two.
    if (issue?.status === 'resolved') return reopenIssue(issueId, note, photo);
    // ⚠️ LOCKED for the same reason as reopen: a double-tapped "+ Add fault" must not add it twice.
    await withSubmitLock(`fault:${user?.id}:${issueId}:${note.trim().toLowerCase()}`, async () => {
      const photoUrl = photo ? await uploadIssueFaultPhoto(photo, issueId) : null;
      await insertFault(issueId, note.trim(), photoUrl);
    });
  };

  const clearFault = async (fault: IssueFault, note?: string) => {
    const remaining = (facilityIssues.find(i => i.id === fault.issueId)?.faults ?? []).filter(f => f.id !== fault.id);
    // ⭐ The LAST open fault takes the machine with it — the machine is open while any fault is.
    if (remaining.length === 0) return clearIssue(fault.issueId, note);
    await writeWithRefresh(() =>
      supabase.from('issue_faults').update({ cleared_at: new Date().toISOString(), cleared_by: user!.id, clear_note: note ?? null })
        .eq('id', fault.id)
    );
    setFacilityIssues(prev => prev.map(i => i.id === fault.issueId ? { ...i, faults: remaining } : i));
  };

  const attachFaultPhoto = async (fault: IssueFault, photo: string) => {
    const url = await uploadIssueFaultPhoto(photo, fault.issueId);
    if (!url) return;
    await writeWithRefresh(() => supabase.from('issue_faults').update({ photo_url: url }).eq('id', fault.id));
    setFacilityIssues(prev => prev.map(i => i.id === fault.issueId
      ? { ...i, faults: (i.faults ?? []).map(f => f.id === fault.id ? { ...f, photoUrl: url } : f) }
      : i));
  };

  const filteredIssues = useMemo(() => {
    if (activeBranch === 'ALL') return facilityIssues;
    return facilityIssues.filter(i => i.branchId === activeBranch);
  }, [facilityIssues, activeBranch]);

  return { facilityIssues: filteredIssues, addIssue, clearIssue, reopenIssue, addFault, clearFault, attachFaultPhoto, setFacilityIssues };
}
