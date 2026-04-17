import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import { USERS } from '../data/mock';
import type { Hold, Vehicle } from '../types';

function getName(userId: string) {
  return USERS.find(u => u.id === userId)?.name ?? userId;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ExceptionReturnSection() {
  const { user } = useAuth();
  const { vehicles, getHoldsForVehicle, addHold } = useGarage();
  const [activeVehicleId, setActiveVehicleId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const items = vehicles
    .filter(v => v.status === 'OUT_ON_EXCEPTION')
    .flatMap(v => {
      const hold = getHoldsForVehicle(v.id)
        .find(h => h.status === 'RELEASED' && h.release?.releaseType === 'EXCEPTION');
      return hold ? [{ vehicle: v, hold }] : [];
    });

  if (items.length === 0) return null;

  const handleReHold = async (vehicle: Vehicle, hold: Hold) => {
    if (!user) return;
    setProcessing(true);
    await addHold(
      vehicle.id,
      hold.damageDescription,
      notes.trim() || 'Re-held on return from exception rental',
      user.id,
      [],
      hold.holdType,
      hold.detailReason,
      hold.id,
    );
    setActiveVehicleId(null);
    setNotes('');
    setProcessing(false);
  };

  return (
    <div className="space-y-3">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 rounded-xl px-4 py-3 transition-colors">
        <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">
          Returning on Exception — {items.length} vehicle{items.length > 1 ? 's' : ''}
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
          Previously released with known damage — re-hold to prevent rental
        </p>
      </div>

      {items.map(({ vehicle, hold }) => {
        const isActive = activeVehicleId === vehicle.id;
        return (
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

              {!isActive && (
                <div className="mt-3">
                  <button
                    onClick={() => setActiveVehicleId(vehicle.id)}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
                  >
                    Re-Hold for Repair
                  </button>
                </div>
              )}
            </div>

            {isActive && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800/40 px-4 py-4 space-y-3 transition-colors">
                <h3 className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-widest">Re-Hold Vehicle</h3>
                <p className="text-sm text-amber-900 dark:text-amber-200">
                  Vehicle will be held for repair. Management can release again if needed.
                </p>
                <textarea
                  rows={2}
                  placeholder="Notes (optional)"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition resize-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setActiveVehicleId(null); setNotes(''); }}
                    className="flex-1 py-2.5 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 font-medium text-sm rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => handleReHold(vehicle, hold)}
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition cursor-pointer disabled:cursor-not-allowed"
                  >
                    {processing ? 'Saving...' : 'Confirm Re-Hold'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
