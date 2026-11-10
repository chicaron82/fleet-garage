// The car in the bay, and its four ways out. Aaron, 2026-10-29: *"different exit points perhaps: [clean] <- default,
// [M hold] maintenance issue like PM, [B hold] damage found, [skip]"*. Ticket: docs/ticket-lot-lookout-bay-log.md.
//
// • Clean is the page's one primary action, so it wears the action yellow (CLAUDE.md, Design Language), big, alone on
//   its row. It puts the car on the list and +1 on Erin St's cleans in one save.
// • M hold / B hold are ONE TAP since 2026-11-03: *"Choosing M or B from the exit options after cleaning just marks them
//   as M or B on the list. Going through the form to fill everything out is costing me time."* The car leaves marked; the
//   list row offers Flag it for the form later, and Find a car says "not flagged yet" until it's done
//   (docs/ticket-bay-on-deck-trip-clean-quick-holds.md). A hold flagged on this car since it came in (from Flag / hold)
//   still turns the exits into "Close it as held", so the hold he already made is never asked for twice.
// • 🏠 Erin (2026-11-04, migration 164): *"cleaning them goes to their row to be rented at Erin St and not going up for the
//   airport"*. Off the dirties, never +1 on the cleans. The row of four is his: *"M, B, E, Skip"*, under the big Clean.
//   At 412 the words "M hold" / "B hold" wrapped in a quarter-width button (render, 2026-11-04), so the face says
//   M / B and the full name rides on aria-label.
// • Skip is a bump, not a verdict: *"a vehicle in the queue needed to be done ASAP ... skip to do later"*. The empty
//   bay that follows leads with Find a car, because the ASAP car is the next thing he does. Since 2026-10-29 that is
//   the search box itself, in the card (BayFindCar): *"i'm already in the module"*.
// • Every exit is one tap with a 5-second Undo on the note (a wet thumb lands on the neighbour).
// • The car shows as the 🔍 popup shows it, header and damage map (BayCarHeader), looked up live by the row's vehicle_id,
//   so the zones stay on screen for the whole clean: *"did miss marking damage on a few"* (2026-10-30,
//   docs/ticket-bay-log-first-shift-friction.md). A car with no live record falls back to the row's own plate and car line.
// • The odo box (BayOdoBox, since 2026-11-02) shows while the car has no reading from today. Whatever it holds goes out
//   with ANY exit, the reading first: a Clean that says "log 48,213" never closes on a reading that did not save.
//
// • With a car on Next up (docs/ticket-bay-clean-only-and-back-to-next-up.md, 2026-11-03): Clean says it brings that car
//   in, and a quiet "Clean only · X waits" closes this one without pulling — his morning: *"we had to do trips to the
//   airport. So I skipped it to stop the clean."* And "↩ Back to Next up" puts THIS car back in line with no exit (it was
//   not cleaned), asking first when it would bump a different car off the slot.
//
// Mounted with `key={open.id}`, so a box he typed in never carries onto the next car.
import { useState } from 'react';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import type { BayStandbyState } from '../../hooks/useBayStandby';
import { hapticMedium } from '../../lib/haptics';
import { whenOf } from '../../lib/lotBay';
import { bayOdoEntry, bayOdoLetsExit, type BayLeave, type BayLogRow } from '../../lib/lotBayLog';
import { odometerUnitFor } from '../../lib/odometer';
import { businessDateOf } from '../../lib/shiftDay';
import { BayCarHeader } from './BayCarHeader';
import { BayNextUp } from './BayNextUp';
import { BayOdoBox } from './BayOdoBox';

const QUIET_BTN = 'w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm font-semibold text-gray-700 dark:text-gray-200 cursor-pointer touch-manipulation active:scale-[0.98] transition disabled:opacity-40';
const EXIT_BTN = 'min-h-16 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-2 grid justify-items-center content-center gap-0.5 cursor-pointer touch-manipulation active:scale-95 transition disabled:opacity-40';

