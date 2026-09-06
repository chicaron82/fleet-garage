import { useState } from 'react';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useWashbayContext } from '../../context/WashbayContext';
import { useAuth } from '../../context/AuthContext';
import { useSchedule } from '../../context/ScheduleContext';
import { convertToBackendFormat, convertFromBackend, carsFromPageCounter, hasGasSheetData } from '../../lib/gas-sheet';
import { sentToFleetFromCount } from '../../lib/washbay-throughput';
import { localDateStr } from '../../hooks/useFleetBalance';
import { useTodayAirportFlip } from '../../hooks/useTodayAirportFlip';
import { priorFlippingAttested } from '../../lib/airportFlipping';
import { businessDateOf, shiftDateStr } from '../../lib/shiftDay';
import { seedClosingCounts } from '../../lib/closingInventory';
import { loadSession } from '../../lib/closingInventoryStore';
import { rosteredVsaCount, presentVsaCount } from '../../lib/rosterCount';
import { ClosingLogSummary } from './ClosingLogSummary';
import { GasSheetPageCounter } from './GasSheetPageCounter';
import { lotStatusFromQueue } from '../../lib/closingQueue';
import { ShiftLogPhotoField } from './ShiftLogPhotoField';

const COMPANY_STANDARD = 3.0;
const SHIFT_HOURS = 8;

