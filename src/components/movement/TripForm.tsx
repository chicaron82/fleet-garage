import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hapticLight } from '../../lib/haptics';
import { canRelease } from '../../types';
import type { EvAssetStatus } from '../../types';
import { REASON_LABELS } from '../../lib/vsa-trip';
import type { Reason } from '../../lib/vsa-trip';
import { searchVehicles, detectTeslaByPlate } from '../../lib/ev-detection';
import type { VehicleSearchResult } from '../../lib/ev-detection';
import type { EvDispatchWarning } from '../../lib/evDispatch';
import { PriorityHint } from './PriorityHint';
import { EVAssetCheck } from './EVAssetCheck';
import { PlateInput } from '../shared/VehicleFields';

const MISSING_LABEL: Record<'cable' | 'adapter', string> = { cable: 'charge cable', adapter: 'J1772 adapter' };
const fmtMissing = (m: ('cable' | 'adapter')[]) => m.map(x => MISSING_LABEL[x]).join(' & ');

export interface TripFormProps {
  isShuttle: boolean;
  shuttlePlate: string;                setShuttlePlate: (v: string) => void;
  vehiclePlate: string;                setVehiclePlate: (v: string) => void;
  onPlateBlur?: () => void;
  topClasses: string[];
  flaggedClasses: string[];
  isDemoMode?: boolean;
  onShuttleToggle: (checked: boolean) => void;
  onCodeRedDispatch?: () => void;
  onQuickStart: (reason: Reason) => void;
  isTeslaRun: boolean;                 setIsTeslaRun: (v: boolean) => void;
  evCableStatus: EvAssetStatus | null;
  evAdapterStatus: EvAssetStatus | null;
  setEvCableStatus: (s: EvAssetStatus | null) => void;
  setEvAdapterStatus: (s: EvAssetStatus | null) => void;
  evWarning?: EvDispatchWarning | null;
}

