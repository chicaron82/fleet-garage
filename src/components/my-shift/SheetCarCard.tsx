// The picked car on a past gas sheet, with its readings either side of the sheet day and how the typed odo fits them
// (Aaron, 2026-11-10: *"show the odo reading before the date i'm entering for ... guard against an odo that's higher
// than the later date"*). The fit is said as he types; the screen holds Save on a misfit until he says save anyway.
import { VehicleName } from '../shared/VehicleName';
import { dayOfInstant, km, odoFit, type SheetCar } from '../../lib/sheetDay';
import type { SheetNeighbours } from '../../hooks/useSheetNeighbours';

export function SheetCarCard({ car, near, odo, onChange }: {
  car: SheetCar; near: SheetNeighbours; odo: number | null; onChange: () => void;
}) {
  const fit = odo != null && near.state === 'ready' ? odoFit(odo, near.before, near.after) : null;
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 space-y-1.5" data-testid="sheet-car">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-base font-bold text-gray-900 dark:text-gray-100">
            {car.licensePlate}{car.unitNumber && <span className="ml-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Unit {car.unitNumber}</span>}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-300 truncate"><VehicleName vehicle={car} />{car.archivedAt ? ' · archived' : ''}</p>
        </div>
        <button type="button" onClick={onChange}
          className="shrink-0 px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 cursor-pointer">Change</button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-xs" data-testid="sheet-neighbours">
        {near.state === 'loading' && <dd className="col-span-2 text-gray-400">Reading its odo history…</dd>}
        {near.state === 'failed' && <dd className="col-span-2 text-amber-700 dark:text-amber-400">Couldn&apos;t read its odo history. Saving still checks it.</dd>}
        {near.state === 'ready' && (
          <>
            <dt className="text-gray-500 dark:text-gray-400">Before</dt>
            <dd className="font-mono tabular-nums text-gray-800 dark:text-gray-200">{near.before ? `${km(near.before.km)} · ${dayOfInstant(near.before.at)}` : 'none on file'}</dd>
            <dt className="text-gray-500 dark:text-gray-400">After</dt>
            <dd className="font-mono tabular-nums text-gray-800 dark:text-gray-200">{near.after ? `${km(near.after.km)} · ${dayOfInstant(near.after.at)}` : 'none on file'}</dd>
          </>
        )}
      </dl>
      {fit && (
        <p role={fit.kind === 'ok' ? undefined : 'alert'} data-testid="sheet-fit"
          className={`text-xs font-semibold ${fit.kind === 'ok' ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
          {fit.kind === 'low' && `Lower than ${dayOfInstant(near.before!.at)}'s ${km(near.before!.km)}. A misread?`}
          {fit.kind === 'high' && `Higher than ${dayOfInstant(near.after!.at)}'s ${km(near.after!.km)}. A misread, or the trip meter?`}
          {fit.kind === 'ok' && (fit.since != null ? `✓ Fits: +${km(fit.since)} km since ${dayOfInstant(near.before!.at)}` : '✓ Fits')}
        </p>
      )}
    </div>
  );
}
