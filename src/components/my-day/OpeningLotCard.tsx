import { useState } from 'react';
import { useWashbayContext } from '../../context/WashbayContext';
import { findPriorShiftLog, buildBackfillClose } from '../../lib/washbayLineage';
import { shiftDateStr } from '../../lib/shiftDay';

const CARD = 'rounded-xl border transition-colors';
const STEP_BTN =
  'w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-700 text-lg font-semibold text-gray-600 dark:text-gray-400 hover:border-fg-yellow hover:text-gray-900 dark:hover:text-gray-100 transition cursor-pointer flex items-center justify-center';

// "What you walked into" — at the top of an opening shift the opener records the
// dirties left in the queue overnight, right here in My Day, instead of
// reconstructing it later in the handoff form. `carsRemaining` carries into the
// morning washbay rate. When last night DID log a close, this shows the inherited
// number read-only. Reuses the exact backfill write the handoff form uses.
export function OpeningLotCard() {
  const { washbayLogs, submitWashbayLog } = useWashbayContext();
  const priorLog = findPriorShiftLog(washbayLogs);
  const [count, setCount] = useState(0);
  const [saving, setSaving] = useState(false);

  // Last night logged (or already backfilled) → show what was inherited, read-only.
  if (priorLog) {
    const n = priorLog.carsRemaining;
    return (
      <section className={`${CARD} border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">You walked into</p>
        {n === 0 ? (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Clean lot — nothing left in the queue from last night. 🎯</p>
        ) : (
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            <span className="font-bold text-gray-900 dark:text-gray-100">{n}</span> {n === 1 ? 'dirty' : 'dirties'} left in the queue from last night — carried into your morning rate.
          </p>
        )}
      </section>
    );
  }

  // No prior close on record → let the opener log what they walked into.
  const save = async () => {
    setSaving(true);
    const ok = await submitWashbayLog(buildBackfillClose(count), shiftDateStr(-1));
    // On success the optimistic update makes findPriorShiftLog match → this card
    // flips to the inherited line above on the next render.
    if (!ok) setSaving(false);
  };

  return (
    <section className={`${CARD} border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-900/20 px-4 py-4 space-y-3`}>
      <div>
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">⚠ No closing log from last night</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Log the dirties left in the queue so they carry into your morning rate.
        </p>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-gray-300">Dirties left in queue</span>
        <div className="flex items-center gap-3">
          <button type="button" className={STEP_BTN} onClick={() => setCount(c => Math.max(0, c - 1))} aria-label="Fewer">−</button>
          <span className="text-xl font-bold text-gray-900 dark:text-gray-100 w-6 text-center tabular-nums">{count}</span>
          <button type="button" className={STEP_BTN} onClick={() => setCount(c => c + 1)} aria-label="More">+</button>
        </div>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition disabled:opacity-60 cursor-pointer"
      >
        {saving ? 'Saving…' : 'Log what you opened with'}
      </button>
    </section>
  );
}
