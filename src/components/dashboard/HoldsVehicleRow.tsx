import type { Hold, Vehicle } from '../../types';
import { hapticLight } from '../../lib/haptics';
import { StatusBadge } from '../holds/StatusBadge';
import { holdContextEmojis, unresolvedHoldTypes } from '../../lib/holdBadge';
import { VehicleName } from '../shared/VehicleName';

interface Props {
  vehicle: Vehicle;
  latestHold?: Hold;
  streak: number;
  onOpen: (vehicle: Vehicle) => void;
  getName: (id: string, fallbackName?: string) => string;
}

/** One vehicle row in the holds dashboard list: the tappable vehicle card, hold-type badge,
 *  unrepaired streak, cover photo.
 *
 *  ⚠️ THERE WAS A 📌 PIN HERE, AND IT IS GONE (Aaron, 2026-09-14): *"removing the pin feature. that
 *  was ported over from management, but i don't use it and its taking up space."* It had already been
 *  un-gated once (2026-08-17 — it sat behind `canRelease`, so the only person using the board couldn't
 *  pin). Opening the gate fixed the access; it never asked whether he wanted the feature. Session-only
 *  state, so nothing stored was lost. The 📌 on a NEW hold's photos ("set as card photo") is a
 *  different feature and stays. */
export function HoldsVehicleRow({
  vehicle, latestHold, streak, onOpen, getName,
}: Props) {
  const emojis = holdContextEmojis(
    vehicle.status,
    latestHold?.holdTypes ?? [],
    latestHold?.detailReason,
    latestHold?.mechanicalSubType,
  );

  // ⚠️ `min-w-0` ON THE flex-1 CARD IS LOAD-BEARING. A flex item's minimum width defaults to its
  // content, so without it a long description could not shrink to its `truncate` — the whole card
  // grew past the screen instead, losing its right border and pushing the type badge off the edge
  // (LUR327, "Damage - written up as 'DMG', detail not…", at 412px). It had been clipping quietly;
  // the badge gaining an emoji on 2026-09-14 is what made it visible.
  return (
    <div className="flex items-stretch">
      <button
        onClick={() => { hapticLight(); onOpen(vehicle); }}
        className="flex-1 min-w-0 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-left hover:border-fg-yellow dark:hover:border-fg-yellow-hi hover:shadow-sm transition-all cursor-pointer group"
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
            <p className="text-base font-medium text-gray-800 dark:text-gray-200 transition-colors"><VehicleName vehicle={vehicle} /> · {vehicle.color}</p>
            {latestHold && (
              <p className="text-sm text-gray-700 dark:text-gray-300 font-semibold mt-1.5 truncate transition-colors">
                {latestHold.damageDescription.slice(0, 40)}{latestHold.damageDescription.length > 40 ? '…' : ''}
              </p>
            )}
            {latestHold && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 transition-colors">
                Flagged by {getName(latestHold.flaggedById, latestHold.flaggedByName)}
                {latestHold.flaggedSource === 'effie' ? ' · via Effie' : ''}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <StatusBadge status={vehicle.status} holdTypes={latestHold ? unresolvedHoldTypes(latestHold) : undefined} mechanicalSubType={latestHold?.mechanicalSubType} disposition={latestHold?.disposition} />
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
