// Find a car → the bay. Aaron, 2026-10-29: *"i can start it from the "find a car" but it will take me to the full
// module after tapping start"*. It sits under the flip, last in the at-the-car beat: the odometer above it is what Start
// is made on. Ticket: docs/ticket-lot-lookout-bay-log.md.
//
// One car at a time (*"i can't start a new one when i'm still working on the previous one"*): while a car is in, this
// is "Finish <plate> first", and that gate is also the forgotten-close fix.
//
// ⏭ On deck (Aaron, 2026-11-03: *"Split the large "start cleaning" into two options [Start Clean][On Deck]. On deck loads
// it as the next vehicle"*). Beside Start with the bay empty, under "Finish X first" with a car in: the same one slot. An
// empty bay with a car on deck offers that car's Start on the bay card, so loading it never starts a clock.
// Docs: docs/ticket-bay-on-deck-trip-clean-quick-holds.md.
//
// ⚠️ The odo is NOT a gate (since 2026-10-31, docs/ticket-bay-log-first-shift-friction.md). It was, and on a
// passenger-side day it fought him: *"When I work passenger side I don't see the odo until I take it out to park"*, so
// he started each car one early to get past it. His call: *"How bout leaving the odo optional. You and I do gas sheets
// later so whatever is missed would get entered that way."* He flips sides with the partner, so this is no side mode:
// one screen serves both. The line under Start only says, quietly, when today's reading is missing. The server writes
// the row's odo only from a reading taken today (startOdometer), so a stale one never reads as today's.
import { useState } from 'react';
import { useBayLog, type BayLogState } from '../../hooks/useBayLog';
import { useBayStandby } from '../../hooks/useBayStandby';
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
  // On deck: he has the NEXT car's key in his hand (Aaron, 2026-11-02, migration 163), with or without a car in.
  const next = useBayStandby(initialsOf(user?.name ?? null) || 'FG');
  const bay = bayLog ?? own;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!bay.loaded) return null;
  const block = startBlock(inTheBay(bay.rows), vehicle.id);
  const odoToday = !!vehicle.odometerAt && businessDateOf(vehicle.odometerAt) === businessDateOf(new Date());

  const onDeck = next.standby?.vehicle_id === vehicle.id;
  const lineUp = async () => {
    hapticMedium();
    setBusy(true);
    setErr('');
    const e = await next.load(vehicle.id);
    setBusy(false);
    if (e) setErr(e);
  };

  if (block) {
    return (
      <div className="space-y-2">
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
      {!block.same && next.loaded && (onDeck ? (
        <p className="text-center text-sm font-bold text-gray-700 dark:text-gray-200">⏭ On deck. It comes in when {block.plate} leaves.</p>
      ) : (
        <button type="button" disabled={busy} onClick={() => void lineUp()}
          className="w-full rounded-xl bg-fg-yellow hover:bg-fg-yellow-hi py-3 text-sm font-extrabold text-black cursor-pointer disabled:opacity-40">
          ⏭ On deck{next.standby ? ` (replaces ${next.standby.plate})` : ''}
        </button>
      ))}
      {err && <p role="alert" className="text-center text-xs font-semibold text-red-700 dark:text-red-400">{err}</p>}
      </div>
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

  const other = next.standby && !onDeck ? next.standby.plate : null;
  const line = err || (onDeck ? 'On deck. Start clean when you\'re ready.'
    : other ? `On deck replaces ${other}.`
    : odoToday ? 'Puts it in the bay and opens the bay log.' : 'No odo today. The gas sheet can fill it in.');
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[3fr_2fr] gap-2">
        <button type="button" disabled={busy} onClick={() => void start()}
          className="rounded-xl bg-fg-yellow hover:bg-fg-yellow-hi py-3.5 text-base font-extrabold text-black cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
          {busy ? 'Working…' : '▶ Start clean'}
        </button>
        {onDeck ? (
          <p className="grid place-items-center rounded-xl border-2 border-gray-300 dark:border-gray-600 text-sm font-extrabold text-gray-700 dark:text-gray-200">⏭ On deck ✓</p>
        ) : (
          <button type="button" disabled={busy || !next.loaded} onClick={() => void lineUp()}
            className="rounded-xl border-2 border-gray-900 dark:border-gray-200 bg-white dark:bg-gray-900 py-3.5 text-base font-extrabold text-gray-900 dark:text-gray-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            ⏭ On deck
          </button>
        )}
      </div>
      <p className={`text-center text-xs ${err ? 'font-semibold text-red-700 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>{line}</p>
    </div>
  );
}
