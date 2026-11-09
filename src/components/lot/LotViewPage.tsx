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
//
// ⭐ NOT BEING KEPT (2026-11-05, docs/ticket-lot-view-count-not-kept.md): after 2 h with nothing done (his number, any
// tap), the page blurs behind a card in the BAY's voice, never his: no name, no hours, no "back at". Show it anyway
// clears it for the visit; his next tap clears it for everyone.
//
// ⭐ ON BREAK (migration 166, docs/ticket-lot-bay-on-break.md): a heads-up, not the blur: the count isn't stale, it's
// paused. No time on it: this link reaches his manager, and a start time would make it a log of his breaks.
import { useState } from 'react';
import { useBayLog } from '../../hooks/useBayLog';
import { useLotBay } from '../../hooks/useLotBay';
import { useLotCrew } from '../../hooks/useLotCrew';
import { isCountKept, isOnBreak, lastActivity, lastHand } from '../../lib/countKept';
import { whenOf } from '../../lib/lotBay';
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
  const [shown, setShown] = useState(false);
  const last = lastActivity(erin.bay, bay.rows);
  const breakAt = erin.bay?.breakAt;
  const hand = lastHand(last, breakAt);
  const covered = erin.loaded && bay.loaded && !shown && !isCountKept(hand, erin.nowMs);
  const onBreak = !covered && isCountKept(hand, erin.nowMs) && isOnBreak(breakAt, last);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-[460px] px-4 pt-3 pb-10 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-xl font-extrabold">Lot Lookout</h1>
          <span className="text-xs text-gray-500 dark:text-gray-400">Erin St · read only</span>
        </div>
        {!erin.loaded || !bay.loaded ? <p className="mt-8 text-center text-sm text-gray-500">Loading the bay…</p> : (
          <div className="relative">
          {covered && (
            <section aria-label="Not being kept" className="absolute inset-x-0 top-6 z-10 mx-2 rounded-2xl border border-gray-300 dark:border-gray-600 bg-white/95 dark:bg-gray-900/95 px-4 py-4 text-center shadow-lg">
              <p className="font-bold">The count isn't being kept right now.</p>
              {last && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Last updated {whenOf(last, erin.nowMs)}.</p>}
              <button type="button" onClick={() => setShown(true)}
                className="mt-3 rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800">
                Show it anyway
              </button>
            </section>
          )}
          <div className={covered ? 'space-y-3 blur-sm pointer-events-none select-none' : 'space-y-3'} aria-hidden={covered || undefined}>
            {onBreak && (
              <p role="status" className="rounded-2xl border border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950 px-4 py-2.5 text-sm text-sky-900 dark:text-sky-100">
                <span className="font-bold">The count is paused for a break.</span> It catches up after.
              </p>
            )}
            <section aria-label="In the bay now"
              className={`rounded-2xl px-4 py-3 ${open ? 'border-2 border-amber-500 bg-white dark:bg-gray-900' : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'}`}>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">In the bay now</p>
              {open ? (
                <>
                  <p className="mt-1 flex items-baseline justify-between gap-2">
                    <span className="font-mono text-lg font-bold">{open.plate}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">since {whenOf(open.started_at, erin.nowMs)}</span>
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
          </div>
          </div>
        )}
        <p className="text-center text-xs text-gray-500 dark:text-gray-400">Updates by itself. Cars and times from the bay log.</p>
      </div>
    </div>
  );
}
