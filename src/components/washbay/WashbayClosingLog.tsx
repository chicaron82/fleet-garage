import { useState } from 'react';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useWashbayContext } from '../../context/WashbayContext';
import { useAuth } from '../../context/AuthContext';
import { useSchedule } from '../../context/ScheduleContext';
import { convertToBackendFormat, convertFromBackend, carsFromPageCounter, hasGasSheetData } from '../../lib/gas-sheet';
import { sentToFleetFromCount } from '../../lib/washbay-throughput';
import { localDateStr } from '../../hooks/useFleetBalance';
import { useTodayAirportFlip } from '../../hooks/useTodayAirportFlip';
import { businessDateOf } from '../../lib/shiftDay';
import { ClosingLogSummary } from './ClosingLogSummary';
import { GasSheetPageCounter } from './GasSheetPageCounter';
import { lotStatusFromQueue } from '../../lib/closingQueue';

const COMPANY_STANDARD = 3.0;
const SHIFT_HOURS = 8;

export function WashbayClosingLog() {
  const { holds } = useVehicleHoldContext();
  const { submitWashbayLog, getTodayWashbayLog, getLatestGasSheetReading } = useWashbayContext();
  const { user } = useAuth();
  const { isPeakSeason } = useSchedule();

  // A fresh closing log picks up from the furthest-along reading today (the
  // handoff) rather than recounting the running gas sheet from zero.
  // null = user hasn't touched the field yet — reads live from the seed until then,
  // so async context load after mount doesn't freeze a stale zero.
  const seed      = getLatestGasSheetReading();
  const seedPages = seed
    ? convertFromBackend(seed.fullPages, seed.lastPageEntries)
    : { totalPages: 0, entriesOnCurrentPage: 0 };

  const [userPages,   setUserPages]   = useState<number | null>(null);
  const [userEntries, setUserEntries] = useState<number | null>(null);
  const totalPages           = userPages  ?? seedPages.totalPages;
  const entriesOnCurrentPage = userEntries ?? seedPages.entriesOnCurrentPage;
  const [carsRemaining,    setCarsRemaining]    = useState('');
  const [cleanNotPickedUp, setCleanNotPickedUp] = useState('');
  const [teamSize,         setTeamSize]         = useState(2);
  const [overtimeHours,    setOvertimeHours]    = useState(0);
  const [submitting,       setSubmitting]       = useState(false);
  const [editing,          setEditing]          = useState(false);
  const [overtimeOpen,     setOvertimeOpen]     = useState(false);

  const todayLog    = getTodayWashbayLog();
  // Only lock into summary when there's an actual finalized closing log (has gas-sheet
  // data). A backfill/placeholder row (fullPages=0, lastPageEntries=0) is not a close.
  const isRealClose = hasGasSheetData(todayLog);
  const showSummary = isRealClose && !editing;

  const baseHours = isPeakSeason ? 16 : 15;

  // Pre-fill form when entering edit mode
  const enterEditMode = () => {
    if (todayLog) {
      const { totalPages: tp, entriesOnCurrentPage: ep } = convertFromBackend(todayLog.fullPages, todayLog.lastPageEntries);
      setUserPages(tp);
      setUserEntries(ep);
      setCarsRemaining(String(todayLog.carsRemaining));
      setCleanNotPickedUp(String(todayLog.cleanNotPickedUp));
      setTeamSize(todayLog.teamSize);
      setOvertimeHours(todayLog.overtimeHours);
    }
    setEditing(true);
  };

  const cr   = parseInt(carsRemaining)    || 0;
  const cnpu = parseInt(cleanNotPickedUp) || 0;
  const carsIn      = carsFromPageCounter(totalPages, entriesOnCurrentPage);
  // Throughput counts every car the bay processed (cars in − still in queue).
  // Worked-on non-rentables (held/new) are no longer subtracted, and prior-day
  // completions are no longer added (the morning carry-over credit covers those).
  const carsCleaned = sentToFleetFromCount(carsIn, cr, 0, 0);
  const operatingHours = baseHours + overtimeHours;
  const throughput  = operatingHours > 0 ? carsCleaned / operatingHours : 0;
  const delta       = throughput - COMPANY_STANDARD;

  const airportFlipping    = useTodayAirportFlip(user?.id, localDateStr(0));
  const heldToday          = holds.filter(h => h.status === 'ACTIVE' && businessDateOf(h.flaggedAt) === localDateStr(0)).length;
  const rentablesProcessed = Math.max(0, carsIn - heldToday);
  const deliveredToAirport = Math.max(0, rentablesProcessed - cnpu);

  const canSubmit = !submitting && carsIn > 0 && teamSize > 0 && user;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const { fullPages, lastPageEntries } = convertToBackendFormat(totalPages, entriesOnCurrentPage);
    await submitWashbayLog({ fullPages, lastPageEntries, carsRemaining: cr, cleanNotPickedUp: cnpu, nonRentablesFuelled: 0, deferredCompletions: 0, nonRentablesNote: null, carryOver: 0, teamSize, shiftHours: SHIFT_HOURS, overtimeHours, lotStatus: lotStatusFromQueue(cr) });
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
        airportFlipping={airportFlipping}
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

        <GasSheetPageCounter
          totalPages={totalPages}
          entriesOnCurrentPage={entriesOnCurrentPage}
          onChange={(tp, ep) => { setUserPages(tp); setUserEntries(ep); }}
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">In queue at close</label>
            <input
              type="number" min="0" value={carsRemaining} onChange={e => setCarsRemaining(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Clean, not picked up</label>
            <input
              type="number" min="0" value={cleanNotPickedUp} onChange={e => setCleanNotPickedUp(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 dark:text-gray-500 mb-2 block">Team size</label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setTeamSize(t => Math.max(1, t - 1))}
              className="w-11 h-11 rounded-lg border border-gray-300 dark:border-gray-700 text-xl font-semibold text-gray-600 dark:text-gray-400 hover:border-fg-yellow hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer flex items-center justify-center"
            >
              −
            </button>
            <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 w-8 text-center tabular-nums">
              {teamSize}
            </span>
            <button
              type="button"
              onClick={() => setTeamSize(t => t + 1)}
              className="w-11 h-11 rounded-lg border border-gray-300 dark:border-gray-700 text-xl font-semibold text-gray-600 dark:text-gray-400 hover:border-fg-yellow hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer flex items-center justify-center"
            >
              +
            </button>
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
                        ? 'bg-fg-yellow border-fg-yellow text-gray-900'
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
              ? 'bg-fg-yellow hover:bg-fg-yellow-hi text-gray-900'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
          }`}
        >
          {submitting ? 'Submitting…' : 'Submit Closing Log'}
        </button>
      </div>
    </div>
  );
}
