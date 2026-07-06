import { useState } from 'react';
import { useSchedule } from '../../context/ScheduleContext';
import { getStatName } from '../../lib/stats';
import { fmtHours } from '../../lib/ot';
import type { ShiftWithUser } from '../../types';
import type { ActualHours } from '../../hooks/useActualHours';

interface Props {
  shift: ShiftWithUser;
  /** Actual-hours state, owned by the parent sheet's useActualHours so one Save writes it. */
  actual: ActualHours;
  onClose: () => void;
}

/**
 * The "actual hours" section of the shift sheet: the real clock-in/out fields
 * (pre-filled from the scheduled preset by useActualHours), the live OT preview,
 * and a clear-back-to-null action. No Save button of its own — the sheet's single
 * Save logs these together with the scheduled block. Rendered only for a shift on
 * or before today (a future shift can't have been worked yet); the parent gates it.
 */
export function ShiftActualHours({ shift, actual, onClose }: Props) {
  const { logActualHours } = useSchedule();
  const { actualStart, actualEnd, isStat, setActualStart, setActualEnd, setIsStat, netHrs, previewOT, breakDeducted } = actual;

  const [clearing,     setClearing]     = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const statName = getStatName(shift.date);

  // Clear saved actual hours back to null — for a shift you didn't actually work,
  // or a mis-log. Routes around the "log as scheduled" default by writing empty
  // strings (logActualHours writes null for either empty value). Only offered when
  // hours are actually saved. Two-step confirm so it can't be hit accidentally.
  const handleClearActual = async () => {
    setClearing(true);
    try {
      await logActualHours(shift.id, '', '', false);
      onClose();
    } catch {
      setClearing(false);
    }
  };

  return (
    <>
      {/* Divider */}
      <div className="border-t border-gray-100 dark:border-gray-800" />

      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Actual Hours</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start</label>
            <input
              type="time"
              value={actualStart}
              onChange={e => setActualStart(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-fg-yellow focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End</label>
            <input
              type="time"
              value={actualEnd}
              onChange={e => setActualEnd(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-fg-yellow focus:border-transparent transition"
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

        {/* Clear saved hours — only when actual hours exist on the record, so a
            consolidated/mis-logged shift can be reset to "no actual hours". */}
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
                disabled={clearing}
                className="flex-1 py-1.5 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer transition"
              >
                {clearing ? 'Clearing…' : 'Clear hours'}
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
    </>
  );
}
