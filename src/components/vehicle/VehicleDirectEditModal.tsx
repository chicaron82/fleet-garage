import { useState } from 'react';

interface VehicleDirectEditModalProps {
  vehicleId: string;
  initialUnitNumber: string | null;
  initialLicensePlate: string;
  onClose: () => void;
  directEditVehicleIdentity: (
    vehicleId: string,
    unitNumber: string | null,
    licensePlate: string
  ) => Promise<void>;
}

export function VehicleDirectEditModal({
  vehicleId,
  initialUnitNumber,
  initialLicensePlate,
  onClose,
  directEditVehicleIdentity,
}: VehicleDirectEditModalProps) {
  const [editUnit, setEditUnit] = useState(initialUnitNumber ?? '');
  const [editPlate, setEditPlate] = useState(initialLicensePlate);
  const [editSaving, setEditSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4 bg-black/40">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-gray-900 dark:text-gray-100">
            Edit Identity
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Unit Number
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={editUnit}
              onChange={(e) => setEditUnit(e.target.value)}
              placeholder="Unit number (leave blank if unknown)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              License Plate
            </label>
            <input
              type="text"
              value={editPlate}
              onChange={(e) => setEditPlate(e.target.value.toUpperCase())}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition uppercase"
            />
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!editPlate.trim() || editSaving}
            onClick={async () => {
              setEditSaving(true);
              await directEditVehicleIdentity(
                vehicleId,
                editUnit.trim() || null,
                editPlate.trim().toUpperCase()
              );
              setEditSaving(false);
              onClose();
            }}
            className="flex-1 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-semibold transition cursor-pointer"
          >
            {editSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
