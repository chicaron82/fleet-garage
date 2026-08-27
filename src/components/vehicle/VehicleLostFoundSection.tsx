import { useState } from 'react';
import { useLostFoundContext } from '../../context/LostFoundContext';
import { lostFoundHistoryForVehicle } from '../../lib/lostFoundForVehicle';
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
 * What this vehicle has produced — closing the loop the other way (the item already names the car;
 * now the car shows the item).
 *
 * ⚠️ THIS USED TO DROP RESOLVED ITEMS ENTIRELY, so returning or tossing something made it vanish from
 * the car's record — findable only by searching L&F by plate. Aaron asked what happens to them, then
 * gave the fix: *"if/when returned the l&f on the record collapses. if another item is found later
 * down the line it would show the current found and keep the previous item collapsed from view which
 * can still be expanded if needed."*
 *
 * ⭐ Same reveal-don't-choose move as the sightings chip and the note history: lead with what is live,
 * keep the rest one tap away. The section now means *what this car has produced* rather than *what is
 * in our possession* — and it renders even when EVERYTHING is resolved, which is the whole point.
 */
export function VehicleLostFoundSection({ vehicle }: { vehicle: Vehicle }) {
  const { lostFoundItems } = useLostFoundContext();
  const { active, resolved } = lostFoundHistoryForVehicle(lostFoundItems, vehicle);
  const [showResolved, setShowResolved] = useState(false);
  if (active.length === 0 && resolved.length === 0) return null;
  const items = active;

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

      {resolved.length > 0 && (
        <div className={active.length > 0 ? 'pt-2 border-t border-amber-200/70 dark:border-amber-800/40' : ''}>
          <button
            type="button"
            onClick={() => setShowResolved(v => !v)}
            className="text-xs font-medium text-amber-700/80 dark:text-amber-400/80 hover:text-amber-900 dark:hover:text-amber-300 cursor-pointer"
          >
            {showResolved ? '▾' : '▸'} {resolved.length} previously found{showResolved ? '' : ' · tap to show'}
          </button>
          {showResolved && (
            <div className="mt-2 space-y-1.5">
              {resolved.map(i => (
                /* ⚠️ Returned and Disposed are DIFFERENT FACTS and both are said out loud. A customer
                   ringing about a bag needs to know which one happened to it; "resolved" would be
                   true and useless. */
                <p key={i.id} className="text-[11px] text-gray-500 dark:text-gray-400 break-words">
                  <span className="text-gray-600 dark:text-gray-300">{i.description || 'Item'}</span>
                  {' — '}{STATUS_LABEL[i.status]} · found {fmt(i.foundAt)}
                  {i.location ? ` · ${readable(i.location)}` : ''}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
