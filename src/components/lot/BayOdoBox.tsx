// The odo box on the car in the bay. Aaron, 2026-11-02: *"say i started cleaning before entering the odo, how bout entering
// the odo when a cleaning has started then logging it stops the clean"*. On a passenger-side day he first sees the dash
// when he takes the car out to park, and that is the end of the clean, so the reading and the close are one tap. So this
// box has no button of its own: the card's yellow Clean says what it will log. Ticket: docs/ticket-bay-odo-in-card-and-next-up.md.
//
// Optional, as the Start is: plain Clean still works with the box empty and the gas sheet backfills it.
// A lower reading has the same two answers OdometerCapture gives it: look again, or the record is wrong.
import { centreAfterKeypad } from '../../lib/centreAfterKeypad';
import { checkOdometerJump, describeOdometer, odometerUnitFor } from '../../lib/odometer';
import type { BayOdoEntry } from '../../lib/lotBayLog';
import { DigitsInput } from '../shared/VehicleFields';

const NOTE = 'text-[11px]';

export function BayOdoBox({ draft, onDraft, entry, currentKm, currentAt, isUs, busy, error, onCorrect }: {
  draft: string;
  onDraft: (value: string) => void;
  entry: BayOdoEntry;
  currentKm: number | null | undefined;
  currentAt: string | null | undefined;
  isUs: boolean | undefined;
  busy: boolean;
  /** A write that did not land, said here because the car stays in the bay. */
  error: string | null;
  onCorrect: (km: number) => void;
}) {
  const unit = odometerUnitFor(isUs);
  const on = (km: number) => `${km.toLocaleString('en-CA')} ${unit}`;
  const jump = entry.kind === 'log' ? checkOdometerJump(entry.km, currentKm, currentAt, new Date(), unit) : null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-xs text-gray-500 dark:text-gray-400">
          🧭 {currentKm != null ? describeOdometer(currentKm, currentAt, new Date(), unit) : 'Odometer not logged'}
        </span>
        <DigitsInput value={draft} onValueChange={onDraft} onFocus={e => centreAfterKeypad(e.currentTarget)}
          placeholder={unit} aria-label="Odometer reading" disabled={busy}
          className="w-24 h-11 shrink-0 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow" />
      </div>
      {entry.kind === 'empty' && <p className={`${NOTE} text-gray-500 dark:text-gray-400`}>Optional. Type it when you park, and Clean logs it.</p>}
      {jump && <p className={`${NOTE} text-amber-700 dark:text-amber-400`}>⚠️ {jump.detail}</p>}
      {entry.kind === 'same' && <p className={`${NOTE} text-gray-500 dark:text-gray-400`}>Already on file at {on(entry.km)}. Nothing to log.</p>}
      {entry.kind === 'unreadable' && <p className={`${NOTE} font-semibold text-red-600 dark:text-red-400`}>That isn&apos;t a reading. Fix it, or clear the box to exit without it.</p>}
      {entry.kind === 'lower' && (
        <>
          <p className={`${NOTE} font-semibold text-red-600 dark:text-red-400`}>Lower than the {on(currentKm ?? 0)} on file. Check the reading, or clear the box to exit without it.</p>
          <button type="button" disabled={busy} onClick={() => onCorrect(entry.km)}
            className="w-full h-11 px-4 rounded-lg border border-amber-400 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-500/10 text-xs font-semibold text-amber-800 dark:text-amber-300 disabled:opacity-40 cursor-pointer transition">
            The record is wrong. Correct it to {on(entry.km)}
          </button>
        </>
      )}
      {error && <p role="alert" className={`${NOTE} font-semibold text-red-600 dark:text-red-400`}>{error}</p>}
    </div>
  );
}
