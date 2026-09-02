import { fmtTime } from '../../lib/vsa-trip';
import { vehicleNameText } from '../../lib/vehicleName';

interface DriverLiveCompleteViewProps {
  vehicleDetails: { make: string; model: string; year: number; color: string } | null;
  plate: string;
  fromLabel: string;
  toLabel: string;
  departureTime: string;
  arrivalTime: string;
  notes: string;
  handleReset: () => void;
}

export function DriverLiveCompleteView({
  vehicleDetails,
  plate,
  fromLabel,
  toLabel,
  departureTime,
  arrivalTime,
  notes,
  handleReset,
}: DriverLiveCompleteViewProps) {
  const dur = Math.round(
    (new Date(arrivalTime).getTime() - new Date(departureTime).getTime()) / 60000
  );

  return (
    <div className="space-y-3">
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-lg px-4 py-3 transition-colors">
        <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-widest mb-1.5">
          Trip Complete
        </p>
        <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
          {vehicleDetails
            ? `${vehicleNameText(vehicleDetails)} · ${vehicleDetails.color}`
            : plate}
        </p>
        {vehicleDetails && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Plate: {plate}</p>
        )}
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{fromLabel} → {toLabel}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {fmtTime(departureTime)} → {fmtTime(arrivalTime)} · {dur}m
        </p>
        {notes && <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-2">"{notes}"</p>}
      </div>
      <button
        type="button"
        onClick={handleReset}
        className="w-full py-2.5 rounded-lg border border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-400 font-semibold text-sm transition cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20"
      >
        Log another →
      </button>
    </div>
  );
}
