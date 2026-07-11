import { useState } from 'react';
import { UnitNumberInput, PlateInput } from '../shared/VehicleFields';
import { VehicleIdentityFields } from '../shared/VehicleIdentityFields';
import { INPUT } from '../shared/vehicleCatalogue';

interface VehicleDirectEditModalProps {
  vehicleId: string;
  initialUnitNumber: string | null;
  initialLicensePlate: string;
  initialMake: string;
  initialModel: string;
  initialYear: number;
  initialColor: string;
  onClose: () => void;
  directEditVehicleIdentity: (
    vehicleId: string,
    unitNumber: string | null,
    licensePlate: string,
    identity?: { make: string; model: string; year: number; color: string },
  ) => Promise<void>;
}

export function VehicleDirectEditModal({
  vehicleId,
  initialUnitNumber,
  initialLicensePlate,
  initialMake,
  initialModel,
  initialYear,
  initialColor,
  onClose,
  directEditVehicleIdentity,
}: VehicleDirectEditModalProps) {
  const [editUnit, setEditUnit] = useState(initialUnitNumber ?? '');
  const [editPlate, setEditPlate] = useState(initialLicensePlate);
  const [editMake, setEditMake] = useState(initialMake);
  const [editModel, setEditModel] = useState(initialModel);
  // Seed a blank/unknown year (0 sentinel) to the current year so the stepper starts in range.
  const [editYear, setEditYear] = useState(initialYear >= 2000 ? initialYear : new Date().getFullYear());
  const [editColor, setEditColor] = useState(initialColor);
  const [editSaving, setEditSaving] = useState(false);

  const canSave = !!editPlate.trim() && !!editMake && !!editModel && editYear > 1999 && !!editColor && !editSaving;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4 bg-black/40">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-gray-900 dark:text-gray-100">
            Edit Vehicle
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Unit Number
              </label>
              <UnitNumberInput
                value={editUnit}
                onValueChange={setEditUnit}
                placeholder="Unit # (blank if unknown)"
                className={INPUT}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                License Plate
              </label>
              <PlateInput
                value={editPlate}
                onValueChange={setEditPlate}
                className={INPUT}
              />
            </div>
          </div>
          <VehicleIdentityFields
            make={editMake}
            model={editModel}
            year={editYear}
            color={editColor}
            onMake={setEditMake}
            onModel={setEditModel}
            onYear={setEditYear}
            onColor={setEditColor}
          />
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
            disabled={!canSave}
            onClick={async () => {
              setEditSaving(true);
              await directEditVehicleIdentity(
                vehicleId,
                editUnit.trim() || null,
                editPlate.trim().toUpperCase(),
                { make: editMake, model: editModel, year: editYear, color: editColor },
              );
              setEditSaving(false);
              onClose();
            }}
            className="flex-1 py-2.5 rounded-xl bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-semibold transition cursor-pointer"
          >
            {editSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
