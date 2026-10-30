// /lot/view — Erin St, read only. No PIN, no buttons: for whoever just wants to know without texting the bay (Aaron,
// 2026-10-15: *"Without the constant message. "What's the count?/How many clean and dirty?""*).
//
// ⭐ The bay log (2026-10-29): *"someone with the read-only link can see which vehicle we're currently cleaning ... once
// done, goes on the cleaned list. boss could see what we've done so far and when it was done"*. The counter reads it
// for *"checking what's done"*. The airport is gone from here: *"strictly erin st"*.
//
// His rulings for this page stand: its own link, so nothing can be tapped by accident and it outlives a PIN change; and
// times, never initials. The bay log adds one more: durations, never (BayLogList shows exit times only). /lot opens
// here too, so a driver's saved airport link lands on something live.
//
// Today's crew (migration 154) shows as NUMBERS from GET /api/lot, which never sends this page a name.
import { useBayLog } from '../../hooks/useBayLog';
import { useLotBay } from '../../hooks/useLotBay';
import { useLotCrew } from '../../hooks/useLotCrew';
import { clockOf } from '../../lib/lotBay';
import { inTheBay } from '../../lib/lotBayLog';
import { shiftDayLabel } from '../../lib/shiftDay';
import { BayLogList } from './BayLogList';
import { LotBayStrip } from './LotBayStrip';
import { LotCrewLine } from './LotCrewLine';

export function LotViewPage() {
  const erin = useLotBay();
  const bay = useBayLog();
  const { crew } = useLotCrew();
  const open = inTheBay(bay.rows);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-[460px] px-4 pt-3 pb-10 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-xl font-extrabold">Lot Lookout</h1>
          <span className="text-xs text-gray-500 dark:text-gray-400">Erin St · read only</span>
        </div>
        {!erin.loaded || !bay.loaded ? <p className="mt-8 text-center text-sm text-gray-500">Loading the bay…</p> : (
          <>
            <section aria-label="In the bay now"
              className={`rounded-2xl px-4 py-3 ${open ? 'border-2 border-amber-500 bg-white dark:bg-gray-900' : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'}`}>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">In the bay now</p>
              {open ? (
                <>
                  <p className="mt-1 flex items-baseline justify-between gap-2">
                    <span className="font-mono text-lg font-bold">{open.plate}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">since {clockOf(open.started_at)}</span>
                  </p>
                  {open.car && <p className="text-sm text-gray-600 dark:text-gray-300">{open.car}</p>}
                </>
              ) : <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Nothing in the bay right now.</p>}
            </section>
            {erin.bay ? <LotBayStrip bay={erin.bay} nowMs={erin.nowMs} />
              : <p className="text-sm text-red-700 dark:text-red-400">Erin St's count could not load.</p>}
            {bay.error && <p className="text-sm text-red-700 dark:text-red-400">{bay.error}</p>}
            <BayLogList rows={bay.rows} readOnly heading={`Today · ${shiftDayLabel()}`} />
            {crew && <LotCrewLine summary={crew.summary} />}
          </>
        )}
        <p className="text-center text-xs text-gray-500 dark:text-gray-400">Updates by itself. Cars and times from the bay log.</p>
      </div>
    </div>
  );
}