export interface BayOpenCarProps {
  open: BayLogRow;
  /** Next up's slot (BayInTheBay owns it). */
  next: BayStandbyState;
  /** The empty bay's Start, for BayNextUp. Unused with a car in. */
  onStart: (vehicleId: string) => Promise<string | null>;
  busy: boolean;
  /** Any exit, settled right here. `odometer`: the reading to keep on the row, when there is one. `pull: false`:
   *  Clean only, the car on deck waits. */
  onExit: (kind: BayLeave, odometer?: number, pull?: false) => void;
  /** ↩ Back to Next up. `replace`: he said yes to bumping the car on the slot. */
  onBump: (replace: boolean) => void;
  /** The hold already saved: close the car as held without a second hold. */
  onCloseHeld: (kind: 'mhold' | 'bhold') => void;
  /** The header's tap: the car's record. Back returns here, and the car is still in (the row is the server's). */
  onOpenCar: (vehicleId: string) => void;
}

export function BayOpenCar({ open, next, onStart, busy, onExit, onBump, onCloseHeld, onOpenCar }: BayOpenCarProps) {
  const { holds, vehicles, archivedVehicles, recordOdometer, correctOdometer } = useVehicleHoldContext();
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [odoError, setOdoError] = useState<string | null>(null);
  const [confirmBump, setConfirmBump] = useState(false);
  // The car lined up behind this one (never this car itself: that slot would be stale).
  const waiting = next.standby && next.standby.vehicle_id !== open.vehicle_id ? next.standby : null;
  // A hold flagged on this car since it came in: the form saved it, the close did not land.
  // Compared as instants: the hold's ISO and Postgres' timestamptz text are spelled differently ("Z" vs "+00:00").
  const startedMs = Date.parse(open.started_at);
  const heldSince = holds.find(h => h.vehicleId === open.vehicle_id && Date.parse(h.flaggedAt) >= startedMs);
  const heldKind: 'mhold' | 'bhold' | null = heldSince ? (heldSince.holdTypes.includes('mechanical') ? 'mhold' : 'bhold') : null;
  const tap = (f: () => void) => () => { hapticMedium(); f(); };
  const car = vehicles.find(v => v.id === open.vehicle_id) ?? archivedVehicles.find(v => v.id === open.vehicle_id) ?? null;

  // A reading from today, on the row or on the car (the popup or a correction may have logged it since Start).
  const carToday = car?.odometer != null && !!car.odometerAt && businessDateOf(car.odometerAt) === businessDateOf(new Date()) ? car.odometer : null;
  const readToday = open.odometer ?? carToday;
  const since = `Since ${whenOf(open.started_at)}${readToday != null ? ` · odo ${readToday.toLocaleString('en-CA')}` : ''}`;
  const entry = bayOdoEntry(draft, car?.odometer);
  const showBox = !!car && !heldKind && (readToday == null || draft !== '');
  const held = busy || saving;
  const blocked = held || !bayOdoLetsExit(entry);
  const typed = 'km' in entry ? entry.km : undefined;

  const type = (value: string) => { setDraft(value); setOdoError(null); };
  /** The reading first, when there is a new one; the exit only if it landed. */
  const thenExit = async (go: () => void) => {
    if (entry.kind === 'log') {
      setSaving(true);
      const ok = await recordOdometer(open.vehicle_id, entry.km).catch(() => false);
      setSaving(false);
      if (!ok) { setOdoError('The odo did not save, so the car is still in. Try again, or clear the box to exit without it.'); return; }
    }
    go();
  };
  const leave = (kind: BayLeave, pull?: false) => void thenExit(() => onExit(kind, open.odometer == null ? typed ?? carToday ?? undefined : undefined, pull));
  /** A typed reading is still logged on the car first; the row itself goes, so it keeps none. */
  const bump = (replace: boolean) => void thenExit(() => onBump(replace));
  const correct = async (km: number) => {
    setSaving(true);
    const ok = await correctOdometer(open.vehicle_id, km).catch(() => false);
    setSaving(false);
    setOdoError(ok ? null : 'The correction did not save. Try again.');
  };

  return (
    <section aria-label="In the bay" className="rounded-2xl border-2 border-amber-500 bg-white dark:bg-gray-900 px-4 py-3.5 space-y-3">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">In the bay</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{since}</p>
        </div>
        {car ? (
          <div className="mt-1"><BayCarHeader vehicle={car} onOpen={() => onOpenCar(car.id)} /></div>
        ) : (
          <>
            <p className="mt-1 font-mono text-lg font-bold text-gray-900 dark:text-gray-100">{open.plate}</p>
            {open.car && <p className="text-sm text-gray-600 dark:text-gray-300">{open.car}</p>}
          </>
        )}
      </div>

      {showBox && car && (
        <BayOdoBox draft={draft} onDraft={type} entry={entry} currentKm={car.odometer} currentAt={car.odometerAt} isUs={car.isUs}
          busy={held} error={odoError} onCorrect={km => void correct(km)} />
      )}

      {heldKind ? (
        <button type="button" disabled={busy} onClick={tap(() => onCloseHeld(heldKind))}
          className="w-full rounded-xl bg-fg-yellow hover:bg-fg-yellow-hi py-3.5 text-base font-bold text-black cursor-pointer disabled:opacity-50">
          Held at {whenOf(heldSince!.flaggedAt)}. Close it as held
        </button>
      ) : (
        <>
          <button type="button" disabled={blocked} onClick={tap(() => leave('clean'))}
            className="w-full min-h-16 rounded-xl bg-fg-yellow hover:bg-fg-yellow-hi grid justify-items-center content-center gap-0.5 text-black cursor-pointer touch-manipulation active:scale-[0.98] transition disabled:opacity-50">
            <span className="text-lg font-extrabold">✓ Clean{entry.kind === 'log' ? ` · log ${entry.km.toLocaleString('en-CA')} ${odometerUnitFor(car?.isUs)}` : ''}</span>
            <span className="text-xs font-semibold text-gray-800">Onto the list · +1 Erin St cleans{waiting ? ` · ${waiting.plate} comes in` : ''}</span>
          </button>
          {/* ✈ Clean · sent up (2026-11-10, migration 169): caught up, so the drivers take it the moment it's clean.
              *"Removes a dirty and doesn't +1 the clean so I don't have to -1 when they take it"*. Not a fifth tile:
              the four fill his 412 px. docs/ticket-bay-clean-sent-up-at-exit.md */}
          <button type="button" disabled={blocked} onClick={tap(() => leave('sent'))} className={QUIET_BTN}>
            ✈ Clean · sent up <span className="font-normal text-gray-500 dark:text-gray-400">· −1 dirty, no clean</span>
          </button>
          {waiting && (
            <button type="button" disabled={blocked} onClick={tap(() => leave('clean', false))} className={QUIET_BTN}>
              ✓ Clean only · {waiting.plate} waits
            </button>
          )}
          <div className="grid grid-cols-4 gap-1.5">
            <button type="button" disabled={blocked} onClick={tap(() => leave('mhold'))} className={EXIT_BTN} aria-label="M hold · Mechanical">
              <span className="text-sm font-extrabold text-amber-800 dark:text-amber-300">🔧 M</span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">Mechanical</span>
            </button>
            <button type="button" disabled={blocked} onClick={tap(() => leave('bhold'))} className={EXIT_BTN} aria-label="B hold · Damage">
              <span className="text-sm font-extrabold text-red-700 dark:text-red-400">⚠️ B</span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">Damage</span>
            </button>
            <button type="button" disabled={blocked} onClick={tap(() => leave('erin'))} className={EXIT_BTN} aria-label="🏠 Erin · Local row">
              <span className="text-sm font-extrabold text-green-700 dark:text-green-400">🏠 Erin</span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">Local row</span>
            </button>
            <button type="button" disabled={blocked} onClick={tap(() => leave('skip'))} className={EXIT_BTN} aria-label="Skip · ASAP first">
              <span className="text-sm font-extrabold text-blue-700 dark:text-blue-400">↷ Skip</span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">ASAP first</span>
            </button>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">M hold and B hold mark the list. Flag it from the list when you have a minute.</p>
          {confirmBump && waiting ? (
            <div role="group" aria-label="Replace on deck" className="rounded-xl border-2 border-amber-400 dark:border-amber-500 px-3 py-2 space-y-2">
              <p className="text-sm text-gray-800 dark:text-gray-100">{waiting.plate} is on deck. Put {open.plate} there instead? {waiting.plate} comes off.</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={blocked} onClick={tap(() => { setConfirmBump(false); bump(true); })} className={QUIET_BTN}>Replace {waiting.plate}</button>
                <button type="button" onClick={() => setConfirmBump(false)} className={QUIET_BTN}>Keep {waiting.plate}</button>
              </div>
            </div>
          ) : (
            <button type="button" disabled={blocked} onClick={tap(() => (waiting ? setConfirmBump(true) : bump(false)))} className={QUIET_BTN}>
              ↩ Back on deck · not cleaned
            </button>
          )}
        </>
      )}
      <BayNextUp next={next} inBay={open.plate} onStart={onStart} />
    </section>
  );
}
