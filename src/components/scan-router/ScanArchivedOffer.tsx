import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { canManageVehicles } from '../../types';
import { exactCarId } from '../../lib/exactCarMatch';
import { hapticMedium } from '../../lib/haptics';

/**
 * ⭐ RESTORE, RIGHT WHERE HE FOUND IT (2026-11-18, docs/ticket-recent-cars-everywhere-and-restore-from-find.md).
 * Aaron: *"I think the find a car should be able to view and have the option to restore an archived vehicle"*.
 *
 * The scanner never resolves an archived car (VehicleHoldContext only hands it live ones), so Find a car said "Not in
 * the fleet" about a car FG holds, and the way back was the Register form's restore: two screens for one decision.
 * ⚠️ It also made a promise come true: Fleet's auto-archive notice has always said *"Scan one to restore it"*, and
 * until this offer there was no code that did.
 *
 * Same restore as everywhere else (`restoreVehicle`): real damage holds stay, only the sale hold is dropped, and the
 * status is re-derived, never a made-up CLEAR. On success he lands on the car's record, as Register's restore does.
 */
export function ScanArchivedOffer({ plate, unit, onRestored }: { plate?: string | null; unit?: string | null; onRestored: (vehicleId: string) => void }) {
  const { user } = useAuth();
  const { archivedVehicles, restoreVehicle } = useVehicleHoldContext();
  const [restoring, setRestoring] = useState(false);
  const [failed, setFailed] = useState(false);
  const id = exactCarId(plate ?? '', archivedVehicles) ?? exactCarId(unit ?? '', archivedVehicles);
  const car = id ? archivedVehicles.find(v => v.id === id) : undefined;
  if (!car || !user || !canManageVehicles(user.role)) return null;
  const since = car.archivedAt
    ? new Date(car.archivedAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
    : null;
  return (
    <div className="mt-2 rounded-lg border border-slate-300 dark:border-slate-600/60 bg-slate-50 dark:bg-slate-800/40 px-3 py-2 space-y-2">
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
        📦 FG has this car, archived{since ? ` since ${since}` : ''}.
      </p>
      <button
        type="button"
        disabled={restoring}
        onClick={async () => {
          setRestoring(true); setFailed(false);
          // ⚠️ A failed write SAYS so; the car stays archived and he can try again.
          if (!(await restoreVehicle(car.id))) { setRestoring(false); setFailed(true); return; }
          hapticMedium();
          onRestored(car.id);
        }}
        className="w-full h-11 rounded-lg bg-slate-700 dark:bg-slate-600 text-white text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-500 disabled:opacity-50 transition-colors cursor-pointer"
      >
        {restoring ? 'Restoring…' : '↩ Restore to fleet'}
      </button>
      {failed && <p role="alert" className="text-xs text-red-700 dark:text-red-400">Couldn’t restore it just now. Check the signal and try again.</p>}
    </div>
  );
}
