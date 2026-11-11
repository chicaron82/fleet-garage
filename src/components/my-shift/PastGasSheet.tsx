// ⛽ A past gas sheet, entered on ITS day (migration 168, docs/ticket-odometer-history-and-past-gas-sheet.md). Aaron,
// 2026-11-09: *"I select a date and whatever I enter would write to that date"*; the car's odo stays the newest
// reading (*"keep the todays reading as the current"*); and the sheet's photo pinned above the rows.
// The card on My Shift opens a full screen: the day, the photo, then plate / unit → odo → Enter, row after row.
// ⭐ The car is found with FG's ONE typed lookup (VehicleLookup: suggestions as he types, plate or unit, O/0 folded).
// It shipped with an exact-match box of its own, and on its first real use he typed a plate and got nothing: *"the
// field doesn't behave like the other searches so no matching results coming up"* (2026-11-10).
import { useMemo, useState } from 'react';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { usePastGasSheet } from '../../hooks/usePastGasSheet';
import { dayLabel, isSheetDay, parseOdo, winnipegDay, type SheetCar } from '../../lib/sheetDay';
import { vehicleForPick } from '../../lib/lotBayLog';
import { VehicleLookup } from '../shared/VehicleLookup';
import { VehicleName } from '../shared/VehicleName';
import { SheetPhotoPin } from './SheetPhotoPin';
import { SheetRowsList } from './SheetRowsList';

const INPUT = 'w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-base';

export function PastGasSheet() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid="past-gas-sheet-card"
        className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 cursor-pointer">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">⛽ Past gas sheet</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">Enter an older sheet's odos on the day it was written</p>
      </button>
      {open && <PastGasSheetScreen onClose={() => setOpen(false)} />}
    </>
  );
}

export function PastGasSheetScreen({ onClose }: { onClose: () => void }) {
  const { vehicles, archivedVehicles } = useVehicleHoldContext();
  const cars = useMemo(() => [...vehicles, ...archivedVehicles], [vehicles, archivedVehicles]);
  const sheet = usePastGasSheet();
  // The screen's own "now", taken once as it opens (a sheet session lasts minutes, never past a day).
  const [openedAt] = useState(() => Date.now());
  const today = winnipegDay(openedAt);
  const [day, setDay] = useState(() => winnipegDay(openedAt - 86_400_000));
  const [car, setCar] = useState<SheetCar | null>(null);
  const [missed, setMissed] = useState<string | null>(null);
  // A fresh lookup after each saved row: remounted, so its typed text clears and it takes the focus back.
  const [lookupKey, setLookupKey] = useState(0);
  const [odoText, setOdoText] = useState('');

  const odo = parseOdo(odoText);
  const dayOk = isSheetDay(day, openedAt);
  const ready = dayOk && car != null && odo != null;

  const submit = () => {
    if (!ready || !car || odo == null) return;
    sheet.add(car, odo, day);
    setCar(null);
    setOdoText('');
    setLookupKey(k => k + 1);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-50 dark:bg-gray-950" role="dialog" aria-label="Past gas sheet">
      <div className="max-w-lg mx-auto px-4 pb-10 space-y-3">
        <div className="flex items-center justify-between pt-4 pb-1">
          <button type="button" onClick={onClose} className="text-sm font-semibold text-gray-600 dark:text-gray-300 cursor-pointer">← Done</button>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">⛽ Past gas sheet</p>
          <span className="w-12" />
        </div>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Sheet date</span>
          <div className="flex items-center gap-3">
            <input type="date" value={day} max={today} onChange={e => setDay(e.target.value)} className={`${INPUT} flex-1 dark:[color-scheme:dark]`} />
            {dayOk && <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">{dayLabel(day)}</span>}
          </div>
          {!dayOk && day && <span className="text-xs text-amber-700 dark:text-amber-400">Today or an earlier day.</span>}
        </label>

        <SheetPhotoPin />

        <form onSubmit={e => { e.preventDefault(); submit(); }} className="space-y-1.5">
          {!car ? (
            <>
              <VehicleLookup key={lookupKey} inlineResults autoFocus={lookupKey > 0} placeholder="Plate or unit"
                onPick={c => {
                  const found = vehicleForPick(cars, 'vehicle' in c ? { plate: c.vehicle.license_plate, unit: c.vehicle.unit_number } : c);
                  setMissed(found ? null : 'typed' in c ? c.typed : c.vehicle.license_plate);
                  setCar(found);
                }} />
              {missed && <p className="text-xs text-amber-700 dark:text-amber-400"><span className="font-semibold">{missed}</span> isn&apos;t a car in FG. Skip it, or register it from 🔍 Find a car.</p>}
            </>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2" data-testid="sheet-car">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-base font-bold text-gray-900 dark:text-gray-100">
                  {car.licensePlate}{car.unitNumber && <span className="ml-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Unit {car.unitNumber}</span>}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-300 truncate"><VehicleName vehicle={car} />{car.archivedAt ? ' · archived' : ''}</p>
              </div>
              <button type="button" onClick={() => { setCar(null); setLookupKey(k => k + 1); }}
                className="shrink-0 px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 cursor-pointer">Change</button>
            </div>
          )}
          <input value={odoText} onChange={e => setOdoText(e.target.value)} placeholder="Odo" aria-label="Odo" autoFocus={car != null}
            key={car?.id ?? 'no-car'} inputMode="numeric" enterKeyHint="done" autoComplete="off" className={`${INPUT} font-mono tabular-nums`} />
          {odoText && odo == null && <p className="text-xs text-amber-700 dark:text-amber-400">That odo isn&apos;t a number.</p>}
          <button type="submit" disabled={!ready}
            className="w-full py-2.5 rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-40 text-black text-sm font-semibold cursor-pointer disabled:cursor-not-allowed">
            Save to {dayOk ? dayLabel(day) : 'the sheet day'}
          </button>
        </form>

        <SheetRowsList rows={sheet.rows} onUndo={r => void sheet.undo(r)} onSaveAnyway={sheet.saveAnyway} onRetry={sheet.retry} />
      </div>
    </div>
  );
}
