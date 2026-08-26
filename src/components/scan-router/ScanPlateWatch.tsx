import type { PlateWatch } from '../../lib/plateWatch';

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
export function ScanPlateWatch({ watch, onClear, clearing }: {
  watch: PlateWatch;
  onClear: () => void;
  clearing?: boolean;
}) {
  return (
    <div
      className="rounded-xl border-2 border-red-500 bg-red-50 px-3 py-2.5 dark:border-red-500 dark:bg-red-950/50"
      role="alert"
      data-testid="scan-plate-watch"
    >
      <p className="text-sm font-bold text-red-700 dark:text-red-300">
        ✋ HOLD THIS CAR — <span className="font-mono">{watch.plate}</span> is on watch
      </p>
      {watch.reason && (
        <p className="mt-0.5 text-xs text-red-800 dark:text-red-200">{watch.reason}</p>
      )}
      <button
        type="button"
        onClick={onClear}
        disabled={clearing}
        /* Clearing lives HERE because the moment he has acted on it is the moment it is in front
           of him. Sending him to a settings screen to tick it off is how a board goes stale. */
        className="mt-2 h-9 rounded-lg border border-red-300 px-3 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/40 cursor-pointer transition"
      >
        {clearing ? 'Clearing…' : 'Done — take it off watch'}
      </button>
    </div>
  );
}
