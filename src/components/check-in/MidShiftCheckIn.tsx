import { useState } from 'react';
import { useWashbayContext } from '../../context/WashbayContext';
import { hapticLight, hapticMedium } from '../../lib/haptics';
import { convertToBackendFormat, convertFromBackend, carsFromPageCounter } from '../../lib/gas-sheet';
import { localDateStr } from '../../hooks/useFleetBalance';
import { businessDateOf } from '../../lib/shiftDay';

const STEP_BTN = 'w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-700 text-lg font-semibold text-gray-600 dark:text-gray-400 hover:border-fg-yellow hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer flex items-center justify-center';
const STEP_VAL = 'text-xl font-bold text-gray-900 dark:text-gray-100 w-6 text-center tabular-nums';
const STEP_BTN_DISABLED = 'w-9 h-9 rounded-lg border border-gray-200 dark:border-gray-800 text-lg font-semibold text-gray-300 dark:text-gray-700 flex items-center justify-center cursor-not-allowed';

// ── PageCounter ────────────────────────────────────────────────────────────────

function PageCounter({
  totalPages, entriesOnCurrentPage,
  onPageDec, onPageInc, onEntryDec, onEntryInc,
  disabled,
}: {
  totalPages: number; entriesOnCurrentPage: number;
  onPageDec: () => void; onPageInc: () => void;
  onEntryDec: () => void; onEntryInc: () => void;
  disabled?: boolean;
}) {
  const carsIn = carsFromPageCounter(totalPages, entriesOnCurrentPage);
  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-400 dark:text-gray-500 mb-2 block">Pages</label>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onPageDec} disabled={disabled} className={disabled ? STEP_BTN_DISABLED : STEP_BTN}>−</button>
            <span className={STEP_VAL}>{totalPages}</span>
            <button type="button" onClick={onPageInc} disabled={disabled} className={disabled ? STEP_BTN_DISABLED : STEP_BTN}>+</button>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 dark:text-gray-500 mb-2 block">
            {totalPages > 0 ? `Entries on page ${totalPages}` : 'Entries'}
          </label>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onEntryDec} disabled={disabled} className={disabled ? STEP_BTN_DISABLED : STEP_BTN}>−</button>
            <span className={STEP_VAL}>{entriesOnCurrentPage}</span>
            <button type="button" onClick={onEntryInc} disabled={disabled} className={disabled ? STEP_BTN_DISABLED : STEP_BTN}>+</button>
          </div>
        </div>
      </div>
      {carsIn > 0 && !disabled && (
        <p className="text-xs text-green-600 dark:text-green-400 font-semibold mt-2">= {carsIn} cars ✓</p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MidShiftCheckIn() {
  const { getMidArrival, getMidDeparture, submitMidCheckpoint, handoffNotes, getLatestGasSheetReading } = useWashbayContext();

  const existingArrival   = getMidArrival();
  const existingDeparture = getMidDeparture();

  // Pick up from where the running gas sheet already stands. BOTH mid checkpoints seed from the
  // FURTHEST-ALONG reading of the day (getLatestGasSheetReading — the shared max pool that the
  // afternoon check-in, handoff, and closing log all already use), so a mid pick-up chains like the
  // rest of the app. Departure used to seed only from the arrival count, which ignored a handoff
  // logged DURING the mid window: arrival page 3/2 (40) + a 15:15 handoff page 4/7 (64) meant the
  // 7pm departure wrongly picked up from 3/2 instead of the further-along 4/7. Departure can never
  // be behind the handoff, so seed it from the max (Aaron, 2026-08-05).
  const arrivalSeed   = existingArrival ?? getLatestGasSheetReading();
  const departureSeed = existingDeparture ?? getLatestGasSheetReading();

  const initArrival = arrivalSeed
    ? convertFromBackend(arrivalSeed.fullPages, arrivalSeed.lastPageEntries)
    : { totalPages: 0, entriesOnCurrentPage: 0 };
  const initDeparture = departureSeed
    ? convertFromBackend(departureSeed.fullPages, departureSeed.lastPageEntries)
    : { totalPages: 0, entriesOnCurrentPage: 0 };

  const [arrPages,    setArrPages]    = useState(initArrival.totalPages);
  const [arrEntries,  setArrEntries]  = useState(initArrival.entriesOnCurrentPage);
  const [depPages,    setDepPages]    = useState(initDeparture.totalPages);
  const [depEntries,  setDepEntries]  = useState(initDeparture.entriesOnCurrentPage);
  const [submittingA, setSubmittingA] = useState(false);
  const [submittingD, setSubmittingD] = useState(false);
  // Default false, not !existing — getMidArrival/Departure() resolve async, so seeding
  // from them froze the form open until a second refresh. `arrivalDone`/`departureDone`
  // already gate on the live `existing`; editing is just the Edit-button intent.
  const [editingA,    setEditingA]    = useState(false);
  const [editingD,    setEditingD]    = useState(false);

  const arrivalCount   = carsFromPageCounter(arrPages, arrEntries);
  const departureCount = carsFromPageCounter(depPages, depEntries);
  const arrivalDone    = !!existingArrival && !editingA;
  const departureDone  = !!existingDeparture && !editingD;
  const departureUnlocked = !!existingArrival;

  const todayHandoff = handoffNotes.find(n =>
    businessDateOf(n.loggedAt) === localDateStr(0)
  ) ?? null;

  // Cars cleaned during mid window
  const midCars = existingArrival && existingDeparture
    ? Math.max(0,
        (existingDeparture.fullPages * 19 + existingDeparture.lastPageEntries) -
        (existingArrival.fullPages   * 19 + existingArrival.lastPageEntries)
      )
    : null;

  // Overlap with morning shift (mid arrived after morning started)
  const morningHandoffCount = todayHandoff ? todayHandoff.fullPages * 19 + todayHandoff.lastPageEntries : null;
  const arrivalCount_ = existingArrival ? existingArrival.fullPages * 19 + existingArrival.lastPageEntries : null;
  const overlapWithMorning = morningHandoffCount != null && arrivalCount_ != null
    ? Math.max(0, morningHandoffCount - arrivalCount_)
    : null;

  // ── Arrival counter handlers ──────────────────────────────────────────────

  const handleArrEntryInc = () => {
    if (arrEntries === 19) { setArrPages(p => p + 1); setArrEntries(0); hapticMedium(); }
    else { setArrEntries(e => e + 1); hapticLight(); }
  };
  const handleArrEntryDec = () => {
    if (arrEntries === 0 && arrPages > 0) { setArrPages(p => p - 1); setArrEntries(19); hapticMedium(); }
    else if (arrEntries > 0) { setArrEntries(e => e - 1); hapticLight(); }
  };
  const handleArrPageInc = () => { setArrPages(p => p + 1); setArrEntries(19); hapticLight(); };
  const handleArrPageDec = () => { setArrPages(p => Math.max(0, p - 1)); hapticLight(); };

  // ── Departure counter handlers ────────────────────────────────────────────

  const handleDepEntryInc = () => {
    if (depEntries === 19) { setDepPages(p => p + 1); setDepEntries(0); hapticMedium(); }
    else { setDepEntries(e => e + 1); hapticLight(); }
  };
  const handleDepEntryDec = () => {
    if (depEntries === 0 && depPages > 0) { setDepPages(p => p - 1); setDepEntries(19); hapticMedium(); }
    else if (depEntries > 0) { setDepEntries(e => e - 1); hapticLight(); }
  };
  const handleDepPageInc = () => { setDepPages(p => p + 1); setDepEntries(19); hapticLight(); };
  const handleDepPageDec = () => { setDepPages(p => Math.max(0, p - 1)); hapticLight(); };

  // ── Submit handlers ───────────────────────────────────────────────────────

  const handleSubmitArrival = async () => {
    if (submittingA || arrivalCount <= 0) return;
    setSubmittingA(true);
    const { fullPages, lastPageEntries } = convertToBackendFormat(arrPages, arrEntries);
    const ok = await submitMidCheckpoint('mid_arrival', fullPages, lastPageEntries);
    setSubmittingA(false);
    if (ok) setEditingA(false);
  };

  const handleSubmitDeparture = async () => {
    if (submittingD || departureCount <= 0) return;
    setSubmittingD(true);
    const { fullPages, lastPageEntries } = convertToBackendFormat(depPages, depEntries);
    const ok = await submitMidCheckpoint('mid_departure', fullPages, lastPageEntries);
    setSubmittingD(false);
    if (ok) setEditingD(false);
  };

  const handleEditArrival = () => {
    if (existingArrival) {
      const { totalPages: tp, entriesOnCurrentPage: ep } = convertFromBackend(existingArrival.fullPages, existingArrival.lastPageEntries);
      setArrPages(tp); setArrEntries(ep);
    }
    setEditingA(true);
    hapticLight();
  };

  const handleEditDeparture = () => {
    if (existingDeparture) {
      const { totalPages: tp, entriesOnCurrentPage: ep } = convertFromBackend(existingDeparture.fullPages, existingDeparture.lastPageEntries);
      setDepPages(tp); setDepEntries(ep);
    }
    setEditingD(true);
    hapticLight();
  };

  // ── Summary (both logged) ─────────────────────────────────────────────────

  if (arrivalDone && departureDone && midCars !== null) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3 transition-colors space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            ✅ Mid Shift · {midCars} cars during your window
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={handleEditArrival} className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">Arrival</button>
            <button type="button" onClick={handleEditDeparture} className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">Departure</button>
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {existingArrival!.fullPages * 19 + existingArrival!.lastPageEntries} on arrival
          {' · '}
          {existingDeparture!.fullPages * 19 + existingDeparture!.lastPageEntries} on departure
          {overlapWithMorning != null && ` · ${overlapWithMorning} cars cleaned with morning`}
        </p>
      </div>
    );
  }

  // ── Two-step form ─────────────────────────────────────────────────────────

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Mid Shift Check-In / Check-Out</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          Log the gas sheet count when you arrive and again when you leave.
        </p>
      </div>

      <div className="p-4 space-y-6">

        {/* Arrival */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">On Arrival</p>
            {arrivalDone && (
              <button type="button" onClick={handleEditArrival} className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">Edit</button>
            )}
          </div>
          {arrivalDone ? (
            <p className="text-sm text-green-700 dark:text-green-400 font-semibold">
              ✅ Page {existingArrival!.fullPages} + {existingArrival!.lastPageEntries} = {existingArrival!.fullPages * 19 + existingArrival!.lastPageEntries} cars
            </p>
          ) : (
            <>
              <PageCounter
                totalPages={arrPages} entriesOnCurrentPage={arrEntries}
                onPageDec={handleArrPageDec} onPageInc={handleArrPageInc}
                onEntryDec={handleArrEntryDec} onEntryInc={handleArrEntryInc}
              />
              <button
                type="button"
                onClick={handleSubmitArrival}
                disabled={arrivalCount <= 0 || submittingA}
                className={`mt-4 w-full py-3 rounded-xl text-sm font-semibold transition cursor-pointer ${
                  arrivalCount > 0 && !submittingA
                    ? 'bg-fg-yellow hover:bg-fg-yellow-hi text-gray-900'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                }`}
              >
                {submittingA ? 'Saving…' : existingArrival ? 'Update Arrival' : 'Log Arrival'}
              </button>
            </>
          )}
        </div>

        {/* Departure */}
        <div className={!departureUnlocked ? 'opacity-40 pointer-events-none' : undefined}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              On Departure{!departureUnlocked && ' — log arrival first'}
            </p>
            {departureDone && departureUnlocked && (
              <button type="button" onClick={handleEditDeparture} className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">Edit</button>
            )}
          </div>
          {departureDone ? (
            <p className="text-sm text-green-700 dark:text-green-400 font-semibold">
              ✅ Page {existingDeparture!.fullPages} + {existingDeparture!.lastPageEntries} = {existingDeparture!.fullPages * 19 + existingDeparture!.lastPageEntries} cars
            </p>
          ) : (
            <>
              <PageCounter
                totalPages={depPages} entriesOnCurrentPage={depEntries}
                onPageDec={handleDepPageDec} onPageInc={handleDepPageInc}
                onEntryDec={handleDepEntryDec} onEntryInc={handleDepEntryInc}
                disabled={!departureUnlocked}
              />
              <button
                type="button"
                onClick={handleSubmitDeparture}
                disabled={departureCount <= 0 || submittingD || !departureUnlocked}
                className={`mt-4 w-full py-3 rounded-xl text-sm font-semibold transition ${
                  departureCount > 0 && !submittingD && departureUnlocked
                    ? 'bg-fg-yellow hover:bg-fg-yellow-hi text-gray-900 cursor-pointer'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                }`}
              >
                {submittingD ? 'Saving…' : existingDeparture ? 'Update Departure' : 'Log Departure'}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
