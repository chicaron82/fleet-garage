import { useState } from 'react';
import { useWashbayContext } from '../../context/WashbayContext';
import { hapticLight, hapticMedium } from '../../lib/haptics';
import { convertToBackendFormat, convertFromBackend, carsFromPageCounter, gasSheetCount } from '../../lib/gas-sheet';
import { shiftDateStr } from '../../lib/shiftDay';
import { findPriorShiftLog } from '../../lib/washbayLineage';
import type { LotStatus } from '../../types';

interface Props {
  onClose: () => void;
}

const LOT_STATUS_OPTIONS: { value: LotStatus; label: string; description: string; color: string }[] = [
  { value: 'zeroed',     label: 'Zeroed',     description: 'All cars accounted for, queue clear',          color: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' },
  { value: 'manageable', label: 'Manageable', description: 'Backlog present, incoming shift can handle',   color: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700' },
  { value: 'backlog',    label: 'Backlog',    description: 'Significant queue, needs immediate attention',  color: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700' },
];

const STEP_BTN = 'w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-700 text-lg font-semibold text-gray-600 dark:text-gray-400 hover:border-fg-yellow hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer flex items-center justify-center';
const STEP_VAL = 'text-xl font-bold text-gray-900 dark:text-gray-100 w-6 text-center tabular-nums';

export function HandoffForm({ onClose }: Props) {
  const { submitHandoff, submitWashbayLog, getLatestGasSheetReading, washbayLogs } = useWashbayContext();

  // The prior shift-day's close (cutover-aware), or undefined if nobody logged it.
  const priorLog = findPriorShiftLog(washbayLogs);

  // Pick up from the furthest-along reading logged today (the check-in) rather
  // than recounting the running gas sheet from zero.
  const seed = getLatestGasSheetReading();
  const seedInit = seed ? convertFromBackend(seed.fullPages, seed.lastPageEntries) : { totalPages: 0, entriesOnCurrentPage: 0 };

  const [totalPages,           setTotalPages]           = useState(seedInit.totalPages);
  const [entriesOnCurrentPage, setEntriesOnCurrentPage] = useState(seedInit.entriesOnCurrentPage);
  const [baselineCount] = useState(seed ? gasSheetCount(seed.fullPages, seed.lastPageEntries) : 0);
  const inheritedBacklog = priorLog?.carsRemaining ?? 0;

  const [teamSize,        setTeamSize]        = useState(2);
  const [lotStatus,       setLotStatus]       = useState<LotStatus>('manageable');
  const [notes,           setNotes]           = useState('');
  const [adjustMorning,    setAdjustMorning]   = useState(false);
  const [morningHours,     setMorningHours]    = useState(8.0);
  const [submitting,       setSubmitting]      = useState(false);

  // Backfill: when last night's close was never logged, the opener records how
  // many were left so they carry into the morning rate. Writes a real
  // washbay_logs row stamped to the prior shift-date (the lineage reads it back).
  const [backfillCount, setBackfillCount] = useState(0);
  const [backfilling,   setBackfilling]   = useState(false);

  const handleBackfillPriorClose = async () => {
    setBackfilling(true);
    const ok = await submitWashbayLog({
      fullPages: 0, lastPageEntries: 0, carsRemaining: backfillCount,
      cleanNotPickedUp: 0, nonRentablesFuelled: 0, deferredCompletions: 0,
      nonRentablesNote: null, carryOver: 0, teamSize: 1, shiftHours: 8,
      overtimeHours: 0, lotStatus: backfillCount > 0 ? 'manageable' : 'zeroed',
    }, shiftDateStr(-1));
    // On success the optimistic washbayLogs update makes findPriorShiftLog match,
    // so this panel gives way to the inherited-backlog line on the next render.
    if (!ok) setBackfilling(false);
  };

  const carsIn        = carsFromPageCounter(totalPages, entriesOnCurrentPage);
  const cleanedSince  = Math.max(0, carsIn - baselineCount);
  const canSubmit     = !submitting && carsIn > 0;

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

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const { fullPages, lastPageEntries } = convertToBackendFormat(totalPages, entriesOnCurrentPage);
    const ok = await submitHandoff({
      fullPages,
      lastPageEntries,
      teamSize,
      lotStatus,
      notes: notes.trim() || undefined,
      morningHours: adjustMorning ? morningHours : undefined,
      carryOverCleared: inheritedBacklog > 0 ? inheritedBacklog : undefined,
    });
    if (ok) onClose();
    else setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">

        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Log Shift Handoff</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-lg leading-none">×</button>
        </div>

        <div className="p-4 space-y-5 max-h-[75vh] overflow-y-auto">

          {/* Gas sheet pages */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              {baselineCount > 0 ? 'Gas Sheet Pages — Current Total' : 'Gas Sheet Pages — This Shift'}
            </p>
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
              <p className="text-xs text-green-600 dark:text-green-400 font-semibold mt-2">
                {baselineCount > 0
                  ? `= ${carsIn} on sheet · ${cleanedSince} cleaned since check-in ✓`
                  : `= ${carsIn} cars cleaned this shift ✓`}
              </p>
            )}
          </div>

          {/* Backfill last night's close — only when it was never logged */}
          {!priorLog && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 px-3 py-3 space-y-2.5">
              <div>
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">⚠ No closing log from last night</p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                  Record how many were left in the queue so they carry into your morning rate.
                </p>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-500 dark:text-gray-400">Cars left in queue</label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { setBackfillCount(n => Math.max(0, n - 1)); hapticLight(); }} className={STEP_BTN}>−</button>
                  <span className={STEP_VAL}>{backfillCount}</span>
                  <button type="button" onClick={() => { setBackfillCount(n => n + 1); hapticLight(); }} className={STEP_BTN}>+</button>
                </div>
              </div>
              <button
                type="button"
                onClick={handleBackfillPriorClose}
                disabled={backfilling}
                className="w-full py-2 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50 bg-amber-500 hover:bg-amber-400 text-white"
              >
                {backfilling ? 'Saving…' : "Save last night's close"}
              </button>
            </div>
          )}

          {/* Carry-over inherited from closing */}
          {inheritedBacklog > 0 && (
            <div>
              <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Carry-over inherited</label>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-3">
                Dirties left by last night's closing crew — credited to your morning rate.
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{inheritedBacklog}</span>
                <span className="text-sm text-gray-400 dark:text-gray-500">vehicle{inheritedBacklog !== 1 ? 's' : ''}</span>
              </div>
              <p className="text-[11px] text-blue-500 dark:text-blue-400 mt-1">Ported from last night's closing log</p>
            </div>
          )}

          {/* Team size */}
          <div>
            <label className="text-xs text-gray-400 dark:text-gray-500 mb-2 block">Team size</label>
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => setTeamSize(v => Math.max(1, v - 1))}
                className="w-11 h-11 rounded-lg border border-gray-300 dark:border-gray-700 text-xl font-semibold text-gray-600 dark:text-gray-400 hover:border-fg-yellow hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer flex items-center justify-center">−</button>
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 w-8 text-center tabular-nums">{teamSize}</span>
              <button type="button" onClick={() => setTeamSize(v => v + 1)}
                className="w-11 h-11 rounded-lg border border-gray-300 dark:border-gray-700 text-xl font-semibold text-gray-600 dark:text-gray-400 hover:border-fg-yellow hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer flex items-center justify-center">+</button>
            </div>
          </div>

          {/* Lot status pills */}
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Lot Status</p>
            <div className="space-y-2">
              {LOT_STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLotStatus(opt.value)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm font-medium transition cursor-pointer ${
                    lotStatus === opt.value
                      ? opt.color
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <span className="font-semibold">{opt.label}</span>
                  <span className="text-xs ml-2 opacity-70">{opt.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Notes (optional)</label>
            <textarea
              rows={3} value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Anything the next shift needs to know…"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition resize-none"
            />
          </div>

          {/* AM window adjust */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setAdjustMorning(v => !v)}
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${adjustMorning ? 'bg-fg-yellow border-fg-yellow' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'}`}
              >
                {adjustMorning && <span className="text-[10px] font-bold text-black leading-none">✓</span>}
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Adjust AM window</span>
            </label>
            {adjustMorning && (
              <div className="mt-2.5 flex items-center gap-3">
                <button type="button" onClick={() => setMorningHours(v => Math.max(4, Math.round((v - 0.5) * 10) / 10))} className={STEP_BTN}>−</button>
                <span className="text-base font-bold text-gray-900 dark:text-gray-100 w-8 text-center tabular-nums">{morningHours}</span>
                <button type="button" onClick={() => setMorningHours(v => Math.min(12, Math.round((v + 0.5) * 10) / 10))} className={STEP_BTN}>+</button>
                <span className="text-xs text-gray-400 dark:text-gray-500">hrs productive  ·  partition: 15:15</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full py-3 rounded-xl text-sm font-semibold transition cursor-pointer ${
              canSubmit
                ? 'bg-fg-yellow hover:bg-fg-yellow-hi text-gray-900'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
            }`}
          >
            {submitting ? 'Logging…' : 'Log Handoff'}
          </button>
        </div>

      </div>
    </div>
  );
}
