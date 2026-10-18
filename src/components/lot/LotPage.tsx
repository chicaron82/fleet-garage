// The public /lot page: what a driver at the airport opens. No FG login — a shared PIN, asked once per phone,
// then initials, asked once per phone (a label on each tap, not security). Served at FG's /lot ahead of the auth
// gate, the way nanays serves /request (Aaron, 2026-10-14: *"can't it be a link through FG just like nanays'
// public order form?"*). The only writer behind it is api/lot.ts.
//
// ⭐ Since 2026-10-18 (migration 157) it is two readings and the aisle, not a stall map. His words: *"picking between
// three states is a little much. especially when moving quickly. drivers picking up and going"*. One screen, one tap per
// reading, and a tap with no signal waits on the phone (useAirportTaps) instead of being undone in front of the driver.
//
// Erin St's count sits on top (migration 153), so a driver also sees what is waiting at the bay.
import { useCallback } from 'react';
import { useLotAirport } from '../../hooks/useLotAirport';
import { useLotBay } from '../../hooks/useLotBay';
import { useLotPin, postLot, type LotPost } from '../../hooks/useLotPin';
import { useLotToast } from '../../hooks/useLotToast';
import { useAirportTaps } from '../../hooks/useAirportTaps';
import { AirportNotches } from './AirportNotches';
import { LotBayStrip } from './LotBayStrip';
import { LotPinGate, LotTapperBar, LotToast } from './LotChrome';

export function LotPage() {
  const airport = useLotAirport('lot-airport-drivers');
  const erin = useLotBay();
  const [toastMsg, toast] = useLotToast();
  const { pin, by, setBy, unlock, fail, pinUnchecked, pinWorked } = useLotPin(toast);
  const send = useCallback((body: Record<string, unknown>): Promise<LotPost> => postLot({ pin, ...body }), [pin]);
  const taps = useAirportTaps({ airport, send, by, queueKey: 'lot_airport_queue', onFail: fail, onSent: pinWorked, toast });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-[460px] px-4 pb-24">
        {!pin ? <LotPinGate onUnlock={unlock} blurb="The airport readings." /> : (
          <>
            <header className="pt-3 pb-2.5 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h1 className="text-xl font-extrabold">Airport lot</h1>
                <span className="text-xs text-gray-500 dark:text-gray-400">Tap what you see</span>
              </div>
              {erin.bay && <LotBayStrip bay={erin.bay} nowMs={erin.nowMs} />}
            </header>
            {(pinUnchecked || taps.waiting > 0) && (
              <p role="status" className="mb-2 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                {taps.waiting > 0 ? `${taps.waiting} ${taps.waiting === 1 ? 'tap' : 'taps'} waiting for signal. They send by themselves.` : 'No signal yet: your PIN is checked when there is.'}
              </p>
            )}
            {airport.error && <p className="my-2 text-sm text-red-700 dark:text-red-400">{airport.error}</p>}
            {/* Taps work before the first read lands (a dead zone may never let it): they wait like any other. */}
            <AirportNotches shown={taps.shown} nowMs={airport.nowMs} onTap={(f, v) => void taps.tap(f, v)} />
            <p className="mt-4 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              One tap saves. Tap again any time; the newest reading wins. No signal? Your tap waits on this phone with the
              time you made it, and sends when signal comes back. Every reading shows on every phone and in FG.
            </p>
          </>
        )}
      </div>

      {pin && <LotTapperBar by={by} setBy={setBy} hint="Tap what you see" />}
      <LotToast msg={toastMsg} />
    </div>
  );
}
