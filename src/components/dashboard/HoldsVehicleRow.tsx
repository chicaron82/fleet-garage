import type { Hold, Vehicle } from '../../types';
import { hapticLight } from '../../lib/haptics';
import { StatusBadge } from '../holds/StatusBadge';
import { holdContextEmojis, unresolvedHoldTypes } from '../../lib/holdBadge';

interface Props {
  vehicle: Vehicle;
  latestHold?: Hold;
  streak: number;
  isPinned: boolean;
  isManagement: boolean;
  onTogglePin: (vehicleId: string) => void;
  onOpen: (vehicle: Vehicle) => void;
  getName: (id: string, fallbackName?: string) => string;
}

/** One vehicle row in the holds dashboard list: optional pin (management),
 *  the tappable vehicle card, status badge, unrepaired streak, cover photo. */
export function HoldsVehicleRow({
  vehicle, latestHold, streak, isPinned, isManagement, onTogglePin, onOpen, getName,
}: Props) {
  const emojis = holdContextEmojis(
    vehicle.status,
    latestHold?.holdTypes ?? [],
    latestHold?.detailReason,
    latestHold?.mechanicalSubType,
  );

  return (
    <div className="flex items-stretch gap-1.5">
      {isManagement && (
        <button
          type="button"
          onClick={() => onTogglePin(vehicle.id)}
          aria-label={isPinned ? 'Unpin' : 'Pin to top'}
          className={`shrink-0 w-7 flex items-center justify-center rounded-lg transition-colors ${
            isPinned
              ? 'text-red-500'
              : 'text-gray-200 dark:text-gray-700 hover:text-gray-400 dark:hover:text-gray-500'
          }`}
        >
          📌
        </button>
      )}
      <button
        onClick={() => { hapticLight(); onOpen(vehicle); }}
        className={`flex-1 bg-white dark:bg-gray-900 rounded-xl border p-4 text-left hover:border-fg-yellow dark:hover:border-fg-yellow-hi hover:shadow-sm transition-all cursor-pointer group ${
          isPinned
            ? 'border-red-300 dark:border-red-700/60'
            : 'border-gray-200 dark:border-gray-800'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-semibold text-gray-900 dark:text-gray-100 text-base group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">{vehicle.unitNumber}</span>
              <span className="text-gray-400 dark:text-gray-600 text-xs transition-colors">·</span>
              <span className="text-gray-700 dark:text-gray-300 text-xs font-semibold transition-colors">{vehicle.licensePlate}</span>
              {emojis.length > 0 && (
                <span className="text-sm leading-none tracking-tight">{emojis.join(' ')}</span>
              )}
            </div>
            <p className="text-base font-medium text-gray-800 dark:text-gray-200 transition-colors">{vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.color}</p>
            {latestHold && (
              <p className="text-sm text-gray-700 dark:text-gray-300 font-semibold mt-1.5 truncate transition-colors">
                {latestHold.damageDescription.slice(0, 40)}{latestHold.damageDescription.length > 40 ? '…' : ''}
              </p>
            )}
            {latestHold && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 transition-colors">
                Flagged by {getName(latestHold.flaggedById, latestHold.flaggedByName)}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <StatusBadge status={vehicle.status} holdTypes={latestHold ? unresolvedHoldTypes(latestHold) : undefined} mechanicalSubType={latestHold?.mechanicalSubType} />
            {streak >= 2 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                streak >= 3
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
              }`}>
                {streak}× unrepaired
              </span>
            )}
            {vehicle.coverPhotoUrl && (
              <img
                src={vehicle.coverPhotoUrl}
                alt="Vehicle"
                className="w-12 h-12 object-cover rounded-lg border border-gray-200 dark:border-gray-700 mt-0.5"
              />
            )}
          </div>
        </div>
      </button>
    </div>
  );
}
