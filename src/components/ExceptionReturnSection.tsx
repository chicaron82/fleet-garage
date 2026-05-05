import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import { CheckInHoldPanel } from './CheckInHoldPanel';
import { USERS } from '../data/mock';

function getName(userId: string) {
  return USERS.find(u => u.id === userId)?.name ?? userId;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ExceptionReturnSection() {
  const { user } = useAuth();
  const { vehicles, getHoldsForVehicle, addHold } = useGarage();

  const items = vehicles
    .filter(v => v.status === 'OUT_ON_EXCEPTION')
    .flatMap(v => {
      const hold = getHoldsForVehicle(v.id)
        .find(h => h.status === 'RELEASED' && h.release?.releaseType === 'EXCEPTION');
      return hold ? [{ vehicle: v, hold }] : [];
    });

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 rounded-xl px-4 py-3 transition-colors">
        <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">
          Returning on Exception — {items.length} vehicle{items.length > 1 ? 's' : ''}
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
          Compare damage against hold record — re-hold if anything is new or worse
        </p>
      </div>

      {items.map(({ vehicle, hold }) => (
        <div key={vehicle.id} className="bg-white dark:bg-gray-900 rounded-xl border border-amber-200 dark:border-amber-800/50 overflow-hidden transition-colors">
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{vehicle.unitNumber}</span>
                  <span className="text-gray-400 dark:text-gray-600 text-xs">·</span>
                  <span className="text-gray-500 dark:text-gray-400 text-xs">{vehicle.licensePlate}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 transition-colors">
                  {vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.color}
                </p>
                <div className="mt-2 bg-gray-50 dark:bg-gray-950 rounded-lg px-3 py-2 space-y-1 transition-colors">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 transition-colors">{hold.damageDescription}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 transition-colors">
                    Flagged {fmtDate(hold.flaggedAt)} · {getName(hold.flaggedById)}
                  </p>
                  {hold.release && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 transition-colors">
                      Released: {hold.release.reason}
                    </p>
                  )}
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 transition-colors">
                On Exception
              </span>
            </div>

            {/* Hold detail panel — damage photos, history, and re-hold */}
            {user && (
              <CheckInHoldPanel
                vehicle={vehicle}
                holds={getHoldsForVehicle(vehicle.id)}
                user={user}
                onReHold={async (vehicleId, description, notes, photos, linkedHoldId) => {
                  await addHold(vehicleId, description, notes, user.id, photos, ['damage'], undefined, undefined, linkedHoldId);
                }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
