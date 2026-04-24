import { useState } from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import { useAuth } from '../../context/AuthContext';
import { getTypeDefaults } from '../../lib/shiftDefaults';
import type { ShiftType, ShiftWithUser } from '../../types';

const SHIFT_TYPE_OPTIONS: { value: ShiftType; label: string }[] = [
  { value: 'opening', label: 'Opening' },
  { value: 'mid',     label: 'Mid' },
  { value: 'closing', label: 'Closing' },
  { value: 'day-off', label: 'Day Off' },
];

type AddProps = {
  mode: 'add';
  initialDate: string;
  onClose: () => void;
};

type EditProps = {
  mode: 'edit';
  initial: ShiftWithUser;
  onClose: () => void;
};

type Props = AddProps | EditProps;

export function ShiftForm(props: Props) {
  const { createShift, updateShift, deleteShift, isPeakSeason } = useSchedule();
  const { user } = useAuth();

  const isEdit = props.mode === 'edit';
  const existing = isEdit ? props.initial : null;

  const initialShiftType: ShiftType = existing?.shiftType ?? 'closing';
  const initialDefaults = getTypeDefaults(isPeakSeason)[initialShiftType];

  const [date,      setDate]      = useState(existing?.date ?? (props.mode === 'add' ? props.initialDate : ''));
  const [shiftType, setShiftType] = useState<ShiftType>(initialShiftType);
  const [startTime, setStartTime] = useState(existing?.startTime ?? initialDefaults.start);
  const [endTime,   setEndTime]   = useState(existing?.endTime   ?? initialDefaults.end);
  const [notes,     setNotes]     = useState(existing?.notes     ?? '');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isDayOff = shiftType === 'day-off';

  const validate = (): string => {
    if (!date)                     return 'Date is required.';
    if (!isDayOff && !startTime)   return 'Start time is required.';
    if (!isDayOff && !endTime)     return 'End time is required.';
    if (!isDayOff && startTime >= endTime) return 'End time must be after start time.';
    return '';
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError('');
    try {
      if (isEdit && existing) {
        await updateShift(existing.id, {
          date,
          shiftType,
          startTime: isDayOff ? undefined : startTime,
          endTime:   isDayOff ? undefined : endTime,
          notes:     notes.trim() || undefined,
        });
      } else {
        if (!user) return;
        await createShift({
          userId:    user.id,
          date,
          shiftType,
          startTime: isDayOff ? undefined : startTime,
          endTime:   isDayOff ? undefined : endTime,
          notes:     notes.trim() || undefined,
        });
      }
      props.onClose();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    setSaving(true);
    try {
      await deleteShift(existing.id);
      props.onClose();
    } catch {
      setError('Failed to delete. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4" onClick={props.onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-5 space-y-4 transition-colors"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-base">
            {isEdit ? 'Edit Shift' : 'Add Shift'}
          </h2>
          <button onClick={props.onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl cursor-pointer">×</button>
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition"
          />
        </div>

        {/* Shift type */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Shift Type</label>
          <select
            value={shiftType}
            onChange={e => {
              const t = e.target.value as ShiftType;
              setShiftType(t);
              const defaults = getTypeDefaults(isPeakSeason);
              setStartTime(defaults[t].start);
              setEndTime(defaults[t].end);
            }}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition"
          >
            {SHIFT_TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Times — hidden for day-off */}
        {!isDayOff && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition"
              />
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes <span className="font-normal text-gray-400">(optional)</span></label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Covering for Belle"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition resize-none"
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* Delete confirmation */}
        {confirmDelete && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 space-y-2">
            <p className="text-xs text-red-700 dark:text-red-400">Delete this shift?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-xs font-medium rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 py-1.5 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer transition"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        {!confirmDelete && (
          <div className="flex gap-2">
            {isEdit && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-3 py-2.5 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 transition"
              >
                Delete
              </button>
            )}
            <button
              onClick={props.onClose}
              className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 bg-gray-900 dark:bg-gray-100 hover:bg-gray-700 dark:hover:bg-gray-300 disabled:opacity-40 text-white dark:text-gray-900 font-semibold text-sm rounded-lg transition cursor-pointer"
            >
              {saving ? 'Saving…' : 'Save Shift'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
