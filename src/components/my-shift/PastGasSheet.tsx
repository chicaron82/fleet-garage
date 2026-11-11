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
import { dayLabel, isSheetDay, odoFit, parseOdo, winnipegDay, type SheetCar } from '../../lib/sheetDay';
import { useSheetNeighbours } from '../../hooks/useSheetNeighbours';
import { SheetCarCard } from './SheetCarCard';
import { vehicleForPick } from '../../lib/lotBayLog';
import { VehicleLookup } from '../shared/VehicleLookup';
import { SheetPhotoPin } from './SheetPhotoPin';
import { SheetRowsList } from './SheetRowsList';

const INPUT = 'w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-base';

/**
 * ⭐ A SECTION of My Shift, opened in place like the key-tag audit, never a screen of its own. Aaron, 2026-11-10: *"why
 * does it open like its separate from FG. i feel like it's something that should be integrated in. like the key audit"*.
 * Collapsing it only hides it: the day, the picked car and the rows entered so far all stay.
 */
export function PastGasSheet() {
  const [open, setOpen] = useState(false);
  const sheet = usePastGasSheet();
  const saved = sheet.rows.filter(r => r.state === 'done' && r.result?.status === 'saved').length;
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-colors" data-testid="past-gas-sheet">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} data-testid="past-gas-sheet-card"
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer">
        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
          ⛽ Past gas sheet
          {saved > 0 && <span className="ml-2 font-semibold text-gray-400 tabular-nums">{saved} saved</span>}
        </span>
        <span className="text-xs text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      <div className={open ? 'border-t border-gray-100 dark:border-gray-800 px-4 py-3 space-y-3' : 'hidden'}>
        <p className="text-xs text-gray-500 dark:text-gray-400">An older sheet&apos;s odos, filed on the day it was written. The car&apos;s odo only moves if the sheet is its newest reading.</p>
        <PastGasSheetBody sheet={sheet} />
      </div>
    </div>
  );
}

export function PastGasSheetBody({ sheet }: { sheet: ReturnType<typeof usePastGasSheet> }) {
  const { vehicles, archivedVehicles } = useVehicleHoldContext();
  const cars = useMemo(() => [...vehicles, ...archivedVehicles], [vehicles, archivedVehicles]);
  // The section's own "now", taken once as My Shift opens (a sheet session lasts minutes, never past a day).
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
  const near = useSheetNeighbours(car?.id ?? null, day);
  // ⭐ His guard: an odo that doesn't fit the readings either side holds Save until he says save anyway.
  const misfit = odo != null && near.state === 'ready' && odoFit(odo, near.before, near.after).kind !== 'ok';
  const ready = dayOk && car != null && odo != null;

  const submit = (force = false) => {
    if (!ready || !car || odo == null || (misfit && !force)) return;
    sheet.add(car, odo, day, force);
    setCar(null);
    setOdoText('');
    setLookupKey(k => k + 1);
  };

  return (
    <>
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
          <SheetCarCard car={car} near={near} odo={odo} onChange={() => { setCar(null); setLookupKey(k => k + 1); }} />
        )}
        <input value={odoText} onChange={e => setOdoText(e.target.value)} placeholder="Odo" aria-label="Odo" autoFocus={car != null}
          key={car?.id ?? 'no-car'} inputMode="numeric" enterKeyHint="done" autoComplete="off" className={`${INPUT} font-mono tabular-nums`} />
        {odoText && odo == null && <p className="text-xs text-amber-700 dark:text-amber-400">That odo isn&apos;t a number.</p>}
        <button type="submit" disabled={!ready || misfit}
          className="w-full py-2.5 rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-40 text-black text-sm font-semibold cursor-pointer disabled:cursor-not-allowed">
          Save to {dayOk ? dayLabel(day) : 'the sheet day'}
        </button>
        {ready && misfit && (
          <button type="button" onClick={() => submit(true)}
            className="w-full py-2 rounded-lg border border-amber-400 text-amber-800 dark:text-amber-300 text-xs font-semibold cursor-pointer">
            The sheet is right: save anyway
          </button>
        )}
      </form>

      <SheetRowsList rows={sheet.rows} onUndo={r => void sheet.undo(r)} onSaveAnyway={sheet.saveAnyway} onRetry={sheet.retry} />
    </>
  );
}
