import { useState, useEffect } from 'react';
import { hapticMedium, hapticLight } from '../../lib/haptics';
import { supabase, writeWithRefresh } from '../../lib/supabase';
import { pushNotification } from '../../lib/garage-uploads';
import { useAuth } from '../../context/AuthContext';
import { useUserResolver } from '../../hooks/useUserResolver';
import { OFF_STANDARD_LABELS, OFF_STANDARD_PRESET_LABELS } from '../../types';
import type { OffStandardReason, OffStandardPresetReason } from '../../types';

interface Props {
  entryId: string;
  onClose: () => void;
}

interface EntryRow {
  id: string;
  branch_id: string;
  start_time: string;
  stop_time: string;
  minutes: number;
  reason: OffStandardReason;
  preset_reason: OffStandardPresetReason | null;
  edited_end_time: string;
  edit_requested_by: string;
  edit_staff_note: string | null;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function fmtMinutes(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function entryLabel(reason: OffStandardReason, preset: OffStandardPresetReason | null): string {
  if (preset && OFF_STANDARD_PRESET_LABELS[preset]) return OFF_STANDARD_PRESET_LABELS[preset];
  return OFF_STANDARD_LABELS[reason].full;
}

export function OthEditApprovalSheet({ entryId, onClose }: Props) {
  const { user } = useAuth();
  const { getProfile } = useUserResolver();
  const [entry, setEntry] = useState<EntryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase
      .from('off_standard_entries')
      .select('id, branch_id, start_time, stop_time, minutes, reason, preset_reason, edited_end_time, edit_requested_by, edit_staff_note')
      .eq('id', entryId)
      .single()
      .then(({ data }) => {
        setEntry(data as EntryRow | null);
        setLoading(false);
      });
  }, [entryId]);

  if (!user || loading || !entry) {
    return (
      <>
        <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
        <div className="fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl p-6 flex items-center justify-center min-h-48">
          <p className="text-sm text-gray-400 dark:text-gray-500">{loading ? 'Loading…' : 'Entry not found.'}</p>
        </div>
      </>
    );
  }

  const staffUser = getProfile(entry.edit_requested_by);
  const newMins = Math.round(
    (new Date(entry.edited_end_time).getTime() - new Date(entry.start_time).getTime()) / 60000
  );
  const delta = newMins - entry.minutes;

  const handleApprove = async () => {
    hapticMedium();
    setSubmitting(true);
    const now = new Date().toISOString();
    const { error } = await writeWithRefresh(() =>
      supabase.from('off_standard_entries').update({
        stop_time:        entry.edited_end_time,
        minutes:          newMins,
        edit_status:      'approved',
        edit_reviewed_by: user.id,
        edit_reviewed_at: now,
      }).eq('id', entryId)
    );
    if (!error) {
      await pushNotification(
        entry.branch_id,
        [],
        '✅',
        `Your OTH time edit was approved by ${user.name}.`,
        'success',
        undefined,
        entry.edit_requested_by,
      );
      onClose();
    }
    setSubmitting(false);
  };

  const handleDeny = async () => {
    hapticLight();
    setSubmitting(true);
    const now = new Date().toISOString();
    const { error } = await writeWithRefresh(() =>
      supabase.from('off_standard_entries').update({
        edit_status:      'denied',
        edit_reviewed_by: user.id,
        edit_reviewed_at: now,
      }).eq('id', entryId)
    );
    if (!error) {
      await pushNotification(
        entry.branch_id,
        [],
        '✕',
        `Your OTH time edit was denied by ${user.name}.`,
        'info',
        undefined,
        entry.edit_requested_by,
      );
      onClose();
    }
    setSubmitting(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl p-6 space-y-5 animate-in slide-in-from-bottom duration-200">

        <div className="flex items-center justify-between">
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">OTH Edit Request</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-lg leading-none">✕</button>
        </div>

        {/* Staff */}
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Staff</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {staffUser ? `${staffUser.name} · ${staffUser.employeeId}` : entry.edit_requested_by}
          </p>
        </div>

        {/* Entry details */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Reason</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {entryLabel(entry.reason, entry.preset_reason)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Start</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{fmtTime(entry.start_time)}</span>
          </div>
          <div className="flex items-center justify-between text-sm border-t border-gray-100 dark:border-gray-800 pt-3">
            <span className="text-gray-500 dark:text-gray-400">Original end</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {fmtTime(entry.stop_time)} · {fmtMinutes(entry.minutes)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Requested end</span>
            <span className="font-semibold text-amber-700 dark:text-amber-400">
              {fmtTime(entry.edited_end_time)} · {fmtMinutes(newMins)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Delta</span>
            <span className="font-bold text-amber-700 dark:text-amber-400">+{delta}m</span>
          </div>
        </div>

        {/* Staff note */}
        {entry.edit_staff_note && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-1">Staff note</p>
            <p className="text-sm text-amber-900 dark:text-amber-200">{entry.edit_staff_note}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleDeny}
            disabled={submitting}
            className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
          >
            Deny
          </button>
          <button
            onClick={handleApprove}
            disabled={submitting}
            className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 active:scale-95 text-sm font-bold text-white transition-all cursor-pointer disabled:opacity-40"
          >
            Approve
          </button>
        </div>

      </div>
    </>
  );
}
