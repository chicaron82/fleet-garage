import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { hapticLight } from '../lib/haptics';
import { canRelease } from '../types';
import type { EvAssetStatus } from '../types';
import { REASON_LABELS, Pill, NotesField, TRIP_NOTE_PRESETS } from '../lib/vsa-trip';
import type { Reason, Authorization, QueueSnapshot } from '../lib/vsa-trip';
import { searchVehicles, detectTeslaByPlate } from '../lib/ev-detection';
import type { VehicleSearchResult } from '../lib/ev-detection';
import { PriorityHint } from './PriorityHint';
import { EVAssetCheck } from './EVAssetCheck';

export interface TripFormProps {
  queue: QueueSnapshot | null;         setQueue: (q: QueueSnapshot) => void;
  reason: Reason | null;               setReason: (r: Reason) => void;
  authorization: Authorization | null; setAuthorization: (a: Authorization | null) => void;
  notes: string;                       setNotes: (v: string) => void;
  isShuttle: boolean;
  shuttlePlate: string;                setShuttlePlate: (v: string) => void;
  vehiclePlate: string;                setVehiclePlate: (v: string) => void;
  onPlateBlur?: () => void;
  topClasses: string[];
  flaggedClasses: string[];
  canStart: boolean;
  onShuttleToggle: (checked: boolean) => void;
  onStartTrip: () => void;
  isTeslaRun: boolean;                 setIsTeslaRun: (v: boolean) => void;
  evCableStatus: EvAssetStatus | null;
  evAdapterStatus: EvAssetStatus | null;
  setEvCableStatus: (s: EvAssetStatus | null) => void;
  setEvAdapterStatus: (s: EvAssetStatus | null) => void;
}

export function TripForm({
  queue, setQueue, reason, setReason,
  authorization, setAuthorization, notes, setNotes,
  isShuttle, shuttlePlate, setShuttlePlate,
  vehiclePlate, setVehiclePlate, onPlateBlur,
  topClasses, flaggedClasses, canStart,
  onShuttleToggle, onStartTrip,
  isTeslaRun, setIsTeslaRun,
  evCableStatus, evAdapterStatus, setEvCableStatus, setEvAdapterStatus,
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
      <PriorityHint flaggedClasses={flaggedClasses} topClasses={topClasses} />

      {/* Lot Shuttle + Tesla */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isShuttle ? 'bg-yellow-400 border-yellow-400 text-black' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700'}`}>
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
            <input
              type="text" value={shuttlePlate}
              onChange={e => setShuttlePlate(e.target.value.toUpperCase())}
              className="w-20 px-2 py-0.5 text-xs rounded border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 focus:outline-none focus:border-yellow-400 transition-colors uppercase text-center"
            />
          </div>
        )}
      </div>

      {/* Vehicle plate (optional — for registry tracking) */}
      <div className="relative z-10">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
          Vehicle Plate <span className="text-gray-400 dark:text-gray-600 normal-case font-normal">optional</span>
        </label>
        <input
          type="text"
          placeholder="e.g. LUR156"
          value={vehiclePlate}
          onChange={e => {
            const val = e.target.value.toUpperCase();
            setVehiclePlate(val);
            if (!val) setShowSuggestions(false);
          }}
          onBlur={() => {
            setTimeout(() => setShowSuggestions(false), 200);
            onPlateBlur?.();
          }}
          onFocus={() => {
            if (plateSuggestions.length > 0) setShowSuggestions(true);
          }}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 uppercase focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
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

      {/* Queue */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
          Washbay Queue at Departure *
        </label>
        <div className="flex gap-2">
          <Pill label="0"   active={queue === '0'}        onClick={() => setQueue('0')} />
          <Pill label="~5"  active={queue === '~5'}       onClick={() => setQueue('~5')} />
          <Pill label="10+" active={queue === 'TOO_MUCH'} danger onClick={() => setQueue('TOO_MUCH')} />
        </div>
      </div>

      {/* Reason */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Reason *</label>
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(REASON_LABELS) as Reason[]).map(r => (
            <button
              key={r} type="button"
              onClick={() => { hapticLight(); setReason(r); }}
              className={`px-3 py-2 rounded-lg border text-sm transition cursor-pointer ${
                reason === r
                  ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-gray-900 dark:text-gray-100 font-medium'
                  : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
              }`}
            >
              {REASON_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      <NotesField value={notes} onChange={setNotes} tripState="form" presets={TRIP_NOTE_PRESETS} />

      {/* Authorization */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Authorization *</label>
        <select
          value={authorization ?? ''}
          onChange={e => setAuthorization((e.target.value as Authorization) || null as unknown as Authorization)}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition cursor-pointer"
        >
          <option value="">Select authorization…</option>
          <option value="MANAGEMENT">Management Decision</option>
          <option value="LEAD_VSA">Lead VSA / Senior VSA</option>
          <option value="PERSONAL">Personal — Proactive</option>
        </select>
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

      <button
        type="button" disabled={!canStart} onClick={onStartTrip}
        className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition cursor-pointer"
      >
        Start Trip →
      </button>
    </>
  );
}
