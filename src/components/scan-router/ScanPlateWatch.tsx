import { isErrand, type PlateWatch } from '../../lib/plateWatch';

// The ambush. A plate on the board stops him at the scan, before anything else on the sheet.
//
// Aaron, 2026-08-26: *"can I add a license plate to watch for? it doesn't exist in FG. so if I
// scanned it, it would tell me to hold it."*
//
// ⭐ IT LEADS THE SHEET, ABOVE THE VEHICLE BLOCK, AND RENDERS WITH OR WITHOUT A VEHICLE. Both halves
// matter. Leading, because a watch is the one thing that changes what he does with the car in his
// hand — reading it after the status line is reading it too late. And vehicle-independently,
// because the car this exists for is the one FG has never seen: on an unresolved read the rest of
// this sheet has nothing to say and would otherwise walk him straight to "register it".
//
// ⚠️ His words, verbatim, not a reason code. The board said "HOLD PLS. THX" and that is what he
// needs to see — a dropdown label would lose the thing that makes it actionable.
//
// ⭐ TWO KINDS (migration 158, 2026-10-21). A HOLD stops the car: red, "HOLD THIS CAR". An ERRAND is
// something to do while he's at it — the expired registrations in the glovebox, swapped for the new
// MPI cards. The car stays rentable, so it gets the amber of the geotab note he pointed at ("Like how
// geotab cars work"), and never the word HOLD. Same spot on the sheet and same clear: he still has to
// see it before he walks away from the car.
export function ScanPlateWatch({ watch, onClear, clearing }: {
  watch: PlateWatch;
  onClear: () => void;
  clearing?: boolean;
}) {
  const errand = isErrand(watch);
  return (
    <div
      className={errand
        ? 'rounded-xl border-2 border-amber-400 bg-amber-50 px-3 py-2.5 dark:border-amber-600 dark:bg-amber-950/40'
        : 'rounded-xl border-2 border-red-500 bg-red-50 px-3 py-2.5 dark:border-red-500 dark:bg-red-950/50'}
      role="alert"
      data-testid="scan-plate-watch"
    >
      {errand ? (
        <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
          📋 TO DO AT THIS CAR — <span className="font-mono">{watch.plate}</span>
        </p>
      ) : (
        <p className="text-sm font-bold text-red-700 dark:text-red-300">
          ✋ HOLD THIS CAR — <span className="font-mono">{watch.plate}</span> is on watch
        </p>
      )}
      {watch.reason && (
        <p className={errand ? 'mt-0.5 text-xs text-amber-900 dark:text-amber-200' : 'mt-0.5 text-xs text-red-800 dark:text-red-200'}>{watch.reason}</p>
      )}
      <button
        type="button"
        onClick={onClear}
        disabled={clearing}
        /* Clearing lives HERE because the moment he has acted on it is the moment it is in front
           of him. Sending him to a settings screen to tick it off is how a board goes stale. */
        className={errand
          ? 'mt-2 h-9 rounded-lg border border-amber-300 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-40 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/40 cursor-pointer transition'
          : 'mt-2 h-9 rounded-lg border border-red-300 px-3 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/40 cursor-pointer transition'}
      >
        {clearing ? 'Clearing…' : 'Done — take it off watch'}
      </button>
    </div>
  );
}
