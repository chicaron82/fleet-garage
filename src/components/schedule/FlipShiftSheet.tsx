import { useState } from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import type { ShiftType, ShiftWithUser } from '../../types';

const TYPE_LABELS: Record<ShiftType, string> = {
  'opening': 'Opening',
  'mid':     'Mid',
  'closing': 'Closing',
  'day-off': 'Day Off',
};

const TYPE_DEFAULTS: Record<ShiftType, { start: string; end: string }> = {
  'opening': { start: '06:45', end: '15:15' },
  'mid':     { start: '11:00', end: '19:30' },
  'closing': { start: '14:30', end: '23:00' },
  'day-off': { start: '',      end: ''      },
};

const TYPE_COLORS: Record<ShiftType, string> = {
  'opening': 'bg-blue-500 text-white',
  'mid':     'bg-teal-500 text-white',
  'closing': 'bg-yellow-500 text-white',
  'day-off': 'bg-gray-400 text-white',
};

const TYPE_IDLE: Record<ShiftType, string> = {
  'opening': 'border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20',
  'mid':     'border border-teal-300 dark:border-teal-700 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20',
  'closing': 'border border-yellow-300 dark:border-yellow-700 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20',
  'day-off': 'border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
};

interface Props {
  shift: ShiftWithUser;
  onClose: () => void;
}

export function FlipShiftSheet({ shift, onClose }: Props) {
  const { updateShift } = useSchedule();

  const [shiftType, setShiftType] = useState<ShiftType>(shift.shiftType);
  const [startTime, setStartTime] = useState(shift.startTime ?? '');
  const [endTime,   setEndTime]   = useState(shift.endTime   ?? '');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');

  const isDayOff = shiftType === 'day-off';

  const handleTypeChange = (t: ShiftType) => {
    setShiftType(t);
    // Apply default times when switching types — user can override
    setStartTime(TYPE_DEFAULTS[t].start);
    setEndTime(TYPE_DEFAULTS[t].end);
  };

  const handleSave = async () => {
    if (!isDayOff && startTime >= endTime) {
      setError('End time must be after start time.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateShift(shift.id, {
        shiftType,
        startTime: isDayOff ? undefined : startTime,
        endTime:   isDayOff ? undefined : endTime,
      });
      onClose();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const displayDate = new Date(shift.date + 'T12:00:00').toLocaleDateString('en-CA', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-5 space-y-4 transition-colors"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500">{displayDate}</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{shift.user.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl cursor-pointer">×</button>
        </div>

        {/* Type buttons */}
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.keys(TYPE_LABELS) as ShiftType[]).map(t => (
            <button
              key={t}
              onClick={() => handleTypeChange(t)}
              className={`py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                shiftType === t ? TYPE_COLORS[t] : TYPE_IDLE[t]
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Times */}
        {!isDayOff && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start</label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End</label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition"
              />
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 bg-gray-900 dark:bg-gray-100 hover:bg-gray-700 dark:hover:bg-gray-300 disabled:opacity-40 text-white dark:text-gray-900 font-semibold text-sm rounded-xl transition cursor-pointer"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
