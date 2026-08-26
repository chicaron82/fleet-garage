import { useState } from 'react';
import { FuelLevelSelector, FUEL_LABELS } from '../shared/FuelLevelSelector';
import { useAirportFlip } from '../../hooks/useAirportFlip';
import type { Vehicle } from '../../types';

// Flip a return without scanning it twice.
//
// Aaron, 2026-08-26: *"we could even use this to check-in/airport flip too right. odo/keys already
// captured. so add a button to flip which captures fuel via slider and notes. submit. then it adds
// to the list of units flipped."*
//
// ⭐ IT REMOVES A DUPLICATE CAPTURE, NOT A TAP. This sheet already holds plate, unit, rental class,
// keys and — since migration 123 — the odometer. Flipping the same car meant opening
// AirportFlipSection's OWN scanner, reading the tag a second time, and typing the odometer in
// again. He now meets every car through the header scan, so that second scanner is a surface he has
// to remember to prefer.
//
// ⚠️ NOT A MENU ACTION, DELIBERATELY. scanRouterActions carries a documented law — "it is a ROUTE,
// not a write: the overlay still only routes… that's what keeps the thin-hub law intact rather than
// bent" — and every entry there requires a `screen`. So this sits with the in-place capture rows
// (keys, odometer, EV kit), which is the pattern that already writes from this sheet, and is also
// exactly what he described: submit here, no navigation.
//
// ⚠️ NO DAMAGED TOGGLE, by his ruling: *"if it's damaged I'd tap the flag hold after capturing the
// odo."* The flip row still carries the field; this door simply never sets it, because he has a
// better path for damage and a second one would compete with it.
export function ScanFlipCapture({ vehicle, rentalClass }: {
  vehicle: Vehicle;
  /** Off the tag this scan — the flip list tallies classes turned around. Falls back to the record
   *  so a legible record still counts when the tag's class corner wasn't readable. */
  rentalClass: string;
}) {
  const flip = useAirportFlip();
  const [open, setOpen] = useState(false);
  const [fuelLevel, setFuelLevel] = useState<number | null>(null);
  const [batteryPct, setBatteryPct] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [added, setAdded] = useState(false);

  const isEv = vehicle.isTesla === true;
  // ⚠️ The odometer is whatever the sheet already saved — free text on the flip row by design
  // ("no unit assumed; miles vs km is the counter's to know"), and the counter searches by plate
  // anyway. Blank rather than invented when FG has none: an odo nobody read is not a zero.
  const odo = vehicle.odometer != null ? String(vehicle.odometer) : '';
  const level = isEv
    ? (batteryPct.trim() ? `${batteryPct.trim().replace(/%+$/, '')}%` : '')
    : (fuelLevel !== null ? FUEL_LABELS[fuelLevel] : '');

  const submit = () => {
    flip.add({
      plate: vehicle.licensePlate, unit: vehicle.unitNumber ?? null,
      rentalClass, odo, fuel: level, isEv, damaged: false, notes: notes.trim(),
    });
    setAdded(true);
    setOpen(false);
    setFuelLevel(null); setBatteryPct(''); setNotes('');
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); setAdded(false); }}
        data-testid="scan-flip-open"
        className="mt-1 h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:border-fg-yellow cursor-pointer transition"
      >
        {/* Says what it already knows, so he can see there is nothing to re-enter. */}
        🛫 Flip for the counter{added ? ' — added ✓' : odo ? ` · odo ${odo}` : ''}
      </button>
    );
  }

  return (
    <div className="mt-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-2 space-y-2"
         data-testid="scan-flip-capture">
      {isEv ? (
        <label className="block text-xs text-gray-600 dark:text-gray-400">
          Charge %
          <input
            value={batteryPct}
            onChange={e => setBatteryPct(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
            inputMode="numeric" placeholder="67"
            aria-label="Battery charge percent"
            className="mt-1 h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-gray-100"
          />
        </label>
      ) : (
        <FuelLevelSelector fuelLevel={fuelLevel} setFuelLevel={setFuelLevel} />
      )}

      <input
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="anything the counter should know"
        aria-label="Note for the counter"
        className="h-11 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-gray-100"
      />

      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)}
          className="h-11 flex-1 rounded-lg border border-gray-300 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400 cursor-pointer">
          Cancel
        </button>
        {/* ⭐ Submittable with NOTHING filled in, on purpose. The flip's job is telling the counter
            this car is back; fuel and a note are what he adds when he has them. Gating on a fuel
            reading would make an unreadable gauge block the whole return. */}
        <button type="button" onClick={submit} data-testid="scan-flip-submit"
          className="h-11 flex-1 rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi px-4 text-xs font-semibold text-black cursor-pointer transition">
          Add to flip list
        </button>
      </div>
    </div>
  );
}
