import { NotesField } from './VSATripComponents';
import { fmtTime } from '../../lib/vsa-trip';

interface DriverLiveTransitViewProps {
  vehicleDetails: { make: string; model: string; year: number; color: string } | null;
  plate: string;
  fromLabel: string;
  toLabel: string;
  departureTime: string;
  elapsed: string;
  notes: string;
  setNotes: (notes: string) => void;
  saveError: boolean;
  submitting: boolean;
  handleArrived: () => void;
  handleCancelTrip: () => void;
}

export function DriverLiveTransitView({
  vehicleDetails,
  plate,
  fromLabel,
  toLabel,
  departureTime,
  elapsed,
  notes,
  setNotes,
  saveError,
  submitting,
  handleArrived,
  handleCancelTrip,
}: DriverLiveTransitViewProps) {
  return (
    <div className="space-y-3">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg px-4 py-4 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-2">
              In Transit
            </p>
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
              {vehicleDetails
                ? `${vehicleDetails.year} ${vehicleDetails.make} ${vehicleDetails.model} · ${vehicleDetails.color}`
                : plate}
            </p>
            {vehicleDetails && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Plate: {plate}</p>
            )}
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1 font-medium">
              {fromLabel} → {toLabel}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Departed {fmtTime(departureTime)}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 tabular-nums">
              {elapsed || '0m 00s'}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">elapsed</p>
          </div>
        </div>
      </div>
      <NotesField value={notes} onChange={setNotes} tripState="in_transit" />
      {saveError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg px-4 py-3">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400">
            Couldn't save — check connection and try again.
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={handleArrived}
        disabled={submitting}
        className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
      >
        {submitting ? 'Saving…' : '✓ Arrived at Destination'}
      </button>
      <button
        type="button"
        onClick={handleCancelTrip}
        className="w-full text-center text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition cursor-pointer py-1"
      >
        Cancel trip
      </button>
    </div>
  );
}
