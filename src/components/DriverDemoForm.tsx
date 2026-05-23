import { useState } from 'react';
import type { ScannedPayload } from '../types';
import { PriorityHint } from './PriorityHint';
import { MockBarcodeScanner } from './MockBarcodeScanner';

const LOCATIONS = ['Washbay', 'Airport', 'Branch', 'Other'] as const;
type Location = typeof LOCATIONS[number];

type TripScanState = 'idle' | 'in_transit' | 'completed';

function elapsedLabel(from: string, to: string) {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

interface DriverDemoFormProps {
  flaggedClasses: string[];
  topClasses: string[];
}

export function DriverDemoForm({ flaggedClasses, topClasses }: DriverDemoFormProps) {
  const [tripState, setTripState] = useState<TripScanState>('idle');
  const [origin, setOrigin] = useState<Location>('Washbay');
  const [destination, setDestination] = useState<Location>('Airport');
  const [customOrigin, setCustomOrigin] = useState('');
  const [customDestination, setCustomDestination] = useState('');
  const [activeUnit, setActiveUnit] = useState<ScannedPayload | null>(null);
  const [departureTime, setDepartureTime] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');

  const handleDepart = (payload: ScannedPayload, timestamp: string) => {
    setActiveUnit(payload);
    setDepartureTime(timestamp);
    setTripState('in_transit');
  };

  const handleArrive = (_payload: ScannedPayload, timestamp: string) => {
    setArrivalTime(timestamp);
    setTripState('completed');
  };

  const handleReset = () => {
    setTripState('idle');
    setActiveUnit(null);
    setDepartureTime('');
    setArrivalTime('');
    setCustomOrigin('');
    setCustomDestination('');
  };

  const originLabel = origin === 'Other' ? (customOrigin || 'Other') : origin;
  const destLabel = destination === 'Other' ? (customDestination || 'Other') : destination;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Log Trip (Demo Mode)</p>
        {tripState !== 'idle' && (
          <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer">Reset</button>
        )}
      </div>
      <div className="p-4 space-y-4">
        {tripState === 'idle' && (
          <>
            <PriorityHint flaggedClasses={flaggedClasses} topClasses={topClasses} isDemoMode={true} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">From</label>
                <select value={origin} onChange={e => setOrigin(e.target.value as Location)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition cursor-pointer">
                  {LOCATIONS.map(l => <option key={l}>{l}</option>)}
                </select>
                {origin === 'Other' && (
                  <input type="text" placeholder="Enter location…" value={customOrigin} onChange={e => setCustomOrigin(e.target.value)}
                    className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition" />
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">To</label>
                <select value={destination} onChange={e => setDestination(e.target.value as Location)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition cursor-pointer">
                  {LOCATIONS.map(l => <option key={l}>{l}</option>)}
                </select>
                {destination === 'Other' && (
                  <input type="text" placeholder="Enter location…" value={customDestination} onChange={e => setCustomDestination(e.target.value)}
                    className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition" />
                )}
              </div>
            </div>
            <MockBarcodeScanner onScan={handleDepart} label="Scan to Depart" />
          </>
        )}

        {tripState === 'in_transit' && activeUnit && (
          <div className="space-y-3">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg px-4 py-3 transition-colors">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-1">In Transit</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{activeUnit.unitNumber} · {activeUnit.licensePlate}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{activeUnit.year} {activeUnit.make} {activeUnit.model}</p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-2 font-medium">{originLabel} → {destLabel}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Departed {new Date(departureTime).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>
            <MockBarcodeScanner onScan={handleArrive} label="Scan to Arrive" />
          </div>
        )}

        {tripState === 'completed' && activeUnit && (
          <div className="space-y-3">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-lg px-4 py-3 transition-colors">
              <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-widest mb-1">Trip Complete</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{activeUnit.unitNumber} · {activeUnit.licensePlate}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{activeUnit.year} {activeUnit.make} {activeUnit.model}</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 font-medium">{originLabel} → {destLabel}</p>
              <div className="flex gap-4 mt-2">
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Departed {new Date(departureTime).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Arrived {new Date(arrivalTime).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                  {elapsedLabel(departureTime, arrivalTime)}
                </span>
              </div>
            </div>
            <button onClick={handleReset} className="text-xs font-semibold text-yellow-600 hover:text-yellow-800 transition cursor-pointer">
              Log another →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
