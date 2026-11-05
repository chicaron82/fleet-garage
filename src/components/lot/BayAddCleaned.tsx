// + Add a car already cleaned, under today's bay list. Aaron, 2026-11-05, on break with his partner cleaning solo:
// *"something to add his solo cleans to the list of what got cleaned in my 30min off the floor"*, then *"just a way to
// add them in if needed is enough"*. Ticket: docs/ticket-bay-add-a-car-cleaned.md.
//
// • The bay card's search (VehicleLookup, Recent under it), here on the list, because it works whatever is in the bay:
//   after a break the car his partner is on is usually still in it, and Find a car only shows in an EMPTY bay.
// • One tap adds it as a Clean, +1 on Erin St's cleans like any Clean. It goes on the list stamped when he adds it, and
//   says "added later" (bayLines), so the time is never read as when it was washed.
// • No name, no "solo", no count of the window: it's the bay's list. The parent's note carries the Undo.
// • ⚠️ No autoFocus, the bay card's rule: a keyboard that jumps up covers the list he is reading.
import { useState } from 'react';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useLookupRecents } from '../../hooks/useLookupRecents';
import { vehicleForPick } from '../../lib/lotBayLog';
import { VehicleLookup } from '../shared/VehicleLookup';
import { VehicleName } from '../shared/VehicleName';

const QUIET_BTN = 'w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm font-semibold text-gray-700 dark:text-gray-200 cursor-pointer touch-manipulation active:scale-[0.98] transition disabled:opacity-40';

/** `onAdd`: true when the car landed on the list (the parent says so, with an Undo); false keeps the card open.
 *  `onMore`: the full 🔍 popup, for a key FG cannot place. */
export function BayAddCleaned({ onAdd, onMore }: { onAdd: (vehicleId: string, plate: string) => Promise<boolean>; onMore: () => void }) {
  const { vehicles, archivedVehicles } = useVehicleHoldContext();
  const { recents, record } = useLookupRecents(true);
  const [open, setOpen] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [missed, setMissed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fleet = [...vehicles, ...archivedVehicles];
  const car = pickedId ? fleet.find(v => v.id === pickedId) ?? null : null;
  const close = () => { setOpen(false); setPickedId(null); setMissed(null); };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={QUIET_BTN}>
        + Add a car already cleaned
      </button>
    );
  }

  const add = async () => {
    if (!car) return;
    setBusy(true);
    const ok = await onAdd(car.id, car.licensePlate);
    setBusy(false);
    if (ok) close();
  };

  return (
    <section aria-label="Add a car already cleaned" className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-gray-600 dark:text-gray-300">Add a car already cleaned</p>
        <button type="button" onClick={close} className="min-h-8 px-1 text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer">Cancel</button>
      </div>
      {car ? (
        <>
          <button type="button" onClick={() => setPickedId(null)}
            className="-mb-1 text-xs font-semibold text-gray-600 dark:text-gray-300 underline-offset-2 hover:underline cursor-pointer">
            ← Different car
          </button>
          <div>
            <p className="font-mono text-lg font-bold text-gray-900 dark:text-gray-100">
              {car.licensePlate}{car.unitNumber && <span className="ml-2 text-sm font-semibold text-gray-500 dark:text-gray-400">Unit {car.unitNumber}</span>}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300"><VehicleName vehicle={car} />{car.color ? ` · ${car.color}` : ''}</p>
          </div>
          <button type="button" disabled={busy} onClick={() => void add()}
            className="w-full min-h-14 rounded-xl bg-fg-yellow hover:bg-fg-yellow-hi grid justify-items-center content-center gap-0.5 text-black cursor-pointer touch-manipulation active:scale-[0.98] transition disabled:opacity-50">
            <span className="text-base font-extrabold">✓ Add as clean</span>
            <span className="text-xs font-semibold text-gray-800">Onto the list, added later · +1 Erin St cleans</span>
          </button>
        </>
      ) : (
        <>
          <VehicleLookup inlineResults recents={recents} placeholder="Plate or unit"
            onPick={c => {
              const found = vehicleForPick(fleet, 'vehicle' in c ? { plate: c.vehicle.license_plate, unit: c.vehicle.unit_number } : c);
              setMissed(found ? null : 'typed' in c ? c.typed : c.vehicle.license_plate);
              if (found) { setPickedId(found.id); void record(found.id); }
            }} />
          {missed && (
            <button type="button" onClick={onMore}
              className="w-full rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-left text-xs text-amber-900 dark:text-amber-200 cursor-pointer">
              <span className="font-semibold">{missed}</span> isn&apos;t a car in FG. Open 🔍 Find a car to register it or look again →
            </button>
          )}
        </>
      )}
    </section>
  );
}
