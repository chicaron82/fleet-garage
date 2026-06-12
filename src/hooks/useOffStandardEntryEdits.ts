import { useState, type Dispatch, type SetStateAction } from 'react';
import { supabase, writeWithRefresh } from '../lib/supabase';
import { pushNotification, NOTIFY_MGMT } from '../lib/garage-uploads';
import { localDateStr } from './useFleetBalance';
import { fmtTime } from '../lib/offStandardReport';
import type { OffStandardEntry, OffStandardReason, User } from '../types';
import { OFF_STANDARD_LABELS, OFF_STANDARD_PRESET_LABELS } from '../types';

interface UseOffStandardEntryEditsProps {
  user: User;
  /** The completed-entries list is owned by the parent; edits mutate it. */
  setEntries: Dispatch<SetStateAction<OffStandardEntry[]>>;
}

/**
 * Mutations on already-completed entries: backdated submissions and edit
 * save / edit-request flows. Each notifies management. These never touch the
 * live timer — they operate purely on the entries list and `editingEntry`.
 */
export function useOffStandardEntryEdits({ user, setEntries }: UseOffStandardEntryEditsProps) {
  const [editingEntry, setEditingEntry] = useState<OffStandardEntry | null>(null);

  const handleSubmitBackdate = async (
    startTime: string,
    endTime:   string,
    reason:    OffStandardReason,
    notes:     string,
  ) => {
    const mins    = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000);
    const entryId = crypto.randomUUID();
    const { error } = await writeWithRefresh(() =>
      supabase.from('off_standard_entries').insert({
        id:             entryId,
        user_id:        user.id,
        branch_id:      user.branchId,
        date:           localDateStr(0),
        start_time:     startTime,
        stop_time:      endTime,
        minutes:        mins,
        reason,
        explanation:    notes || null,
        auto_from_trip: false,
        status:         'complete',
        is_backdated:   true,
        edit_status:    'pending',
      })
    );
    if (!error) {
      const label = OFF_STANDARD_LABELS[reason].short;
      await pushNotification(
        user.branchId,
        NOTIFY_MGMT,
        '⏱️',
        `${user.name} submitted a backdated OTH entry — ${label} — ${fmtTime(startTime)}–${fmtTime(endTime)} — ${notes}`,
        'warning',
        { type: 'oth_backdate_request', entryId },
      );
      setEntries(prev => [...prev, {
        id:           entryId,
        startTime,
        stopTime:     endTime,
        minutes:      mins,
        reason,
        explanation:  notes || undefined,
        autoFromTrip: false,
        isBackdated:  true,
        editStatus:   'pending',
      }]);
    }
  };

  const handleSaveEdit = async (newEndTime: string, newMinutes: number, explanation: string) => {
    if (!editingEntry) return;
    const { error } = await writeWithRefresh(() =>
      supabase.from('off_standard_entries').update({
        stop_time:        newEndTime,
        minutes:          newMinutes,
        explanation:      explanation || null,
        edit_status:      null,
        edited_end_time:  null,
        edit_requested_at: null,
        edit_requested_by: null,
        edit_staff_note:  null,
      }).eq('id', editingEntry.id)
    );
    if (!error) {
      setEntries(prev => prev.map(e => e.id === editingEntry.id
        ? { ...e, stopTime: newEndTime, minutes: newMinutes, explanation: explanation || undefined, editStatus: null }
        : e
      ));
      setEditingEntry(null);
    }
  };

  const handleRequestEdit = async (newEndTime: string, newMinutes: number, editStaffNote: string, explanation: string) => {
    if (!editingEntry) return;
    const now = new Date().toISOString();
    const { error } = await writeWithRefresh(() =>
      supabase.from('off_standard_entries').update({
        edited_end_time:  newEndTime,
        edit_requested_at: now,
        edit_requested_by: user.id,
        edit_status:      'pending',
        edit_staff_note:  editStaffNote || null,
        explanation:      explanation || null,
        edit_reviewed_by: null,
        edit_reviewed_at: null,
      }).eq('id', editingEntry.id)
    );
    if (!error) {
      const label = editingEntry.presetReason
        ? (OFF_STANDARD_PRESET_LABELS[editingEntry.presetReason] ?? OFF_STANDARD_LABELS[editingEntry.reason].short)
        : OFF_STANDARD_LABELS[editingEntry.reason].short;
      await pushNotification(
        user.branchId,
        NOTIFY_MGMT,
        '⏱️',
        `${user.name} requested an OTH edit — ${label} — ${editingEntry.minutes}m → ${newMinutes}m`,
        'warning',
        { type: 'oth_edit_request', entryId: editingEntry.id },
      );
      setEntries(prev => prev.map(e => e.id === editingEntry.id
        ? { ...e, explanation: explanation || undefined, editStatus: 'pending', editedEndTime: newEndTime, editRequestedBy: user.id, editRequestedAt: now, editStaffNote: editStaffNote || undefined }
        : e
      ));
      setEditingEntry(null);
    }
  };

  return {
    editingEntry,
    setEditingEntry,
    handleSubmitBackdate,
    handleSaveEdit,
    handleRequestEdit,
  };
}
