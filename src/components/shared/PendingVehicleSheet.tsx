import type { Hold, Vehicle } from '../../types';
import { StatusBadge } from '../holds/StatusBadge';

interface Props {
  vehicle: Vehicle;
  hold: Hold | undefined;
  onClose: () => void;
  onConfirm: () => void;
}

export function PendingVehicleSheet({ vehicle, hold, onClose, onConfirm }: Props) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden max-w-sm mx-auto">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Confirm vehicle</p>
          </div>
          <div className="px-4 py-4">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-gray-900 dark:text-gray-100">{vehicle.unitNumber}</span>
                  <span className="text-gray-400 text-xs">·</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100 tracking-wide">{vehicle.licensePlate}</span>
                </div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{vehicle.color}</p>
                {hold && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 truncate">
                    {hold.damageDescription.slice(0, 60)}{hold.damageDescription.length > 60 ? '…' : ''}
                  </p>
                )}
              </div>
              <StatusBadge status={vehicle.status} holdTypes={hold?.holdTypes} mechanicalSubType={hold?.mechanicalSubType} />
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
              >
                Go back
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-sm font-semibold text-gray-900 transition cursor-pointer"
              >
                Yes, open it
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
