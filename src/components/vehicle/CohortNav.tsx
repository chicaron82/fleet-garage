// Walk the worklist without leaving the record.
//
// ⭐ It renders ONLY when a list actually travelled with the route. Aaron asked for this while
// double-checking held cars — "this way I don't need to go back and find the next one to check" —
// and the arrows are only useful if "next" means the next car in the list he was just looking at.
// Arriving from a scan or a bookmark, there is no such list, and an arrow that does not know what
// it is cycling through is worse than no arrow. See lib/vehicleCohort.
import { cohortStep } from '../../lib/vehicleCohort';

const BTN = 'px-2 py-1 rounded-md text-sm text-gray-500 dark:text-gray-400 disabled:opacity-30 '
  + 'enabled:hover:bg-gray-100 dark:enabled:hover:bg-gray-800 enabled:cursor-pointer';

export function CohortNav({ cohort, vehicleId, onOpenVehicle }: {
  cohort?: string[];
  vehicleId: string;
  onOpenVehicle?: (vehicleId: string) => void;
}) {
  const step = cohortStep(cohort, vehicleId);
  if (step.total === 0 || !onOpenVehicle) return null;

  return (
    <div className="ml-auto flex items-center gap-1" data-testid="cohort-nav">
      <button type="button" aria-label="Previous vehicle" disabled={!step.prevId} className={BTN}
              onClick={() => step.prevId && onOpenVehicle(step.prevId)}>‹</button>
      {/* Position, not just direction — it doubles as progress through the check. */}
      <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 tabular-nums">
        {step.index} of {step.total}
      </span>
      <button type="button" aria-label="Next vehicle" disabled={!step.nextId} className={BTN}
              onClick={() => step.nextId && onOpenVehicle(step.nextId)}>›</button>
    </div>
  );
}
