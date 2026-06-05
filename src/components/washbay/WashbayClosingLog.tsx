import { useState } from 'react';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useWashbayContext } from '../../context/WashbayContext';
import { useAuth } from '../../context/AuthContext';
import { useSchedule } from '../../context/ScheduleContext';
import { hapticLight, hapticMedium } from '../../lib/haptics';
import { convertToBackendFormat, convertFromBackend, carsFromPageCounter } from '../../lib/gas-sheet';
import { sentToFleetFromCount } from '../../lib/washbay-throughput';
import { localDateStr } from '../../hooks/useFleetBalance';
import { businessDateOf } from '../../lib/shiftDay';
import { ClosingLogSummary } from './ClosingLogSummary';
import { LOT_STATUS_OPTIONS } from './lotStatusOptions';
import type { LotStatus } from '../../types';

const COMPANY_STANDARD = 3.0;
const SHIFT_HOURS = 8;

export function WashbayClosingLog() {
  const { holds } = useVehicleHoldContext();
  const { submitWashbayLog, getTodayWashbayLog, getLatestGasSheetReading } = useWashbayContext();
  const { user } = useAuth();
  const { isPeakSeason } = useSchedule();

  // A fresh closing log picks up from the furthest-along reading today (the
  // handoff) rather than recounting the running gas sheet from zero.
  const seed = getLatestGasSheetReading();
  const seedInit = seed ? convertFromBackend(seed.fullPages, seed.lastPageEntries) : { totalPages: 0, entriesOnCurrentPage: 0 };

  const [totalPages,           setTotalPages]           = useState(seedInit.totalPages);
  const [entriesOnCurrentPage, setEntriesOnCurrentPage] = useState(seedInit.entriesOnCurrentPage);
  const [carsRemaining,    setCarsRemaining]    = useState('');
  const [cleanNotPickedUp, setCleanNotPickedUp] = useState('');
  const [nonRentables,     setNonRentables]     = useState('');
  const [deferred,         setDeferred]         = useState('');
  const [nonRentablesNote, setNonRentablesNote] = useState('');
  const [teamSize,         setTeamSize]         = useState(3);
  const [overtimeHours,    setOvertimeHours]    = useState(0);
  const [lotStatus,        setLotStatus]        = useState<LotStatus>('manageable');
  const [submitting,       setSubmitting]       = useState(false);
  const [editing,          setEditing]          = useState(false);
  const [overtimeOpen,     setOvertimeOpen]     = useState(false);

  const todayLog    = getTodayWashbayLog();
  const showSummary = !!todayLog && !editing;

  const baseHours = isPeakSeason ? 16 : 15;

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

  // Pre-fill form when entering edit mode
  const enterEditMode = () => {
    if (todayLog) {
      const { totalPages: tp, entriesOnCurrentPage: ep } = convertFromBackend(todayLog.fullPages, todayLog.lastPageEntries);
      setTotalPages(tp);
      setEntriesOnCurrentPage(ep);
      setCarsRemaining(String(todayLog.carsRemaining));
      setCleanNotPickedUp(String(todayLog.cleanNotPickedUp));
      setNonRentables(todayLog.nonRentablesFuelled ? String(todayLog.nonRentablesFuelled) : '');
      setDeferred(todayLog.deferredCompletions ? String(todayLog.deferredCompletions) : '');
      setNonRentablesNote(todayLog.nonRentablesNote ?? '');
      setTeamSize(todayLog.teamSize);
      setOvertimeHours(todayLog.overtimeHours);
      setLotStatus(todayLog.lotStatus);
    }
    setEditing(true);
  };

  const cr   = parseInt(carsRemaining)    || 0;
  const cnpu = parseInt(cleanNotPickedUp) || 0;
  const nrf  = parseInt(nonRentables)     || 0;
  const dc   = parseInt(deferred)         || 0;
  const carsIn      = carsFromPageCounter(totalPages, entriesOnCurrentPage);
  const carsCleaned = sentToFleetFromCount(carsIn, cr, nrf, dc);
  const operatingHours = baseHours + overtimeHours;
  const throughput  = operatingHours > 0 ? carsCleaned / operatingHours : 0;
  const delta       = throughput - COMPANY_STANDARD;

  const heldToday          = holds.filter(h => h.status === 'ACTIVE' && businessDateOf(h.flaggedAt) === localDateStr(0)).length;
  const rentablesProcessed = Math.max(0, carsIn - heldToday);
  const deliveredToAirport = Math.max(0, rentablesProcessed - cnpu);

  const canSubmit = !submitting && carsIn > 0 && teamSize > 0 && user;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const { fullPages, lastPageEntries } = convertToBackendFormat(totalPages, entriesOnCurrentPage);
    await submitWashbayLog({ fullPages, lastPageEntries, carsRemaining: cr, cleanNotPickedUp: cnpu, nonRentablesFuelled: nrf, deferredCompletions: dc, nonRentablesNote: nonRentablesNote.trim() || null, teamSize, shiftHours: SHIFT_HOURS, overtimeHours, lotStatus });
    setEditing(false);
    setSubmitting(false);
  };

  // ── Summary view (after submit) ──────────────────────────────────────────

  if (showSummary && todayLog) {
    return (
      <ClosingLogSummary
        log={todayLog}
        baseHours={baseHours}
        isPeakSeason={isPeakSeason}
        heldToday={heldToday}
        onEdit={enterEditMode}
      />
    );
  }

  // ── Input form ───────────────────────────────────────────────────────────

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Closing Duties · Washbay Log</p>
      </div>
      <div className="p-4 space-y-4">

        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Gas Sheet Pages</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 dark:text-gray-500 mb-2 block">Pages</label>
              <div className="flex items-center gap-3">
                <button type="button" onClick={handlePageDecrement}
                  className="w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-700 text-lg font-semibold text-gray-600 dark:text-gray-400 hover:border-yellow-400 hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer flex items-center justify-center">−</button>
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100 w-6 text-center tabular-nums">{totalPages}</span>
                <button type="button" onClick={handlePageIncrement}
                  className="w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-700 text-lg font-semibold text-gray-600 dark:text-gray-400 hover:border-yellow-400 hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer flex items-center justify-center">+</button>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 dark:text-gray-500 mb-2 block">
                {totalPages > 0 ? `Entries on page ${totalPages}` : 'Entries'}
              </label>
              <div className="flex items-center gap-3">
                <button type="button" onClick={handleEntryDecrement}
                  className="w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-700 text-lg font-semibold text-gray-600 dark:text-gray-400 hover:border-yellow-400 hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer flex items-center justify-center">−</button>
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100 w-6 text-center tabular-nums">{entriesOnCurrentPage}</span>
                <button type="button" onClick={handleEntryIncrement}
                  className="w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-700 text-lg font-semibold text-gray-600 dark:text-gray-400 hover:border-yellow-400 hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer flex items-center justify-center">+</button>
              </div>
            </div>
          </div>
          {carsIn > 0 && (
            <p className="text-xs text-green-600 dark:text-green-400 font-semibold mt-2">= {carsIn} cars in ✓</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">In queue at close</label>
            <input
              type="number" min="0" value={carsRemaining} onChange={e => setCarsRemaining(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Clean, not picked up</label>
            <input
              type="number" min="0" value={cleanNotPickedUp} onChange={e => setCleanNotPickedUp(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
            />
          </div>
        </div>

        {/* Sent-to-fleet adjustments: parked non-rentables (subtract) + deferred plate-installs (add) */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Prepped, not sent</label>
            <input
              type="number" min="0" value={nonRentables} onChange={e => setNonRentables(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
            />
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Fuelled, parked — damage-held or no plates yet</p>
          </div>
          <div>
            <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Carry-over cleared</label>
            <input
              type="number" min="0" value={deferred} onChange={e => setDeferred(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
            />
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Fuelled earlier, finished &amp; sent today</p>
          </div>
        </div>

        {nrf > 0 && (
          <input
            type="text" value={nonRentablesNote} onChange={e => setNonRentablesNote(e.target.value)}
            placeholder="Why parked? (e.g. awaiting plates, hubcap damage)"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
          />
        )}

        <div>
          <label className="text-xs text-gray-400 dark:text-gray-500 mb-2 block">Team size</label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setTeamSize(t => Math.max(1, t - 1))}
              className="w-11 h-11 rounded-lg border border-gray-300 dark:border-gray-700 text-xl font-semibold text-gray-600 dark:text-gray-400 hover:border-yellow-400 hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer flex items-center justify-center"
            >
              −
            </button>
            <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 w-8 text-center tabular-nums">
              {teamSize}
            </span>
            <button
              type="button"
              onClick={() => setTeamSize(t => t + 1)}
              className="w-11 h-11 rounded-lg border border-gray-300 dark:border-gray-700 text-xl font-semibold text-gray-600 dark:text-gray-400 hover:border-yellow-400 hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>

        {/* Lot status */}
        <div>
          <label className="text-xs text-gray-400 dark:text-gray-500 mb-2 block">Lot status at close</label>
          <div className="flex gap-2">
            {LOT_STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setLotStatus(opt.value); hapticLight(); }}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  lotStatus === opt.value ? opt.color : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Overtime hours — collapsed by default */}
        <div>
          <button
            type="button"
            onClick={() => setOvertimeOpen(o => !o)}
            className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer"
          >
            <span>{overtimeOpen ? '▴' : '▾'}</span>
            <span>Overtime hours <span className="font-normal">(if applicable)</span></span>
            {overtimeHours > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                +{overtimeHours}h
              </span>
            )}
          </button>
          {overtimeOpen && (
            <div className="mt-2 space-y-1.5">
              <div className="flex gap-2">
                {[0, 1, 2, 3].map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setOvertimeHours(h)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      overtimeHours === h
                        ? 'bg-yellow-400 dark:bg-yellow-500 border-yellow-400 dark:border-yellow-500 text-gray-900'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    {h === 0 ? '0' : `+${h}h`}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                Base: {baseHours}h{isPeakSeason ? ' (peak)' : ''} + {overtimeHours}h = {operatingHours}h operating window
              </p>
            </div>
          )}
        </div>

        {carsIn > 0 && (
          <div className={`rounded-lg px-4 py-3 ${delta >= 0 ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50' : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700'}`}>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {carsCleaned} cars cleaned · {throughput.toFixed(1)}/hr
            </p>
            <p className={`text-xs mt-0.5 ${delta >= 0 ? 'text-green-600 dark:text-green-500' : 'text-gray-500 dark:text-gray-400'}`}>
              vs {COMPANY_STANDARD.toFixed(1)} standard · {delta >= 0 ? `+${delta.toFixed(1)} above ✅` : `${delta.toFixed(1)} below`}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Pipeline: {carsIn} in → −{heldToday} held → {rentablesProcessed} rentable → {deliveredToAirport} delivered
            </p>
          </div>
        )}

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
          {submitting ? 'Submitting…' : 'Submit Closing Log'}
        </button>
      </div>
    </div>
  );
}
