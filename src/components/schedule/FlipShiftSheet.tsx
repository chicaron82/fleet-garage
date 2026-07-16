import { useState } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useSchedule } from '../../context/ScheduleContext';
import { toISO } from '../../lib/schedule-helpers';
import { useActualHours } from '../../hooks/useActualHours';
import { isStatDay, getStatName } from '../../lib/stats';
import { getTypeDefaults } from '../../lib/shiftDefaults';
import { ClockPicker } from './ClockPicker';
import { ShiftActualHours } from './ShiftActualHours';
import { isFullDayShift } from '../../types';
import type { ShiftType, ShiftWithUser } from '../../types';
import { SHIFT_TYPE_LABEL } from '../../lib/shiftTypeMeta';

// Button tones stay local: active/idle are this sheet's own render context
// (Tailwind needs literal classes per context — see lib/shiftTypeMeta's header).
const TYPE_ACTIVE: Record<ShiftType, string> = {
  'opening': 'bg-blue-500 text-white',
  'mid':     'bg-teal-500 text-white',
  'closing': 'bg-yellow-500 text-white',
  'day-off': 'bg-gray-400 text-white',
  'pto':     'bg-violet-500 text-white',
  'sick':    'bg-rose-500 text-white',
};

const TYPE_IDLE: Record<ShiftType, string> = {
  'opening': 'border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20',
  'mid':     'border border-teal-300 dark:border-teal-700 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20',
  'closing': 'border border-yellow-300 dark:border-yellow-700 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20',
  'day-off': 'border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
  'pto':     'border border-violet-300 dark:border-violet-700 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20',
  'sick':    'border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20',
};

interface Props {
  shift: ShiftWithUser;
  onClose: () => void;
}

// Day after an ISO date — the default backup offered for a stat-day PTO request.
function nextDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function FlipShiftSheet({ shift, onClose }: Props) {
  const { updateShift, deleteShift, logActualHours, setPtoApproved, isPeakSeason } = useSchedule();
  useEscapeKey(onClose);
  const typeDefaults = getTypeDefaults(isPeakSeason);

  const [shiftType, setShiftType] = useState<ShiftType | null>(shift.shiftType);
  const [startTime, setStartTime] = useState(shift.startTime ?? '');
  const [endTime,   setEndTime]   = useState(shift.endTime   ?? '');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [approved,  setApproved]  = useState(shift.ptoApproved ?? false);
  const [alternateDate, setAlternateDate] = useState(shift.ptoAlternateDate ?? nextDay(shift.date));

  const actual = useActualHours(shift, shiftType);
  // Actual hours only apply to a timed shift on or before today — a future shift
  // can't have been worked yet, so scheduling it stays pure (no actual capture).
  const isPastOrToday = shift.date <= toISO(new Date());

  const handleToggleApproved = async () => {
    const next = !approved;
    setApproved(next);
    try { await setPtoApproved(shift.id, next); }
    catch { setApproved(!next); }
  };

  const isDayOff = shiftType !== null && isFullDayShift(shiftType);

  const handleTypeChange = (t: ShiftType) => {
    if (t === shiftType) {
      setShiftType(null);
      return;
    }
    setShiftType(t);
    setStartTime(typeDefaults[t].start);
    setEndTime(typeDefaults[t].end);
    // Mirror the preset into actual hours too, so the default is "worked as
    // scheduled" and the user only edits actual when their real hours differed.
    actual.syncToScheduled(typeDefaults[t].start, typeDefaults[t].end);
  };

  const showActual = shiftType !== null && !isDayOff && isPastOrToday;

  const handleSave = async () => {
    if (shiftType === null) {
      setSaving(true);
      setError('');
      try {
        await deleteShift(shift.id);
        onClose();
      } catch {
        setError('Failed to remove. Please try again.');
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!isDayOff && startTime >= endTime) {
      setError('End time must be after start time.');
      return;
    }
    if (showActual && actual.actualStart && actual.actualEnd && actual.actualStart >= actual.actualEnd) {
      setError('Actual end time must be after start time.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const isStatPto = shiftType === 'pto' && isStatDay(shift.date);
      await updateShift(shift.id, {
        shiftType,
        startTime: isDayOff ? undefined : startTime,
        endTime:   isDayOff ? undefined : endTime,
        ptoAlternateDate: isStatPto ? (alternateDate || undefined) : undefined,
      });
      // One Save logs both: the scheduled block above, and — for a timed shift on
      // or before today — the actual hours (defaulted to the schedule, so an
      // untouched normal day logs "worked as scheduled" with no extra taps).
      if (showActual) {
        await logActualHours(shift.id, actual.actualStart, actual.actualEnd, actual.isStat);
      }
      onClose();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const statName = getStatName(shift.date);
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
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {displayDate}{statName && <span className="ml-1.5 text-amber-500 font-medium">★ {statName}</span>}
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{shift.user.name}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl cursor-pointer">×</button>
        </div>

        {/* Type buttons — 3×2 grid */}
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(SHIFT_TYPE_LABEL) as ShiftType[]).map(t => (
            <button
              key={t}
              onClick={() => handleTypeChange(t)}
              className={`py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                shiftType === t ? TYPE_ACTIVE[t] : TYPE_IDLE[t]
              }`}
            >
              {SHIFT_TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        {/* Stat-day PTO — warn + offer an optional backup date */}
        {shiftType === 'pto' && isStatDay(shift.date) && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 space-y-2">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              ⚠️ {displayDate} is {statName ?? 'a stat holiday'} (stat).
            </p>
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              You can still request it, but consider picking an alternate date as a backup.
            </p>
            <div>
              <label className="block text-[11px] font-medium text-amber-700 dark:text-amber-300 mb-1">Alternate date (optional)</label>
              <input
                type="date"
                value={alternateDate}
                onChange={e => setAlternateDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
              />
            </div>
          </div>
        )}

        {/* PTO approval — only for an already-saved PTO day */}
        {shift.shiftType === 'pto' && (
          <div className="flex items-center justify-between rounded-xl border border-violet-200 dark:border-violet-800/40 bg-violet-50 dark:bg-violet-900/20 px-3 py-2.5">
            <div>
              <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">PTO {approved ? 'approved ✓' : 'pending'}</p>
              <p className="text-[11px] text-violet-500 dark:text-violet-400">{approved ? 'On the books.' : 'Requested — awaiting approval.'}</p>
            </div>
            <button
              type="button"
              onClick={handleToggleApproved}
              className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition cursor-pointer"
            >
              {approved ? 'Mark pending' : 'Mark approved'}
            </button>
          </div>
        )}

        {/* Times */}
        {!isDayOff && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start</label>
              <ClockPicker value={startTime} onChange={setStartTime} direction="up" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End</label>
              <ClockPicker value={endTime} onChange={setEndTime} direction="up" />
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-2.5 disabled:opacity-40 font-semibold text-sm rounded-xl transition cursor-pointer ${
            shiftType === null
              ? 'bg-rose-600 hover:bg-rose-500 text-white'
              : 'bg-gray-900 dark:bg-gray-100 hover:bg-gray-700 dark:hover:bg-gray-300 text-white dark:text-gray-900'
          }`}
        >
          {saving
            ? (shiftType === null ? 'Removing…' : 'Saving…')
            : (shiftType === null ? 'Remove Shift' : 'Save')}
        </button>

        {/* Actual hours — pre-filled from the preset, logged by the single Save above.
            Only for a timed shift on or before today; future shifts stay schedule-only. */}
        {showActual && <ShiftActualHours shift={shift} actual={actual} onClose={onClose} />}
      </div>
    </div>
  );
}
