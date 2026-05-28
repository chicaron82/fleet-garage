import { CameraBarcodeScanner } from '../shared/CameraBarcodeScanner';
import { PlateArrivalSection } from '../shared/PlateArrivalSection';
import type { Vehicle } from '../../types';

interface Props {
  vehicles: Vehicle[];
  unitSearch: string;
  onUnitSearchChange: (next: string) => void;
  onDecode: (raw: string, timestamp: string) => void;
  onSelectVehicle: (vehicle: Vehicle, timestamp: string) => void;
}

/**
 * The "find a vehicle" panel shown before intake begins.
 * Owns no state — the search term lives in the parent because the rest of the
 * intake also conditionally renders based on whether a vehicle is selected.
 */
export function VehicleScanAndMatch({
  vehicles,
  unitSearch,
  onUnitSearchChange,
  onDecode,
  onSelectVehicle,
}: Props) {
  const term = unitSearch.trim().toUpperCase();
  const results = term.length >= 2
    ? vehicles.filter(v =>
        (v.unitNumber?.toUpperCase() ?? '').includes(term) ||
        v.licensePlate.toUpperCase().includes(term),
      ).slice(0, 5)
    : [];

  return (
    <div className="py-2">
      <div className="flex flex-col items-center gap-3 py-4">
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center">
          Scan the vehicle barcode to begin intake
        </p>
        <CameraBarcodeScanner onDecode={onDecode} label="Scan to Check In" />
      </div>

      <div className="relative flex py-2 items-center">
        <div className="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
        <span className="flex-shrink-0 mx-4 text-gray-400 dark:text-gray-500 text-xs font-semibold uppercase tracking-wider">or</span>
        <div className="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
      </div>

      <div className="space-y-3 pt-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Or enter unit # or plate…"
            value={unitSearch}
            onChange={e => onUnitSearchChange(e.target.value.toUpperCase())}
            className="w-full px-3.5 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition uppercase"
          />
          {unitSearch && (
            <button
              onClick={() => onUnitSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-base leading-none cursor-pointer"
              aria-label="Clear search"
            >×</button>
          )}
        </div>

        {term.length >= 2 && (
          <div className="space-y-1">
            {results.length === 0
              ? <PlateArrivalSection key={unitSearch} unitSearch={unitSearch} />
              : results.map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onSelectVehicle(v, new Date().toISOString())}
                    className="w-full text-left px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-yellow-400 hover:bg-yellow-50 transition text-sm cursor-pointer"
                  >
                    <span className="font-medium text-gray-900 dark:text-gray-100">{v.unitNumber}</span>
                    <span className="text-gray-400 dark:text-gray-500 mx-2">·</span>
                    <span className="text-gray-500 dark:text-gray-400">{v.licensePlate}</span>
                    <span className="text-gray-400 dark:text-gray-500 mx-2">·</span>
                    <span className="text-gray-500 dark:text-gray-400">{v.year} {v.make} {v.model}</span>
                  </button>
                ))}
          </div>
        )}
      </div>
    </div>
  );
}
