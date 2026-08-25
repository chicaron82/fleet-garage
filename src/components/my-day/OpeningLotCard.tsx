import { useState } from 'react';
import { useWashbayContext } from '../../context/WashbayContext';
import { findPriorShiftLog, buildBackfillClose } from '../../lib/washbayLineage';
import { shiftDateStr } from '../../lib/shiftDay';

const CARD = 'rounded-xl border transition-colors';
const STEP_BTN =
  'w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-700 text-lg font-semibold text-gray-600 dark:text-gray-400 hover:border-fg-yellow hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer flex items-center justify-center';

function Counter({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
      <div className="flex items-center gap-3">
        <button type="button" className={STEP_BTN} onClick={() => onChange(Math.max(0, value - 1))} aria-label={`Fewer — ${label}`}>−</button>
        <span className="text-xl font-bold text-gray-900 dark:text-gray-100 w-6 text-center tabular-nums">{value}</span>
        <button type="button" className={STEP_BTN} onClick={() => onChange(value + 1)} aria-label={`More — ${label}`}>+</button>
      </div>
    </div>
  );
}

// The overnight lot state carried over from last night's close: dirties still in the
// queue (which feed the morning washbay rate) and clean cars not yet sent (situational ·
// shown on the shift report). When last night logged a close, both show read-only; when
// it didn't, this is where the close gets reconstructed. Reuses the exact backfill write
// the handoff form uses.
//
// ⚠️ Renders on EVERY working shift, not just openings (Aaron, 2026-08-25, from a mid:
// *"this shouldn't be buried in the shift hand-off"*). The old `shiftType === 'opening'`
// gate assumed an opener would always be the one to inherit the lot and repair a missing
// close. With one operator on a rotating shift, that person is frequently NOT on an
// opening — so the card vanished and the backfill survived only inside the Log Shift
// Handoff modal, three taps deep, at the END of the day it was meant to inform.
//
// `openedToday` only changes the WORDING, never whether the prompt appears: "you walked
// into" is a claim about his own arrival and would be a small lie on a 10:30 mid.
export function OpeningLotCard({ openedToday = true }: { openedToday?: boolean }) {
  const { washbayLogs, submitWashbayLog } = useWashbayContext();
  const priorLog = findPriorShiftLog(washbayLogs);
  const [dirties, setDirties] = useState(0);
  const [cleans, setCleans] = useState(0);
  const [saving, setSaving] = useState(false);

  // Last night logged (or already backfilled) → show what was inherited, read-only.
  if (priorLog) {
    const inDirties = priorLog.carsRemaining;
    const inCleans = priorLog.cleanNotPickedUp;
    return (
      <section className={`${CARD} border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {openedToday ? 'You walked into' : 'The day started with'}
        </p>
        {inDirties === 0 && inCleans === 0 ? (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Clean lot — nothing left in the queue from last night. 🎯</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              <span className="font-bold text-gray-900 dark:text-gray-100">{inCleans}</span> clean{inCleans === 1 ? '' : 's'} not sent
              {' · '}
              <span className="font-bold text-gray-900 dark:text-gray-100">{inDirties}</span> {inDirties === 1 ? 'dirty' : 'dirties'}
            </p>
            {inDirties > 0 && (
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">Dirties carried into your morning rate.</p>
            )}
          </>
        )}
      </section>
    );
  }

  // No prior close on record → reconstruct it, whoever is on today.
  const save = async () => {
    setSaving(true);
    const ok = await submitWashbayLog(buildBackfillClose(dirties, cleans), shiftDateStr(-1));
    // On success the optimistic update makes findPriorShiftLog match → this card
    // flips to the inherited line above on the next render.
    if (!ok) setSaving(false);
  };

  return (
    <section className={`${CARD} border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-900/20 px-4 py-4 space-y-3`}>
      <div>
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">⚠ No closing log from last night</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {openedToday
            ? 'Log what you walked into — dirties carry into your morning rate.'
            : 'Log what was left overnight — dirties carry into today’s rate.'}
        </p>
      </div>
      <Counter label="Dirties left in queue" value={dirties} onChange={setDirties} />
      <Counter label="Clean, not picked up" value={cleans} onChange={setCleans} />
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition disabled:opacity-60 cursor-pointer"
      >
        {saving ? 'Saving…' : openedToday ? 'Log what you opened with' : 'Log last night’s close'}
      </button>
    </section>
  );
}
