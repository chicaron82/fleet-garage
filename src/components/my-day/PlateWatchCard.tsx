import { useState } from 'react';
import { usePlateWatches } from '../../hooks/usePlateWatches';
import { normalizeWatchPlate } from '../../lib/plateWatch';

// The board, in FG. Plates to stop on — including cars FG has no record of.
//
// ⭐ WHY IT LIVES ON MY DAY. This is a board item, and My Day is where his shift starts and where
// he reads the board. The whiteboard by the off-standard sheets is the thing being replaced — a red
// marker note saying "DFDA712 HOLD PLS. THX" that only works if somebody happens to walk past it.
//
// ⚠️ But this card is NOT how a watch does its job. The scan is (see ScanPlateWatch): a list you
// have to remember to consult is a list that gets consulted on the days nothing is on it. This is
// where a watch is SET and SEEN; the ambush is where it is caught.
//
// Silent when the board is empty — most days — for the same reason the scan sheet's damage map is:
// a card that says "nothing today" on every single shift trains him to scroll past it.
export function PlateWatchCard() {
  const { watches, loading, addWatch, clearWatch } = usePlateWatches();
  const [plate, setPlate] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [failed, setFailed] = useState(false);

  const canAdd = !!normalizeWatchPlate(plate) && !busy;

  const submit = async () => {
    if (!canAdd) return;
    setBusy(true);
    setFailed(false);
    const ok = await addWatch(plate, reason);
    setBusy(false);
    // ⚠️ Only clear the fields when the write actually landed — wiping them on a failure would
    // throw away what he typed and report it as done. And SAY that it failed: leaving the fields
    // populated with no explanation is honest but useless, and the likeliest cause is benign
    // (that plate is already on the board — migration 128's partial unique index).
    if (ok) { setPlate(''); setReason(''); setAdding(false); }
    else setFailed(true);
  };

  if (loading || (watches.length === 0 && !adding)) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="w-full text-left px-1 text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-pointer transition"
        data-testid="plate-watch-empty"
      >
        + Watch a plate
      </button>
    );
  }

  return (
    <section className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20 px-4 py-3.5 space-y-2.5"
             data-testid="plate-watch-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-red-700/80 dark:text-red-400/80">
        Plates on watch
      </p>

      {watches.map(w => (
        <div key={w.id} className="flex items-start gap-2.5">
          <span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">{w.plate}</span>
          <span className="flex-1 min-w-0 text-xs text-gray-600 dark:text-gray-400">{w.reason}</span>
          <button
            type="button"
            onClick={() => void clearWatch(w.id)}
            className="shrink-0 text-[11px] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
          >
            Clear
          </button>
        </div>
      ))}

      {adding ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input
            value={plate}
            onChange={e => setPlate(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter') void submit(); }}
            placeholder="Plate"
            aria-label="Plate to watch"
            autoCapitalize="characters" autoCorrect="off" spellCheck={false}
            className="h-11 w-28 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 font-mono text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-fg-yellow"
          />
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void submit(); }}
            placeholder="why — in your words"
            aria-label="Why this plate is on watch"
            className="h-11 flex-1 min-w-[9rem] rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-fg-yellow"
          />
          <button
            type="button" onClick={() => void submit()} disabled={!canAdd}
            className="h-11 shrink-0 rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi px-4 text-xs font-semibold text-black disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
          >
            {busy ? 'Adding…' : 'Watch it'}
          </button>
          {failed && (
            <p className="w-full text-[11px] text-red-700 dark:text-red-400" role="status">
              Didn't save — that plate may already be on the board.
            </p>
          )}
        </div>
      ) : (
        <button
          type="button" onClick={() => setAdding(true)}
          className="text-xs text-red-700/80 hover:text-red-900 dark:text-red-400/80 dark:hover:text-red-300 cursor-pointer"
        >
          + Watch another plate
        </button>
      )}
    </section>
  );
}
