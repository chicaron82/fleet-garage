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
  user_id: string;
  start_time: string;
  stop_time: string;
  minutes: number;
  reason: OffStandardReason;
  preset_reason: OffStandardPresetReason | null;
  explanation: string | null;
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

export function BackdateApprovalSheet({ entryId, onClose }: Props) {
  const { user } = useAuth();
  const { getProfile } = useUserResolver();
  const [entry, setEntry]       = useState<EntryRow | null>(null);
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase
      .from('off_standard_entries')
      .select('id, branch_id, user_id, start_time, stop_time, minutes, reason, preset_reason, explanation')
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

  const staffUser = getProfile(entry.user_id);

  const handleApprove = async () => {
    hapticMedium();
    setSubmitting(true);
    const now = new Date().toISOString();
    const { error } = await writeWithRefresh(() =>
      supabase.from('off_standard_entries').update({
        edit_status:          'approved',
        backdate_approved_by: user.id,
        backdate_approved_at: now,
        edit_reviewed_by:     user.id,
        edit_reviewed_at:     now,
      }).eq('id', entryId)
    );
    if (!error) {
      await pushNotification(
        entry.branch_id,
        [],
        '✅',
        `Your backdated OTH entry was approved by ${user.name}.`,
        'success',
        undefined,
        entry.user_id,
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
        `Your backdated OTH entry was denied by ${user.name}.`,
        'info',
        undefined,
        entry.user_id,
      );
      onClose();
    }
    setSubmitting(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl p-6 space-y-5 motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:duration-200">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">Backdated OTH Entry</p>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">Backdated</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-lg leading-none">✕</button>
        </div>

        {/* Staff */}
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Staff</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {staffUser ? `${staffUser.name} · ${staffUser.employeeId}` : entry.user_id}
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
            <span className="text-gray-500 dark:text-gray-400">Time range</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {fmtTime(entry.start_time)} – {fmtTime(entry.stop_time)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Duration</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{fmtMinutes(entry.minutes)}</span>
          </div>
        </div>

        {/* Notes */}
        {entry.explanation && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-1">Staff notes</p>
            <p className="text-sm text-amber-900 dark:text-amber-200">{entry.explanation}</p>
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
