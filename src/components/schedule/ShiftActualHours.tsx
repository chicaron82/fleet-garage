import { useState } from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import { isStatDay, getStatName } from '../../lib/stats';
import { calcOT, calcHours, netActualHours, fmtHours } from '../../lib/ot';
import type { ShiftType, ShiftWithUser } from '../../types';

interface Props {
  shift: ShiftWithUser;
  /** The sheet's live type-button selection, so the OT preview tracks an unsaved type change. */
  shiftType: ShiftType | null;
  onClose: () => void;
}

/**
 * The "actual hours" section of the shift sheet: log the real clock-in/out, see
 * the live OT preview, and clear saved hours back to null. Split out of
 * FlipShiftSheet so the sheet stays a thin composer under the line cap — this
 * owns all of its own state and the two writes (log / clear).
 */
export function ShiftActualHours({ shift, shiftType, onClose }: Props) {
  const { logActualHours } = useSchedule();

  const [showActual,   setShowActual]   = useState(false);
  const [actualStart,  setActualStart]  = useState(shift.actualStartTime ?? '');
  const [actualEnd,    setActualEnd]    = useState(shift.actualEndTime   ?? '');
  const [isStat,       setIsStat]       = useState(shift.isStat ?? isStatDay(shift.date));
  const [savingActual, setSavingActual] = useState(false);
  const [actualError,  setActualError]  = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const statName = getStatName(shift.date);

  // Live OT preview
  const previewOT = calcOT({
    ...shift,
    shiftType: shiftType ?? shift.shiftType,
    actualStartTime: actualStart || undefined,
    actualEndTime:   actualEnd   || undefined,
    isStat,
  });
  const grossHrs      = calcHours(actualStart, actualEnd);
  const netHrs        = netActualHours(grossHrs);
  const breakDeducted = grossHrs > 0 && netHrs < grossHrs;

  const handleLogActual = async () => {
    if (actualStart && actualEnd && actualStart >= actualEnd) {
      setActualError('End time must be after start time.');
      return;
    }
    setSavingActual(true);
    setActualError('');
    try {
      await logActualHours(shift.id, actualStart, actualEnd, isStat);
      onClose();
    } catch {
      setActualError('Failed to save. Please try again.');
    } finally {
      setSavingActual(false);
    }
  };

  // Clear saved actual hours back to null. The normal Log Hours submit is guarded
  // on both fields being non-empty, so blanking the inputs can't reach the DB —
  // this routes around that guard with empty strings (logActualHours writes null
  // for either empty value). Only offered when hours are actually saved.
  const handleClearActual = async () => {
    setSavingActual(true);
    setActualError('');
    try {
      await logActualHours(shift.id, '', '', false);
      onClose();
    } catch {
      setActualError('Failed to clear. Please try again.');
    } finally {
      setSavingActual(false);
    }
  };

  return (
    <>
      {/* Divider */}
      <div className="border-t border-gray-100 dark:border-gray-800" />

      {!showActual ? (
        <button
          onClick={() => setShowActual(true)}
          className="w-full text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-left transition cursor-pointer"
        >
          {shift.actualStartTime ? '✏️ Edit actual hours' : 'Log actual hours ↓'}
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Actual Hours</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start</label>
              <input
                type="time"
                value={actualStart}
                onChange={e => setActualStart(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End</label>
              <input
                type="time"
                value={actualEnd}
                onChange={e => setActualEnd(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition"
              />
            </div>
          </div>

          {/* Stat checkbox */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isStat}
              onChange={e => setIsStat(e.target.checked)}
              className="w-4 h-4 rounded accent-yellow-500"
            />
            <span className="text-xs text-gray-700 dark:text-gray-300">
              Stat holiday
              {statName && <span className="ml-1 text-amber-500 font-medium">★ {statName}</span>}
            </span>
          </label>

          {/* Live OT calculation */}
          {actualStart && actualEnd && (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
              {fmtHours(netHrs)} actual
              {breakDeducted && <span className="ml-1 text-gray-400 dark:text-gray-500">· −30m break</span>}
              {previewOT > 0
                ? <span className="ml-2 font-semibold text-amber-600 dark:text-amber-400">· {fmtHours(previewOT)} OT</span>
                : <span className="ml-2 text-green-600 dark:text-green-400">· No OT</span>
              }
            </div>
          )}

          {actualError && <p className="text-xs text-red-500">{actualError}</p>}

          <button
            onClick={handleLogActual}
            disabled={savingActual || !actualStart || !actualEnd}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white font-semibold text-sm rounded-xl transition cursor-pointer"
          >
            {savingActual ? 'Saving…' : 'Log Hours'}
          </button>

          {/* Clear saved hours — only when actual hours exist on the record, so
              a consolidated/mis-logged shift can be reset to "no actual hours".
              Two-step confirm so it can't be hit accidentally. */}
          {shift.actualStartTime && (confirmClear ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 space-y-2">
              <p className="text-xs text-red-700 dark:text-red-400">Clear saved actual hours?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmClear(false)}
                  className="flex-1 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-xs font-medium rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearActual}
                  disabled={savingActual}
                  className="flex-1 py-1.5 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer transition"
                >
                  {savingActual ? 'Clearing…' : 'Clear hours'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="w-full py-2 text-xs font-medium text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 transition cursor-pointer"
            >
              Clear saved hours
            </button>
          ))}
        </div>
      )}
    </>
  );
}
