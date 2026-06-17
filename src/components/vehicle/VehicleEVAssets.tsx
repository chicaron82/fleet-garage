import { canManageVehicles } from '../../types';
import type { Vehicle, UserRole, EvSource } from '../../types';
import { EVAssetHistoryPanel } from './EVAssetHistoryPanel';

interface VehicleEVAssetsProps {
  vehicle: Vehicle;
  userRole: UserRole;
  updateVehicleEVAssets: (
    vehicleId: string,
    hasMobileCable: boolean,
    hasJ1772Adapter: boolean,
    source: EvSource,
    notes?: string
  ) => Promise<void>;
}

export function VehicleEVAssets({
  vehicle,
  userRole,
  updateVehicleEVAssets,
}: VehicleEVAssetsProps) {
  if (!vehicle.isTesla && vehicle.make.toLowerCase() !== 'tesla') {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-3">
      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
        ⚡ EV Assets
      </p>

      {/* Read-only status rows */}
      <div className="space-y-2">
        {([
          { label: 'Mobile Charge Cable', present: vehicle.hasMobileCable },
          { label: 'J1772 Adapter', present: vehicle.hasJ1772Adapter },
        ] as const).map(({ label, present }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
            {present === null ? (
              <span className="text-xs text-gray-400 dark:text-gray-500 italic">Not assessed</span>
            ) : present ? (
              <span className="text-xs font-semibold text-green-600 dark:text-green-400">✓ Present</span>
            ) : (
              <span className="text-xs font-semibold text-red-600 dark:text-red-400">✗ Missing</span>
            )}
          </div>
        ))}
      </div>

      {/* Management direct-edit toggles */}
      {canManageVehicles(userRole) && (
        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            Update
          </p>
          {([
            { label: 'Mobile Charge Cable', current: vehicle.hasMobileCable ?? true, isAdapter: false },
            { label: 'J1772 Adapter', current: vehicle.hasJ1772Adapter ?? true, isAdapter: true },
          ]).map(({ label, current, isAdapter }) => (
            <label key={label} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={current}
                onChange={async (e) => {
                  const next = e.target.checked;
                  await updateVehicleEVAssets(
                    vehicle.id,
                    isAdapter ? (vehicle.hasMobileCable ?? true) : next,
                    isAdapter ? next : (vehicle.hasJ1772Adapter ?? true),
                    'management'
                  );
                }}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {label}
              </span>
            </label>
          ))}
        </div>
      )}

      {/* Update history */}
      <EVAssetHistoryPanel vehicleId={vehicle.id} />
    </div>
  );
}
