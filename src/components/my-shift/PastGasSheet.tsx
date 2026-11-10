// ⛽ A past gas sheet, entered on ITS day (migration 168, docs/ticket-odometer-history-and-past-gas-sheet.md). Aaron,
// 2026-11-09: *"I select a date and whatever I enter would write to that date"*; the car's odo stays the newest
// reading (*"keep the todays reading as the current"*); and the sheet's photo pinned above the rows.
// The card on My Shift opens a full screen: the day, the photo, then plate / unit → odo → Enter, row after row.
import { useMemo, useRef, useState } from 'react';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { usePastGasSheet } from '../../hooks/usePastGasSheet';
import { dayLabel, isSheetDay, matchSheetCar, parseOdo, winnipegDay } from '../../lib/sheetDay';
import { vehicleNameText } from '../../lib/vehicleName';
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
  const [typed, setTyped] = useState('');
  const [odoText, setOdoText] = useState('');
  const plateRef = useRef<HTMLInputElement>(null);

  const match = typed.trim() ? matchSheetCar(typed, cars) : null;
  const odo = parseOdo(odoText);
  const dayOk = isSheetDay(day, openedAt);
  const ready = dayOk && match?.kind === 'one' && odo != null;

  const submit = () => {
    if (!ready || match?.kind !== 'one' || odo == null) return;
    sheet.add(match.car, odo, day);
    setTyped('');
    setOdoText('');
    plateRef.current?.focus();
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
          <div className="flex gap-2">
            <input ref={plateRef} value={typed} onChange={e => setTyped(e.target.value)} placeholder="Plate or unit"
              aria-label="Plate or unit" autoCapitalize="characters" autoComplete="off" className={`${INPUT} flex-[3]`} />
            <input value={odoText} onChange={e => setOdoText(e.target.value)} placeholder="Odo" aria-label="Odo"
              inputMode="numeric" autoComplete="off" className={`${INPUT} flex-[2] font-mono tabular-nums`} />
          </div>
          <p className="text-xs min-h-4 text-gray-500 dark:text-gray-400" aria-live="polite">
            {match?.kind === 'one' && `${vehicleNameText(match.car)} · ${match.car.licensePlate}${match.car.archivedAt ? ' · archived' : ''}`}
            {match?.kind === 'many' && `${match.cars.length} cars match. Type the full plate.`}
            {match?.kind === 'none' && typed.trim().length >= 3 && 'FG has no car by that plate or unit.'}
            {odoText && odo == null && ' That odo isn’t a number.'}
          </p>
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
