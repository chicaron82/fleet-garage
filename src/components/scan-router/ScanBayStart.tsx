// Find a car → the bay. Aaron, 2026-10-29: *"i can start it from the "find a car" but it will take me to the full
// module after tapping start"*. It sits under the flip, last in the at-the-car beat: the odometer above it is what Start
// is made on. Ticket: docs/ticket-lot-lookout-bay-log.md.
//
// One car at a time (*"i can't start a new one when i'm still working on the previous one"*): while a car is in, this
// is "Finish <plate> first", and that gate is also the forgotten-close fix. Start also needs today's odo, so a car never
// enters the bay without the reading he already takes at every car.
import { useState } from 'react';
import { useBayLog, type BayLogState } from '../../hooks/useBayLog';
import { useAuth } from '../../context/AuthContext';
import { initialsOf } from '../../lib/lotLookout';
import { hapticMedium } from '../../lib/haptics';
import { startBlock, inTheBay } from '../../lib/lotBayLog';
import { businessDateOf } from '../../lib/shiftDay';
import type { Vehicle } from '../../types';

/** `bayLog`: the host's own bay log, when it already has one (the bay card's Find a car), so the Start lands in the list
 *  the host is showing instead of waiting on a second subscription's realtime. */
export function ScanBayStart({ vehicle, onOpenBay, bayLog }: { vehicle: Vehicle; onOpenBay: (started: boolean) => void; bayLog?: BayLogState }) {
  const { user } = useAuth();
  const own = useBayLog(initialsOf(user?.name ?? null) || 'FG');
  const bay = bayLog ?? own;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!bay.loaded) return null;
  const block = startBlock(inTheBay(bay.rows), vehicle.id);
  const odoToday = !!vehicle.odometerAt && businessDateOf(vehicle.odometerAt) === businessDateOf(new Date());

  if (block) {
    return (
      <button type="button" onClick={() => onOpenBay(false)}
        className="w-full rounded-xl border-2 border-amber-500 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-left cursor-pointer">
        {block.same ? (
          <span className="block text-sm font-bold text-amber-900 dark:text-amber-200">In the bay since {block.since} · open the bay log →</span>
        ) : (
          <>
            <span className="block text-sm font-bold text-amber-900 dark:text-amber-200">{block.plate} is still in the bay</span>
            <span className="block text-xs text-amber-800 dark:text-amber-300">Since {block.since} · give it an exit before starting another</span>
            <span className="mt-1 block text-sm font-extrabold text-amber-900 dark:text-amber-200">Finish {block.plate} first →</span>
          </>
        )}
      </button>
    );
  }

  const start = async () => {
    hapticMedium();
    setBusy(true);
    setErr('');
    const e = await bay.start(vehicle.id);
    setBusy(false);
    if (e) setErr(e);
    else onOpenBay(true);
  };

  return (
    <div className="space-y-1">
      <button type="button" disabled={!odoToday || busy} onClick={() => void start()}
        className="w-full rounded-xl bg-fg-yellow hover:bg-fg-yellow-hi py-3.5 text-base font-extrabold text-black cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
        {busy ? 'Starting…' : '▶ Start cleaning'}
      </button>
      <p className={`text-center text-xs ${err ? 'font-semibold text-red-700 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
        {err || (odoToday ? 'Puts it in the bay and opens the bay log.' : "Log today's odo above to start cleaning it.")}
      </p>
    </div>
  );
}