export function TripForm({
  isShuttle, shuttlePlate, setShuttlePlate,
  vehiclePlate, setVehiclePlate, onPlateBlur,
  topClasses, flaggedClasses, isDemoMode,
  onShuttleToggle, onCodeRedDispatch, onQuickStart,
  isTeslaRun, setIsTeslaRun,
  evCableStatus, evAdapterStatus, setEvCableStatus, setEvAdapterStatus,
  evWarning,
}: TripFormProps) {
  const { user } = useAuth();

  const [plateSuggestions, setPlateSuggestions] = useState<VehicleSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (vehiclePlate.trim().length < 2) {
        setPlateSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      if (plateSuggestions.some(p => p.license_plate === vehiclePlate.trim().toUpperCase()) && !showSuggestions) return;
      const results = await searchVehicles(vehiclePlate);
      setPlateSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, 300);
    return () => clearTimeout(timer);
  }, [vehiclePlate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSuggestionSelect = (v: VehicleSearchResult) => {
    hapticLight();
    setVehiclePlate(v.license_plate);
    setShowSuggestions(false);
    detectTeslaByPlate(v.license_plate).then(res => {
      if (res.isTesla) {
        setIsTeslaRun(true);
        setEvCableStatus(res.lastCable);
        setEvAdapterStatus(res.lastAdapter);
      } else {
        setIsTeslaRun(false);
        setEvCableStatus(null);
        setEvAdapterStatus(null);
      }
    });
  };

  return (
    <>
      {onCodeRedDispatch && (
        <button
          type="button"
          onClick={onCodeRedDispatch}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 active:scale-95 text-white font-bold text-sm transition-all cursor-pointer shadow-sm"
        >
          <span>🚨</span>
          <span>Code Red — Dispatch Now</span>
        </button>
      )}

      <PriorityHint flaggedClasses={flaggedClasses} topClasses={topClasses} isDemoMode={isDemoMode} />

      {/* Lot Shuttle + Tesla */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isShuttle ? 'bg-fg-yellow border-fg-yellow text-black' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700'}`}>
              {isShuttle && <span className="text-xs font-bold leading-none">✓</span>}
            </div>
            <input type="checkbox" className="sr-only" checked={isShuttle} onChange={e => onShuttleToggle(e.target.checked)} />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">Lot Shuttle</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group" onClick={() => { hapticLight(); setIsTeslaRun(!isTeslaRun); }}>
            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isTeslaRun ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700'}`}>
              {isTeslaRun && <span className="text-xs font-bold leading-none">✓</span>}
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">Tesla ⚡</span>
          </label>
        </div>
        {user && canRelease(user.role) && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">Designated Plate:</span>
            <PlateInput
              value={shuttlePlate}
              onValueChange={setShuttlePlate}
              className="w-20 px-2 py-0.5 text-xs rounded border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 focus:outline-none focus:border-fg-yellow transition-colors text-center"
            />
          </div>
        )}
      </div>

      {/* Vehicle plate (optional — for registry tracking) */}
      <div className="relative z-10">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
          Vehicle Plate <span className="text-gray-400 dark:text-gray-600 normal-case font-normal">optional</span>
        </label>
        <PlateInput
          placeholder="e.g. LUR156"
          value={vehiclePlate}
          onValueChange={val => {
            setVehiclePlate(val);
            if (shuttlePlate) onShuttleToggle(val.trim() === shuttlePlate.toUpperCase().trim());
            if (!val) setShowSuggestions(false);
          }}
          onBlur={() => {
            setTimeout(() => setShowSuggestions(false), 200);
            onPlateBlur?.();
          }}
          onFocus={() => {
            if (plateSuggestions.length > 0) setShowSuggestions(true);
          }}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow transition"
        />
        {showSuggestions && plateSuggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-[66px] bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden z-50">
            {plateSuggestions.map(v => (
              <button
                key={v.license_plate}
                type="button"
                onClick={() => handleSuggestionSelect(v)}
                className="w-full text-left px-4 py-2.5 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 transition-colors border-b border-gray-100 dark:border-gray-700/50 last:border-0 flex justify-between items-center cursor-pointer"
              >
                <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{v.license_plate}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{v.year} {v.make} {v.model}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* EV dispatch guard — known-missing assets / not-dispatchable hold on this Tesla */}
      {evWarning && (
        <div className={`rounded-lg border px-3 py-2.5 ${
          evWarning.notDispatchable
            ? 'border-red-300 dark:border-red-700/60 bg-red-50 dark:bg-red-900/20'
            : 'border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20'
        }`}>
          <p className={`text-xs font-semibold ${evWarning.notDispatchable ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
            {evWarning.notDispatchable
              ? '🔴 Not cleared for dispatch — this Tesla has an open “missing EV assets” hold.'
              : `⚠️ Record shows ${fmtMissing(evWarning.missing)} missing — verify before dispatch.`}
          </p>
        </div>
      )}

      {/* Quick-start cards — tap and go, fill context on return */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Start Trip</p>
        {(['ROUTINE', 'COVERAGE_ASSIST'] as const).map(r => (
          <button
            key={r}
            type="button"
            onClick={() => { hapticLight(); onQuickStart(r); }}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 active:scale-[0.98] text-left transition-all cursor-pointer"
          >
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">{REASON_LABELS[r]}</span>
            <span className="text-amber-500 dark:text-amber-400 text-sm font-bold">→</span>
          </button>
        ))}
      </div>

      {isTeslaRun && (
        <EVAssetCheck
          cableStatus={evCableStatus}
          adapterStatus={evAdapterStatus}
          onCableChange={setEvCableStatus}
          onAdapterChange={setEvAdapterStatus}
        />
      )}

      {user && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Logging as: <span className="font-semibold">{user.name ?? user.id}</span> · {user.role} · #{user.employeeId}
        </p>
      )}
    </>
  );
}
