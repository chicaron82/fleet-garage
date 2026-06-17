import { useEVAssetHistory } from '../../hooks/useEVAssetHistory';
import { useUserResolver } from '../../hooks/useUserResolver';

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

/**
 * Collapsible EV-asset update timeline for a vehicle — each change with who logged
 * it, the source (check-in / driver / washbay / management), the cable+adapter
 * state, notes, and when. Shared by the vehicle detail card and the EV Assets tab
 * so the history reads identically wherever you find the vehicle.
 */
export function EVAssetHistoryPanel({ vehicleId }: { vehicleId: string }) {
  const evHistory = useEVAssetHistory(vehicleId);
  const { getName } = useUserResolver();

  return (
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
  );
}
