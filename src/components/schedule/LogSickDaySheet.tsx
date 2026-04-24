import { useState } from 'react';
import { useSchedule, toISO } from '../../context/ScheduleContext';
import { useAuth } from '../../context/AuthContext';

interface Props {
  onClose: () => void;
}

export function LogSickDaySheet({ onClose }: Props) {
  const { createShift } = useSchedule();
  const { user } = useAuth();
  const [date,   setDate]   = useState(toISO(new Date()));
  const [notes,  setNotes]  = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleLog = async () => {
    if (!user || !date) return;
    setSaving(true);
    setError('');
    try {
      await createShift({
        userId:    user.id,
        date,
        shiftType: 'sick',
        startTime: undefined,
        endTime:   undefined,
        notes:     notes.trim() || undefined,
      });
      onClose();
    } catch {
      setError('Failed to log. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-5 space-y-4 transition-colors"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-base">Log Sick Day</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Records a paid sick day on your schedule</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl cursor-pointer">×</button>
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent transition"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Notes <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Cold, staying home to rest"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent transition resize-none"
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleLog}
            disabled={saving || !date}
            className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-400 disabled:opacity-40 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
          >
            {saving ? 'Logging…' : 'Log Sick Day'}
          </button>
        </div>
      </div>
    </div>
  );
}
