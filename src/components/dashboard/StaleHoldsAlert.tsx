import type { UserRole, Hold, Vehicle } from '../../types';
import { canRelease } from '../../types';
import { hapticLight } from '../../lib/haptics';

interface StaleHoldsAlertProps {
  role: UserRole;
  staleHolds: Hold[];
  vehicles: Vehicle[];
  onSelectVehicle: (vehicleId: string) => void;
}

export function StaleHoldsAlert({
  role,
  staleHolds,
  vehicles,
  onSelectVehicle,
}: StaleHoldsAlertProps) {
  // Management only — VSA/Lead VSA see ⚠️ on individual hold cards, not the fleet-level banner
  if (!canRelease(role)) return null;
  if (staleHolds.length === 0) return null;

  /**
   * ⚠️ ONE CHIP PER VEHICLE, NOT PER HOLD. `staleHolds` is a list of HOLDS, and a car can carry
   * several at once — LUR306 sits on a damage hold AND a hail hold. Mapping straight across rendered
   * its unit number TWICE, as two identical buttons that navigate to the same place, and React
   * warned about the duplicate key because the key was the vehicle id all along.
   *
   * ⭐ The heading still counts HOLDS ("3 holds have been active…"), which is the true number and
   * reads correctly above two chips. Found 2026-09-03 while render-verifying an unrelated change;
   * the warning had been in the console the whole time.
   */
  const staleItems = [...new Map(
    staleHolds.map(h => {
      const v = vehicles.find(v => v.id === h.vehicleId);
      return [h.vehicleId, { vehicleId: h.vehicleId, unitNumber: v?.unitNumber ?? 'Unknown' }] as const;
    }),
  ).values()];

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300 transition-colors">
      <p className="font-semibold mb-1.5">
        ⚠️ {staleHolds.length} hold{staleHolds.length > 1 ? 's have' : ' has'} been active for more than 48 hours
      </p>
      <div className="flex flex-wrap gap-1.5">
        {staleItems.map(({ vehicleId, unitNumber }) => (
          <button
            key={vehicleId}
            type="button"
            onClick={() => {
              hapticLight();
              onSelectVehicle(vehicleId);
            }}
            className="bg-amber-100 dark:bg-amber-800/40 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-md text-xs font-semibold hover:bg-amber-200 dark:hover:bg-amber-700/60 cursor-pointer transition-colors"
          >
            {unitNumber}
          </button>
        ))}
      </div>
    </div>
  );
}
