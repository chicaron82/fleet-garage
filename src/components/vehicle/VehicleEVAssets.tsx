import { canManageVehicles } from '../../types';
import type { Vehicle, UserRole, EvSource } from '../../types';
import { useEVAssetHistory } from '../../hooks/useEVAssetHistory';
import { useUserResolver } from '../../hooks/useUserResolver';

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

const SOURCE_LABEL: Record<string, string> = {
  check_in:    'Check-in',
  driver_trip: 'Driver trip',
  vsa_washbay: 'VSA / Washbay',
  management:  'Management',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function VehicleEVAssets({
  vehicle,
  userRole,
  updateVehicleEVAssets,
}: VehicleEVAssetsProps) {
  const evHistory = useEVAssetHistory(vehicle.id);
  const { getName } = useUserResolver();

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
      <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
        <button
          type="button"
          onClick={evHistory.toggle}
          className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer flex items-center gap-1"
        >
          {evHistory.expanded ? '▾' : '▸'} Update History
        </button>

        {evHistory.expanded && (
          <div className="mt-3 space-y-2">
            {evHistory.loading && (
              <p className="text-xs text-gray-400 dark:text-gray-500">Loading…</p>
            )}
            {!evHistory.loading && evHistory.history.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">No updates recorded yet.</p>
            )}
            {!evHistory.loading && evHistory.history.map(entry => (
              <div key={entry.id} className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {getName(entry.updatedBy)}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    {SOURCE_LABEL[entry.source] ?? entry.source}
                  </span>
                </div>
                <div className="flex gap-3">
                  {entry.cableStatus !== null && (
                    <span className={`text-[10px] font-semibold ${entry.cableStatus === 'present' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      Cable {entry.cableStatus === 'present' ? '✓' : '✗'}
                    </span>
                  )}
                  {entry.adapterStatus !== null && (
                    <span className={`text-[10px] font-semibold ${entry.adapterStatus === 'present' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      Adapter {entry.adapterStatus === 'present' ? '✓' : '✗'}
                    </span>
                  )}
                </div>
                {entry.notes && (
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 italic">"{entry.notes}"</p>
                )}
                <p className="text-[10px] text-gray-400 dark:text-gray-500">{fmt(entry.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
