import { useLostFoundContext } from '../../context/LostFoundContext';
import { lostFoundForVehicle } from '../../lib/lostFoundForVehicle';
import type { Vehicle, LostFoundStatus } from '../../types';

const STATUS_LABEL: Record<LostFoundStatus, string> = {
  holding:            'In holding',
  customer_contacted: 'Customer contacted',
  returned:           'Returned',
  disposed:           'Disposed',
};

const readable = (s: string) => s.replace(/_/g, ' ');

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Lost & Found items still in our possession that were found in this vehicle —
 * closes the loop the other way (the item already names the car; now the car
 * shows the item). Resolved items are filtered out by lostFoundForVehicle.
 */
export function VehicleLostFoundSection({ vehicle }: { vehicle: Vehicle }) {
  const { lostFoundItems } = useLostFoundContext();
  const items = lostFoundForVehicle(lostFoundItems, vehicle);
  if (items.length === 0) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/40 p-5 space-y-3">
      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-widest">
        🧳 Found in this vehicle
      </p>
      {items.map(i => (
        <div key={i.id} className="flex items-start gap-3">
          {i.itemPhotoUrl && (
            <img src={i.itemPhotoUrl} alt="" className="w-12 h-12 object-cover rounded-lg border border-amber-200 dark:border-amber-800/50 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{i.description || 'Item'}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Found by {i.foundByName} · {fmt(i.foundAt)}{i.location ? ` · ${readable(i.location)}` : ''}
            </p>
          </div>
          <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
            {STATUS_LABEL[i.status]}
          </span>
        </div>
      ))}
    </div>
  );
}
