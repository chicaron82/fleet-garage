// The front door to the damage-zone backfill run — and it is deliberately temporary.
//
// ⭐ IT DISAPPEARS WHEN THE JOB IS DONE. The queue is finite (251 standing holds carried no zones
// the day this shipped), so a permanent nav slot would outlive the task and become clutter. A card
// that renders only while there is work left is the honest shape for a finite job.
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { zoneBackfillQueue } from '../../lib/damageZones';

const CARD = 'rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900';

export function ZoneBackfillCard({ onOpen }: { onOpen: () => void }) {
  const { holds, allVehicles } = useVehicleHoldContext();
  // The unit number carries the mock-row tell, so the count has to see it too — otherwise the card
  // and the run would disagree about how much work is left.
  const left = zoneBackfillQueue(
    holds.map(h => ({ ...h, unitNumber: allVehicles.find(v => v.id === h.vehicleId)?.unitNumber ?? null })),
    () => 0,
  ).length;
  if (left === 0) return null;

  return (
    <button type="button" onClick={onOpen} data-testid="zone-backfill-card"
            className={`${CARD} w-full px-4 py-3.5 flex items-center gap-3 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 transition`}>
      <span className="text-xl leading-none">🚗</span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
          {left} hold{left === 1 ? '' : 's'} with no damage zone recorded
        </span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">
          Tag where the damage sits — the notes and photos are already there
        </span>
      </span>
      <span className="text-gray-300 dark:text-gray-600">→</span>
    </button>
  );
}
