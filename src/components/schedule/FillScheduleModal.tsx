import { useState, useMemo } from 'react';
import { useSchedule, toISO } from '../../context/ScheduleContext';
import { useAuth } from '../../context/AuthContext';
import type { ShiftType } from '../../types';

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// checkbox index 0=Mon…6=Sun → JS getDay() 0=Sun…6=Sat
const CHECKBOX_TO_GETDAY = [1, 2, 3, 4, 5, 6, 0];

function defaultFrom(): string {
  return toISO(new Date());
}

function defaultTo(): string {
  const now = new Date();
  return toISO(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

function generateDates(from: string, to: string, selectedDows: number[]): string[] {
  const dates: string[] = [];
  const end = new Date(to + 'T12:00:00');
  const cur = new Date(from + 'T12:00:00');
  while (cur <= end) {
    const jsDay = cur.getDay();
    if (selectedDows.some(ci => CHECKBOX_TO_GETDAY[ci] === jsDay)) {
      dates.push(toISO(cur));
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

interface Props {
  onClose: () => void;
}

export function FillScheduleModal({ onClose }: Props) {
  const { shifts, bulkCreateShifts, refresh } = useSchedule();
  const { user } = useAuth();

  const [shiftType, setShiftType] = useState<ShiftType>('closing');
  const [startTime, setStartTime] = useState('');
  const [endTime,   setEndTime]   = useState('');
  const [dows,      setDows]      = useState<number[]>([]);
  const [from,      setFrom]      = useState(defaultFrom);
  const [to,        setTo]        = useState(defaultTo);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');

  const isDayOff = shiftType === 'day-off';

  // Existing shift dates for this user
  const existingDates = useMemo(
    () => new Set(shifts.filter(s => s.userId === user?.id).map(s => s.date)),
    [shifts, user?.id]
  );

  // Candidate dates: matching DOW + in range + no existing shift
  const candidateDates = useMemo(() => {
    if (!from || !to || dows.length === 0) return [];
    return generateDates(from, to, dows).filter(d => !existingDates.has(d));
  }, [from, to, dows, existingDates]);

  const toggleDow = (i: number) =>
    setDows(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]);

  const validate = (): string => {
    if (!from || !to)              return 'Date range is required.';
    if (from > to)                 return 'Start date must be before end date.';
    if (dows.length === 0)         return 'Select at least one day of the week.';
    if (!isDayOff && !startTime)   return 'Start time is required.';
    if (!isDayOff && !endTime)     return 'End time is required.';
    if (!isDayOff && startTime >= endTime) return 'End time must be after start time.';
    if (candidateDates.length === 0) return 'No new shifts to create (all dates already have shifts).';
    return '';
  };

  const handleFill = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    if (!user) return;

    setSaving(true);
    setError('');
    try {
      await bulkCreateShifts(candidateDates.map(date => ({
        userId:    user.id,
        date,
        shiftType,
        startTime: isDayOff ? undefined : startTime,
        endTime:   isDayOff ? undefined : endTime,
        notes:     undefined,
      })));
      refresh();
      onClose();
    } catch {
      setError('Failed to save shifts. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-5 space-y-4 transition-colors max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-base">Fill My Schedule</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Set a recurring shift for selected days</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl cursor-pointer">×</button>
        </div>

        {/* Shift type */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Shift Type</label>
          <select
            value={shiftType}
            onChange={e => setShiftType(e.target.value as ShiftType)}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition"
          >
            <option value="opening">Opening</option>
            <option value="mid">Mid</option>
            <option value="closing">Closing</option>
            <option value="day-off">Day Off</option>
          </select>
        </div>

        {/* Times */}
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

        {/* Days of week */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Days of Week</label>
          <div className="flex gap-1.5 flex-wrap">
            {DOW_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => toggleDow(i)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  dows.includes(i)
                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                    : 'border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition"
            />
          </div>
        </div>

        {/* Live preview */}
        {dows.length > 0 && from && to && from <= to && (
          <div className={`px-3 py-2 rounded-lg text-xs font-medium ${
            candidateDates.length > 0
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
          }`}>
            {candidateDates.length > 0
              ? `This will create ${candidateDates.length} shift${candidateDates.length !== 1 ? 's' : ''}`
              : 'No new shifts — all selected dates already have shifts'
            }
          </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleFill}
            disabled={saving}
            className="flex-1 py-2.5 bg-gray-900 dark:bg-gray-100 hover:bg-gray-700 dark:hover:bg-gray-300 disabled:opacity-40 text-white dark:text-gray-900 font-semibold text-sm rounded-lg transition cursor-pointer"
          >
            {saving ? 'Filling…' : `Fill Schedule`}
          </button>
        </div>
      </div>
    </div>
  );
}