export function WashbayClosingLog() {
  const { holds } = useVehicleHoldContext();
  const { submitWashbayLog, getTodayWashbayLog, getLatestGasSheetReading, handoffNotes } = useWashbayContext();
  const { user } = useAuth();
  const { isPeakSeason, shifts } = useSchedule();

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
  /**
   * ⭐⭐ SEEDED FROM TONIGHT'S CLOSING INVENTORY — the two counts are the same two counts.
   *
   * Aaron, 2026-09-05, dry-running the scanner in the lot: *"now it's all scanned then the cleans
   * and dirty should be filled out here automatically right?"* They should, and he had to spell out
   * why, because the field names hide it: *"rentable on the lot that have been cleaned but not sent
   * to the airport / dirties are returns from the airport that are now at Erin St. this is what the
   * morning crew will be cleaning."* So the sheet's **A** is `cleanNotPickedUp` — "not picked up"
   * has always meant *not yet sent up*, never *a customer didn't collect it* — and the sheet's **D**
   * is the queue the morning inherits. B and M belong to neither; a held car is not washbay work.
   *
   * ⚠️ AN EMPTY SHEET SEEDS NOTHING, not zero. No write-up is "I didn't count", and a seeded 0 would
   * put a claim of an empty lot into the throughput history and into tomorrow's opening card.
   *
   * Same `null = untouched` shape as the pages and team size above, for the same reason: the sheet
   * can finish loading after this mounts, and a copied-once value would freeze whatever was there.
   */
  const sheetEntries = loadSession(businessDateOf(new Date())).entries;
  const seeded = seedClosingCounts(sheetEntries);
  const [userCarsRemaining,    setUserCarsRemaining]    = useState<string | null>(null);
  const [userCleanNotPickedUp, setUserCleanNotPickedUp] = useState<string | null>(null);
  const carsRemaining    = userCarsRemaining    ?? seeded.queueAtClose;
  const cleanNotPickedUp = userCleanNotPickedUp ?? seeded.cleanNotSent;
  // Default team size from the rostered closing crew (read live until the user
  // touches it, so an async roster load can't freeze a stale default). The floor
  // truth still wins — it stays editable and the roster mismatch is flagged.
  const rosteredTeam = rosteredVsaCount(shifts, shiftDateStr(0), ['closing']);
  const presentTeam  = presentVsaCount(shifts, shiftDateStr(0), ['closing']);
  const [userTeamSize, setUserTeamSize] = useState<number | null>(null);
  // Default = who actually showed (roster minus no-shows); label still shows roster.
  const teamSize = userTeamSize ?? (presentTeam || 2);
  const [overtimeHours,    setOvertimeHours]    = useState(0);
  const [photo,            setPhoto]            = useState<string | null>(null);
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
      setUserCarsRemaining(String(todayLog.carsRemaining));
      setUserCleanNotPickedUp(String(todayLog.cleanNotPickedUp));
      setUserTeamSize(todayLog.teamSize);
      setOvertimeHours(todayLog.overtimeHours);
      setFlippingTouched(todayLog.airportFlipping);
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
  // Manual "flipping done today" attestation — covers turnarounds run by people who
  // don't use FG (a closing partner, roster-only morning crew), which the OTH signal
  // above can't see. Pre-checks if the morning handoff or an earlier log today
  // already flagged it (null until touched, so an async context load can't freeze a
  // stale default).
  const flippingKnown      = airportFlipping || priorFlippingAttested(handoffNotes, todayLog, localDateStr(0));
  const [flippingTouched, setFlippingTouched] = useState<boolean | null>(null);
  const flippingDone       = flippingTouched ?? flippingKnown;
  const heldToday          = holds.filter(h => h.status === 'ACTIVE' && businessDateOf(h.flaggedAt) === localDateStr(0)).length;
  const rentablesProcessed = Math.max(0, carsIn - heldToday);
  const deliveredToAirport = Math.max(0, rentablesProcessed - cnpu);

  const canSubmit = !submitting && carsIn > 0 && teamSize > 0 && user;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const { fullPages, lastPageEntries } = convertToBackendFormat(totalPages, entriesOnCurrentPage);
    await submitWashbayLog({ fullPages, lastPageEntries, carsRemaining: cr, cleanNotPickedUp: cnpu, nonRentablesFuelled: 0, deferredCompletions: 0, nonRentablesNote: null, carryOver: 0, teamSize, shiftHours: SHIFT_HOURS, overtimeHours, lotStatus: lotStatusFromQueue(cr), airportFlipping: flippingDone }, undefined, photo);
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
        airportFlipping={airportFlipping || (todayLog?.airportFlipping ?? false)}
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

        {/* ⭐ SHOWS ITS WORK, the same posture as "roster shows 2 (logging 1)" — the numbers are
            seeded, never asserted, so a half-finished sweep is visible rather than silently
            authoritative. Only ever appears when there IS a sheet to have come from. */}
        {sheetEntries.length > 0 && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            📋 From tonight&apos;s closing inventory —{' '}
            <span className="tabular-nums">{sheetEntries.length}</span> written up
            {(userCarsRemaining !== null || userCleanNotPickedUp !== null) && ' · edited'}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">In queue at close</label>
            <input
              type="number" min="0" value={carsRemaining} onChange={e => setUserCarsRemaining(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">Clean, not picked up</label>
            <input
              type="number" min="0" value={cleanNotPickedUp} onChange={e => setUserCleanNotPickedUp(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 dark:text-gray-500 mb-2 block">
            Team size
            {rosteredTeam > 0 && (
              <span className={`ml-2 font-normal ${teamSize !== rosteredTeam ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}>
                · roster shows {rosteredTeam}{teamSize !== rosteredTeam ? ` (logging ${teamSize})` : ''}
              </span>
            )}
          </label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setUserTeamSize(Math.max(1, teamSize - 1))}
              className="w-11 h-11 rounded-lg border border-gray-300 dark:border-gray-700 text-xl font-semibold text-gray-600 dark:text-gray-400 hover:border-fg-yellow hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer flex items-center justify-center"
            >
              −
            </button>
            <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 w-8 text-center tabular-nums">
              {teamSize}
            </span>
            <button
              type="button"
              onClick={() => setUserTeamSize(teamSize + 1)}
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

        {/* Airport flipping attestation — a low bay count is expected when cars were
            turned around at the airport instead of washed; record it so the report
            reads light-for-a-reason, even if the flipper doesn't use FG. */}
        <label className="flex items-center gap-2 cursor-pointer">
          <div
            onClick={() => setFlippingTouched(!flippingDone)}
            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${flippingDone ? 'bg-fg-yellow border-fg-yellow' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'}`}
          >
            {flippingDone && <span className="text-[10px] font-bold text-black leading-none">✓</span>}
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">🔄 Quick turnarounds done at the airport today</span>
        </label>

        {/* The board at close. This log's lot status is DERIVED (lotStatusFromQueue(cr)) rather
            than picked, which makes the photo more useful here, not less: it's the only record of
            what the derived word was standing on. An already-saved photo shows through when
            re-opening the same day's close. */}
        <ShiftLogPhotoField value={photo} onChange={setPhoto} existingUrl={todayLog?.photoUrl} />

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
