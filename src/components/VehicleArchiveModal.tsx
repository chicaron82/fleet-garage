import { hapticMedium } from '../lib/haptics';

interface VehicleArchiveModalProps {
  vehicleId: string;
  unitNumber: string | null;
  onClose: () => void;
  onBack: () => void;
  archiveVehicle: (id: string) => Promise<void>;
}

export function VehicleArchiveModal({
  vehicleId,
  unitNumber,
  onClose,
  onBack,
  archiveVehicle,
}: VehicleArchiveModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4 bg-black/40">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl p-5 space-y-4">
        <div>
          <p className="text-base font-bold text-gray-900 dark:text-gray-100">
            Archive Unit {unitNumber ?? <span className="text-gray-400 italic">pending</span>}?
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            This vehicle will be removed from active service. All hold history and
            records are preserved. You can restore it at any time.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              hapticMedium();
              await archiveVehicle(vehicleId);
              onClose();
              onBack();
            }}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold cursor-pointer transition"
          >
            Archive
          </button>
        </div>
      </div>
    </div>
  );
}
