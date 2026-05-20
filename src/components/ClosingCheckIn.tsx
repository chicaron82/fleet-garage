import { useState } from 'react';
import { useGarage } from '../context/GarageContext';
import { hapticLight } from '../lib/haptics';
import { localDateStr } from '../hooks/useFleetBalance';

const STEP_BTN = 'w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-700 text-lg font-semibold text-gray-600 dark:text-gray-400 hover:border-yellow-400 hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer flex items-center justify-center';
const STEP_VAL = 'text-xl font-bold text-gray-900 dark:text-gray-100 w-6 text-center tabular-nums';

export function ClosingCheckIn() {
  const { getTodayCheckpoint, submitCheckpoint, handoffNotes } = useGarage();

  const existing = getTodayCheckpoint();

  const [fullPages,       setFullPages]       = useState(existing?.fullPages       ?? 0);
  const [lastPageEntries, setLastPageEntries] = useState(existing?.lastPageEntries ?? 0);
  const [submitting,      setSubmitting]      = useState(false);
  const [collapsed,       setCollapsed]       = useState(!!existing);

  const carsIn    = fullPages * 19 + lastPageEntries;
  const canSubmit = !submitting && carsIn > 0;

  const todayHandoff = handoffNotes.find(n =>
    new Date(n.loggedAt).toLocaleDateString('en-CA') === localDateStr(0)
  ) ?? null;

  const checkpointCount = existing ? existing.fullPages * 19 + existing.lastPageEntries : null;
  const morningCleaned  = todayHandoff ? todayHandoff.fullPages * 19 + todayHandoff.lastPageEntries : null;
  const overlapCars     = morningCleaned != null && checkpointCount != null
    ? Math.max(0, morningCleaned - checkpointCount)
    : null;

  const handleEdit = () => {
    hapticLight();
    if (existing) {
      setFullPages(existing.fullPages);
      setLastPageEntries(existing.lastPageEntries);
    }
    setCollapsed(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const ok = await submitCheckpoint(fullPages, lastPageEntries);
    if (ok) setCollapsed(true);
    else setSubmitting(false);
  };

  if (collapsed && existing) {
    const count = existing.fullPages * 19 + existing.lastPageEntries;
    return (
      <button
        type="button"
        onClick={handleEdit}
        className="w-full rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-left transition-colors hover:bg-green-100 dark:hover:bg-green-900/30 cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-green-800 dark:text-green-300">
              ✅ Checked in · Page {existing.fullPages} + {existing.lastPageEntries} = {count} cars
            </p>
            {overlapCars != null && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                🤝 {overlapCars} cars cleaned together (13:30–15:15)
              </p>
            )}
          </div>
          <span className="text-xs text-green-500 dark:text-green-500 ml-3 shrink-0">Edit →</span>
        </div>
      </button>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Closing Check-In</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          Log the current gas sheet count to start your shift numbers.
        </p>
      </div>

      <div className="p-4 space-y-5">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Gas Sheet Count — On Arrival</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 dark:text-gray-500 mb-2 block">Full pages</label>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setFullPages(v => Math.max(0, v - 1))} className={STEP_BTN}>−</button>
                <span className={STEP_VAL}>{fullPages}</span>
                <button type="button" onClick={() => setFullPages(v => v + 1)} className={STEP_BTN}>+</button>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 dark:text-gray-500 mb-2 block">Last page entries</label>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setLastPageEntries(v => Math.max(0, v - 1))} className={STEP_BTN}>−</button>
                <span className={STEP_VAL}>{lastPageEntries}</span>
                <button type="button" onClick={() => setLastPageEntries(v => Math.min(19, v + 1))} className={STEP_BTN}>+</button>
              </div>
            </div>
          </div>
          {carsIn > 0 && (
            <p className="text-xs text-green-600 dark:text-green-400 font-semibold mt-2">= {carsIn} cars on arrival ✓</p>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition cursor-pointer ${
            canSubmit
              ? 'bg-yellow-400 hover:bg-yellow-500 text-gray-900'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
          }`}
        >
          {submitting ? 'Checking in…' : existing ? 'Update Check-In' : 'Check In'}
        </button>
      </div>
    </div>
  );
}
