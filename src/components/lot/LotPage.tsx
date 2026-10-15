// The public /lot page: what a driver at the airport opens. No FG login — a shared PIN, asked once per phone,
// then initials, asked once per phone (a label on each tap, not security). Served at FG's /lot ahead of the auth
// gate, the way nanays serves /request (Aaron, 2026-10-14: *"can't it be a link through FG just like nanays'
// public order form?"*). The only writer behind it is api/lot.ts.
//
// Erin St's count sits on top (migration 153), so a driver looking at "low on cleans" also sees what is waiting.
import { useMemo } from 'react';
import { lotTotals } from '../../lib/lotLookout';
import { useLotBoard } from '../../hooks/useLotBoard';
import { useLotBay } from '../../hooks/useLotBay';
import { useLotTaps } from '../../hooks/useLotTaps';
import { useLotToast } from '../../hooks/useLotToast';
import { LotSummary } from './LotSummary';
import { LotMap } from './LotMap';
import { LotBayStrip } from './LotBayStrip';
import { LotPinGate, LotTapperBar, LotToast } from './LotChrome';

export function LotPage() {
  const board = useLotBoard();
  const erin = useLotBay();
  const [toastMsg, toast] = useLotToast();
  const taps = useLotTaps(board, toast);
  const totals = useMemo(() => lotTotals(board.stalls, board.aisle, board.nowMs), [board.stalls, board.aisle, board.nowMs]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-[460px] px-4 pb-24">
        {!taps.pin ? <LotPinGate onUnlock={taps.unlock} blurb="The airport stall board." /> : (
          <>
            {/* Not sticky: pinned, the counts and legend took half a phone and left the map a slot. */}
            <header className="pt-3 pb-2.5 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h1 className="text-xl font-extrabold">Lot Lookout</h1>
                <span className="text-xs text-gray-500 dark:text-gray-400">Airport · 1965 Wellington</span>
              </div>
              {erin.bay && <LotBayStrip bay={erin.bay} nowMs={erin.nowMs} />}
              <LotSummary totals={totals} aisleCars={board.aisle.cars} />
            </header>
            {board.error && <p className="my-2 text-sm text-red-700 dark:text-red-400">{board.error}</p>}
            {!board.loaded ? <p className="mt-8 text-center text-sm text-gray-500">Loading the lot…</p> : (
              <LotMap stalls={board.stalls} aisle={board.aisle} nowMs={board.nowMs} nPulse={totals.nPulse}
                onTap={(stall, state) => void taps.tapStall(stall, state)} onAisle={d => void taps.tapAisle(d)} />
            )}
            <p className="mt-4 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              Tap a colour on a stall: white open, green clean, red dirty. Tap the same colour again within 5 seconds to
              undo. Hold a stall to grey it out as taken, when a customer's or a staff car is parked in it; hold it
              again to free it. Tapping the colour a stall already shows tells
              everyone you looked and it is still true. Every tap shows on every phone.
            </p>
          </>
        )}
      </div>

      {taps.pin && <LotTapperBar by={taps.by} setBy={taps.setBy} hint="Tap a colour on any stall" />}
      <LotToast msg={toastMsg} />
    </div>
  );
}
