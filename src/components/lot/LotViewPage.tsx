// /lot/view — both lots, read only. No PIN, no buttons: for whoever just wants the count without texting the bay
// (Aaron, 2026-10-15: *"Without the constant message. "What's the count?/How many clean and dirty?""*).
//
// His rulings for it, 2026-10-15: its own link, so nothing can be tapped by accident and it outlives a PIN change;
// and times, never initials — it is about the count, not about who is working. Reading was already open (migration
// 151's read policies); the PIN guards the buttons, and there are none here. So no stall map either: the map shows
// who tapped each stall.
import { useMemo } from 'react';
import { lotTotals } from '../../lib/lotLookout';
import { useLotBoard } from '../../hooks/useLotBoard';
import { useLotBay } from '../../hooks/useLotBay';
import { LotSummary } from './LotSummary';
import { LotBayStrip } from './LotBayStrip';

export function LotViewPage() {
  const board = useLotBoard();
  const erin = useLotBay();
  const totals = useMemo(() => lotTotals(board.stalls, board.aisle, board.nowMs), [board.stalls, board.aisle, board.nowMs]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-[460px] px-4 pt-3 pb-10 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-xl font-extrabold">Lot Lookout</h1>
          <span className="text-xs text-gray-500 dark:text-gray-400">Both lots · read only</span>
        </div>
        {!erin.loaded || !board.loaded ? <p className="mt-8 text-center text-sm text-gray-500">Loading the counts…</p> : (
          <>
            {erin.bay ? <LotBayStrip bay={erin.bay} nowMs={erin.nowMs} />
              : <p className="text-sm text-red-700 dark:text-red-400">Erin St's count could not load.</p>}
            <section aria-label="Airport" className="space-y-1">
              <h2 className="px-0.5 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Airport</h2>
              {board.error ? <p className="text-sm text-red-700 dark:text-red-400">{board.error}</p>
                : <LotSummary totals={totals} aisleCars={board.aisle.cars} showLegend={false} />}
            </section>
          </>
        )}
        <p className="text-center text-xs text-gray-500 dark:text-gray-400">Updates by itself. Every number shows when it was last counted.</p>
      </div>
    </div>
  );
}
