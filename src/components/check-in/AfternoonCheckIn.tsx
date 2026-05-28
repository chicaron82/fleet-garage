import { useState } from 'react';
import { useGarage } from '../../context/GarageContext';
import { hapticLight, hapticMedium } from '../../lib/haptics';
import { convertToBackendFormat, convertFromBackend, carsFromPageCounter } from '../../lib/gas-sheet';
import { localDateStr } from '../../hooks/useFleetBalance';

const STEP_BTN = 'w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-700 text-lg font-semibold text-gray-600 dark:text-gray-400 hover:border-yellow-400 hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer flex items-center justify-center';
const STEP_VAL = 'text-xl font-bold text-gray-900 dark:text-gray-100 w-6 text-center tabular-nums';

export function AfternoonCheckIn() {
  const { getTodayCheckpoint, submitCheckpoint, handoffNotes } = useGarage();

  const existing = getTodayCheckpoint();

  const initPages = existing ? convertFromBackend(existing.fullPages, existing.lastPageEntries) : { totalPages: 0, entriesOnCurrentPage: 0 };
  const [totalPages,           setTotalPages]           = useState(initPages.totalPages);
  const [entriesOnCurrentPage, setEntriesOnCurrentPage] = useState(initPages.entriesOnCurrentPage);
  const [submitting,           setSubmitting]           = useState(false);
  const [collapsed,            setCollapsed]            = useState(!!existing);

  const carsIn    = carsFromPageCounter(totalPages, entriesOnCurrentPage);
  const canSubmit = !submitting && carsIn > 0;

  const todayHandoff = handoffNotes.find(n =>
    new Date(n.loggedAt).toLocaleDateString('en-CA') === localDateStr(0)
  ) ?? null;

  const checkpointCount = existing ? existing.fullPages * 19 + existing.lastPageEntries : null;
  const morningCleaned  = todayHandoff ? todayHandoff.fullPages * 19 + todayHandoff.lastPageEntries : null;
  const overlapCars     = morningCleaned != null && checkpointCount != null
    ? Math.max(0, morningCleaned - checkpointCount)
    : null;

  const handleEntryIncrement = () => {
    if (entriesOnCurrentPage === 19) { setTotalPages(p => p + 1); setEntriesOnCurrentPage(0); hapticMedium(); }
    else { setEntriesOnCurrentPage(e => e + 1); hapticLight(); }
  };
  const handleEntryDecrement = () => {
    if (entriesOnCurrentPage === 0 && totalPages > 0) { setTotalPages(p => p - 1); setEntriesOnCurrentPage(19); hapticMedium(); }
    else if (entriesOnCurrentPage > 0) { setEntriesOnCurrentPage(e => e - 1); hapticLight(); }
  };
  const handlePageIncrement = () => { setTotalPages(p => p + 1); setEntriesOnCurrentPage(19); hapticLight(); };
  const handlePageDecrement = () => { setTotalPages(p => Math.max(0, p - 1)); hapticLight(); };

  const handleEdit = () => {
    hapticLight();
    if (existing) {
      const { totalPages: tp, entriesOnCurrentPage: ep } = convertFromBackend(existing.fullPages, existing.lastPageEntries);
      setTotalPages(tp);
      setEntriesOnCurrentPage(ep);
    }
    setCollapsed(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const { fullPages, lastPageEntries } = convertToBackendFormat(totalPages, entriesOnCurrentPage);
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
                🤝 {overlapCars} cars cleaned with morning crew
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
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Afternoon Check-In</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          Log the current gas sheet count to start your shift numbers.
        </p>
      </div>

      <div className="p-4 space-y-5">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Gas Sheet Count — On Arrival</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 dark:text-gray-500 mb-2 block">Pages</label>
              <div className="flex items-center gap-3">
                <button type="button" onClick={handlePageDecrement} className={STEP_BTN}>−</button>
                <span className={STEP_VAL}>{totalPages}</span>
                <button type="button" onClick={handlePageIncrement} className={STEP_BTN}>+</button>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 dark:text-gray-500 mb-2 block">
                {totalPages > 0 ? `Entries on page ${totalPages}` : 'Entries'}
              </label>
              <div className="flex items-center gap-3">
                <button type="button" onClick={handleEntryDecrement} className={STEP_BTN}>−</button>
                <span className={STEP_VAL}>{entriesOnCurrentPage}</span>
                <button type="button" onClick={handleEntryIncrement} className={STEP_BTN}>+</button>
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
