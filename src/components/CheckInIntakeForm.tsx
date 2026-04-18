import { useState, useCallback } from 'react';
import { useGarage } from '../context/GarageContext';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';
import { parseFleetBarcode } from '../lib/barcode';
import type { Vehicle } from '../types';

interface Props {
  onFlagIssue: (vehicleId: string) => void;
}

const FUEL_LEVELS = ['Full', '3/4', '1/2', '1/4', 'Low'];

export function CheckInIntakeForm({ onFlagIssue }: Props) {
  const { getVehicleByUnit } = useGarage();

  const [scanned, setScanned] = useState<{ vehicle: Vehicle; timestamp: string } | null>(null);
  const [mileage, setMileage] = useState('');
  const [fuelLevel, setFuelLevel] = useState('');
  const [photoCount, setPhotoCount] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleDecode = useCallback((raw: string, timestamp: string) => {
    const result = parseFleetBarcode(raw);
    if (!result.ok) {
      showToast('Unrecognized barcode — enter unit number manually');
      return;
    }
    const vehicle = getVehicleByUnit(result.unit);
    if (!vehicle) {
      showToast(`Unit ${result.unit} not in system`);
      return;
    }
    setScanned({ vehicle, timestamp });
    setMileage('');
    setFuelLevel('');
    setPhotoCount(0);
    setSubmitted(false);
  }, [getVehicleByUnit, showToast]);

  const handleSubmit = () => setSubmitted(true);

  const handleReset = () => {
    setScanned(null);
    setSubmitted(false);
  };

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
          Vehicle Intake
        </p>
        {scanned && !submitted && (
          <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer">
            Clear
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {!scanned && (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center">
              Scan the vehicle barcode to begin intake
            </p>
            <CameraBarcodeScanner onDecode={handleDecode} label="Scan to Check In" />
          </div>
        )}

        {scanned && !submitted && (
          <>
            {/* Vehicle card */}
            <div className="bg-gray-50 dark:bg-gray-950 rounded-lg px-4 py-3 space-y-1 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{scanned.vehicle.unitNumber}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {scanned.vehicle.year} {scanned.vehicle.make} {scanned.vehicle.model} · {scanned.vehicle.color}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Plate: {scanned.vehicle.licensePlate}</p>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500 text-right">
                  Scanned<br />{fmtTime(scanned.timestamp)}
                </span>
              </div>
            </div>

            {/* Mileage + Fuel */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                  Mileage (km)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 42800"
                  value={mileage}
                  onChange={e => setMileage(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                  Fuel Level
                </label>
                <select
                  value={fuelLevel}
                  onChange={e => setFuelLevel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition cursor-pointer"
                >
                  <option value="">Select…</option>
                  {FUEL_LEVELS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>

            {/* Photos */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
                Photos
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPhotoCount(p => Math.min(p + 1, 6))}
                  className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:border-yellow-400 hover:text-yellow-500 transition cursor-pointer gap-0.5"
                >
                  <span className="text-xl leading-none">+</span>
                  <span className="text-xs leading-none">Photo</span>
                </button>
                {Array.from({ length: photoCount }).map((_, i) => (
                  <div key={i} className="w-14 h-14 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center transition-colors">
                    <span className="text-xl">📷</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleSubmit}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
              >
                ✓ Submit Check-in
              </button>
              <button
                type="button"
                onClick={() => onFlagIssue(scanned.vehicle.id)}
                className="px-4 py-2.5 border-2 border-red-400 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold text-sm rounded-lg transition cursor-pointer"
              >
                Flag Issue
              </button>
            </div>
          </>
        )}

        {submitted && scanned && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <span className="text-3xl">✅</span>
            <p className="font-semibold text-green-700 dark:text-green-400 text-sm">
              {scanned.vehicle.unitNumber} checked in
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {scanned.vehicle.year} {scanned.vehicle.make} {scanned.vehicle.model}
              {fuelLevel ? ` · Fuel: ${fuelLevel}` : ''}
              {mileage ? ` · ${Number(mileage).toLocaleString()} km` : ''}
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="mt-2 text-xs font-semibold text-yellow-600 hover:text-yellow-800 transition cursor-pointer"
            >
              Check in another →
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            background: 'rgba(153, 27, 27, 0.85)',
            color: 'white',
            padding: '0.75rem 1.25rem',
            borderRadius: '0.75rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            whiteSpace: 'nowrap' as const,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
