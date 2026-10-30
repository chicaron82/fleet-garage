// The car in the bay, and its four ways out. Aaron, 2026-10-29: *"different exit points perhaps: [clean] <- default,
// [M hold] maintenance issue like PM, [B hold] damage found, [skip]"*. Ticket: docs/ticket-lot-lookout-bay-log.md.
//
// • Clean is the page's one primary action, so it wears the action yellow (CLAUDE.md, Design Language), big, alone on
//   its row. It puts the car on the list and +1 on Erin St's cleans in one save.
// • M hold / B hold open Flag / hold with this car and the type chosen; the car leaves the bay only once the hold SAVES.
//   If that close failed (a dropped signal after the save), the hold is already on the car: the button becomes
//   "Close as held" and closes it without a second hold.
// • Skip is a bump, not a verdict: *"a vehicle in the queue needed to be done ASAP ... skip to do later"*. The empty
//   bay that follows leads with Find a car, because the ASAP car is the next thing he does.
// • Every exit is one tap; Clean and Skip carry a 5-second Undo on the note (a wet thumb lands on the neighbour).
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { hapticLight, hapticMedium } from '../../lib/haptics';
import { clockOf } from '../../lib/lotBay';
import type { BayExit, BayLogRow } from '../../lib/lotBayLog';

const EXIT_BTN = 'min-h-16 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-2 grid justify-items-center content-center gap-0.5 cursor-pointer touch-manipulation active:scale-95 transition disabled:opacity-40';

export interface BayInTheBayProps {
  open: BayLogRow | null;
  busy: boolean;
  /** Clean or Skip: settled right here. */
  onExit: (kind: Extract<BayExit, 'clean' | 'skip'>) => void;
  /** M hold / B hold: open the hold form for this car. */
  onHold: (kind: 'mhold' | 'bhold') => void;
  /** The hold already saved: close the car as held without a second hold. */
  onCloseHeld: (kind: 'mhold' | 'bhold') => void;
  onFindCar: () => void;
  /** Set right after a Skip: the empty bay says what comes next. */
  bumped: boolean;
}

export function BayInTheBay({ open, busy, onExit, onHold, onCloseHeld, onFindCar, bumped }: BayInTheBayProps) {
  const { holds } = useVehicleHoldContext();
  if (!open) {
    return (
      <section aria-label="In the bay" className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 px-4 py-4 space-y-3 text-center">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{bumped ? 'Bumped. Bring the ASAP car in.' : "The bay's empty."}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">Look the car up, log its odo, and tap Start cleaning.</p>
        <button type="button" onClick={() => { hapticLight(); onFindCar(); }}
          className="w-full rounded-xl bg-fg-yellow hover:bg-fg-yellow-hi py-3.5 text-base font-bold text-black cursor-pointer">
          🔍 Find a car
        </button>
      </section>
    );
  }
  // A hold flagged on this car since it came in: the form saved it, the close did not land.
  // Compared as instants: the hold's ISO and Postgres' timestamptz text are spelled differently ("Z" vs "+00:00").
  const startedMs = Date.parse(open.started_at);
  const heldSince = holds.find(h => h.vehicleId === open.vehicle_id && Date.parse(h.flaggedAt) >= startedMs);
  const heldKind: 'mhold' | 'bhold' | null = heldSince ? (heldSince.holdTypes.includes('mechanical') ? 'mhold' : 'bhold') : null;
  const tap = (f: () => void) => () => { hapticMedium(); f(); };

  return (
    <section aria-label="In the bay" className="rounded-2xl border-2 border-amber-500 bg-white dark:bg-gray-900 px-4 py-3.5 space-y-3">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">In the bay</p>
        <p className="mt-1 font-mono text-lg font-bold text-gray-900 dark:text-gray-100">{open.plate}</p>
        {open.car && <p className="text-sm text-gray-600 dark:text-gray-300">{open.car}</p>}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Since {clockOf(open.started_at)}{open.odometer != null ? ` · odo ${open.odometer.toLocaleString('en-CA')}` : ''}
        </p>
      </div>

      {heldKind ? (
        <button type="button" disabled={busy} onClick={tap(() => onCloseHeld(heldKind))}
          className="w-full rounded-xl bg-fg-yellow hover:bg-fg-yellow-hi py-3.5 text-base font-bold text-black cursor-pointer disabled:opacity-50">
          Held at {clockOf(heldSince!.flaggedAt)}. Close it as held
        </button>
      ) : (
        <>
          <button type="button" disabled={busy} onClick={tap(() => onExit('clean'))}
            className="w-full min-h-16 rounded-xl bg-fg-yellow hover:bg-fg-yellow-hi grid justify-items-center content-center gap-0.5 text-black cursor-pointer touch-manipulation active:scale-[0.98] transition disabled:opacity-50">
            <span className="text-lg font-extrabold">✓ Clean</span>
            <span className="text-xs font-semibold text-gray-800">Onto the list · +1 Erin St cleans</span>
          </button>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" disabled={busy} onClick={tap(() => onHold('mhold'))} className={EXIT_BTN}>
              <span className="text-sm font-extrabold text-amber-800 dark:text-amber-300">🔧 M hold</span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">Mechanical</span>
            </button>
            <button type="button" disabled={busy} onClick={tap(() => onHold('bhold'))} className={EXIT_BTN}>
              <span className="text-sm font-extrabold text-red-700 dark:text-red-400">⚠️ B hold</span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">Damage</span>
            </button>
            <button type="button" disabled={busy} onClick={tap(() => onExit('skip'))} className={EXIT_BTN}>
              <span className="text-sm font-extrabold text-blue-700 dark:text-blue-400">↷ Skip</span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">ASAP car first</span>
            </button>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">M hold and B hold open Flag / hold with this car filled in. It leaves the bay when the hold saves.</p>
        </>
      )}
    </section>
  );
}
