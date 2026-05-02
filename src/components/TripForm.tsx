import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { hapticLight } from '../lib/haptics';
import { canRelease } from '../types';
import { CLASS_INFO } from '../data/classSubstitutions';
import type { RentalClass } from '../data/manifest';
import {
  VSA_LOCATIONS, FUEL_LABELS, REASON_LABELS,
  fuelColor, Pill, NotesField,
} from '../lib/vsa-trip';
import type {
  VSALocation, Condition, Reason, Authorization,
  QueueSnapshot, FuelLevel, RouteStep,
} from '../lib/vsa-trip';

export interface TripFormProps {
  plate: string;           setPlate: (v: string) => void;
  from: VSALocation;       to: VSALocation;
  condition: Condition;    conditionManual: boolean;
  reason: Reason | null;   setReason: (r: Reason) => void;
  queue: QueueSnapshot | null; setQueue: (q: QueueSnapshot) => void;
  fuel: FuelLevel | null;      setFuel: (f: FuelLevel) => void;
  authorization: Authorization | null; setAuthorization: (a: Authorization | null) => void;
  notes: string;           setNotes: (v: string) => void;
  isShuttle: boolean;
  routeStep: RouteStep;
  customFrom: string;      setCustomFrom: (v: string) => void;
  customTo: string;        setCustomTo: (v: string) => void;
  shuttlePlate: string;    setShuttlePlate: (v: string) => void;
  vehicleMeta: string | null;
  topClasses: string[];
  flaggedClasses: string[];
  canStart: boolean;
  onShuttleToggle: (checked: boolean) => void;
  onConditionTap: (c: Condition) => void;
  onLocationTap: (loc: VSALocation) => void;
  onRouteReset: () => void;
  onStartTrip: () => void;
  onPlateChange: (v: string) => void;
}

export function TripForm({
  plate, from, to, condition, conditionManual,
  reason, setReason, queue, setQueue, fuel, setFuel,
  authorization, setAuthorization, notes, setNotes,
  isShuttle, routeStep, customFrom, setCustomFrom, customTo, setCustomTo,
  shuttlePlate, setShuttlePlate, vehicleMeta, topClasses, flaggedClasses, canStart,
  onShuttleToggle, onConditionTap, onLocationTap, onRouteReset, onStartTrip, onPlateChange,
}: TripFormProps) {
  const { user } = useAuth();
  const queueRequired  = from === 'Washbay';
  const fuelConditional = to === 'Washbay' && !isShuttle;

  const [subGuideOpen, setSubGuideOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<RentalClass | null>(null);

  return (
    <>
      {/* ─── ROUTE STATE MACHINE ───────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {routeStep === 'origin'      && 'Starting at?'}
          {routeStep === 'destination' && 'Going to?'}
          {routeStep === 'confirmed'   && 'Route'}
        </p>

        {routeStep === 'origin' && (flaggedClasses.length > 0 || topClasses.length > 0) && (
          <div className="space-y-1.5">

          {flaggedClasses.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800">
              <span className="text-xs">🚨</span>
              <p className="text-xs text-red-800 dark:text-red-300">
                <span className="font-bold">Must fulfill:</span>{' '}
                {flaggedClasses.join(', ')}
              </p>
            </div>
          )}

          {topClasses.length > 0 && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 overflow-hidden">
            <button
              type="button"
              onClick={() => { hapticLight(); setSubGuideOpen(o => !o); }}
              className="w-full flex items-center justify-between px-3 py-2 bg-amber-50 dark:bg-amber-900/20 cursor-pointer"
            >
              <p className="text-xs text-amber-800 dark:text-amber-300">
                <span className="font-semibold">📋 Priority this window:</span>{' '}
                {topClasses.join(', ')}
              </p>
              <span className="text-xs text-amber-600 dark:text-amber-400">
                {subGuideOpen ? '▴' : '▾'}
              </span>
            </button>

            {subGuideOpen && (
              <div className="border-t border-amber-200 dark:border-amber-800 divide-y divide-amber-100 dark:divide-amber-900/30">
                {topClasses.map(cls => {
                  const info = CLASS_INFO[cls as RentalClass];
                  if (!info) return null;
                  const isSelected = selectedClass === cls;
                  return (
                    <div key={cls}>
                      <button
                        type="button"
                        onClick={() => { hapticLight(); setSelectedClass(isSelected ? null : cls as RentalClass); }}
                        className="w-full flex items-center justify-between px-3 py-2.5 bg-white dark:bg-gray-900 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-400 w-6">{cls}</span>
                          <span className="text-xs text-gray-700 dark:text-gray-300">{info.label}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">· {info.example}</span>
                        </div>
                        <span className="text-xs text-gray-400">{isSelected ? '▴' : '▾'}</span>
                      </button>

                      {isSelected && (
                        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 space-y-1.5 text-xs">
                          {info.acceptable.length > 0 && (
                            <p><span className="font-semibold text-green-600 dark:text-green-400">✅ Acceptable:</span>{' '}<span className="text-gray-700 dark:text-gray-300">{info.acceptable.join(', ')}</span></p>
                          )}
                          {info.upgradeOk.length > 0 && (
                            <p><span className="font-semibold text-blue-600 dark:text-blue-400">⬆️ Upgrade OK:</span>{' '}<span className="text-gray-700 dark:text-gray-300">{info.upgradeOk.join(', ')}</span></p>
                          )}
                          {info.stretch.length > 0 && (
                            <p><span className="font-semibold text-amber-600 dark:text-amber-400">⚠️ Stretch:</span>{' '}<span className="text-gray-700 dark:text-gray-300">{info.stretch.join(', ')} — needs approval</span></p>
                          )}
                          <p><span className="font-semibold text-red-600 dark:text-red-400">🚫 Never:</span>{' '}<span className="text-gray-700 dark:text-gray-300">{info.never}</span></p>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => { hapticLight(); setSelectedClass(null); }}
                  className="w-full px-3 py-2 text-xs text-gray-400 dark:text-gray-500 hover:text-yellow-600 dark:hover:text-yellow-400 text-center cursor-pointer"
                >
                  📖 View full class guide
                </button>
              </div>
            )}
          </div>
          )}

          </div>
        )}

        {(routeStep === 'destination' || routeStep === 'confirmed') && (
          <button
            type="button"
            onClick={onRouteReset}
            className="text-sm font-semibold text-yellow-600 dark:text-yellow-400 hover:underline transition cursor-pointer"
          >
            From: {from === 'Other' ? (customFrom || 'Other') : from}
            {routeStep === 'confirmed' && (
              <span className="text-gray-400 dark:text-gray-500 font-normal">
                {' '}→ To: {to === 'Other' ? (customTo || 'Other') : to}
              </span>
            )}
          </button>
        )}

        {routeStep !== 'confirmed' && (
          <div className="flex gap-2 flex-wrap">
            {VSA_LOCATIONS.map(loc => (
              <button
                key={loc}
                type="button"
                onClick={() => onLocationTap(loc)}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition cursor-pointer ${
                  routeStep === 'destination' && loc === from
                    ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-gray-900 dark:text-gray-100'
                    : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
                }`}
              >
                {loc}
              </button>
            ))}
          </div>
        )}

        {routeStep === 'destination' && from === 'Other' && (
          <input
            type="text" autoFocus placeholder="Specify origin…" value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
          />
        )}

        {routeStep === 'confirmed' && to === 'Other' && (
          <input
            type="text" autoFocus placeholder="Specify destination…" value={customTo}
            onChange={e => setCustomTo(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
          />
        )}
      </div>

      {/* License Plate */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">License Plate *</label>
        <input
          type="text" placeholder="e.g. JFT 881" value={plate}
          onChange={e => onPlateChange(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition uppercase"
        />
        <div className="mt-3 flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isShuttle ? 'bg-yellow-400 border-yellow-400 text-black' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700'}`}>
              {isShuttle && <span className="text-xs font-bold leading-none">✓</span>}
            </div>
            <input type="checkbox" className="sr-only" checked={isShuttle} onChange={e => onShuttleToggle(e.target.checked)} />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">Using Lot Shuttle</span>
          </label>
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
        {!isShuttle && plate.trim().length >= 3 && (
          <p className={`text-xs mt-2 ${vehicleMeta ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500 italic'}`}>
            {vehicleMeta ?? 'Not in system — plate accepted as-is'}
          </p>
        )}
        {isShuttle && (
          <p className="text-xs mt-2 text-purple-600 dark:text-purple-400 font-medium">{vehicleMeta}</p>
        )}
      </div>

      {/* Vehicle Condition */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">Vehicle Condition</label>
          {isShuttle ? (
            <span className="text-[10px] text-gray-400 dark:text-gray-500">not applicable for shuttle</span>
          ) : !conditionManual && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500">auto · tap to override</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button" disabled={isShuttle} onClick={() => onConditionTap('CLEAN')}
            className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition ${
              isShuttle ? 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50 text-gray-300 dark:text-gray-600 cursor-not-allowed' :
              condition === 'CLEAN'
                ? 'border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 cursor-pointer'
                : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 cursor-pointer'
            }`}
          >Clean</button>
          <button
            type="button" disabled={isShuttle} onClick={() => onConditionTap('DIRTY')}
            className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition ${
              isShuttle ? 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50 text-gray-300 dark:text-gray-600 cursor-not-allowed' :
              condition === 'DIRTY'
                ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 cursor-pointer'
                : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700 cursor-pointer'
            }`}
          >Dirty</button>
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

      {/* Queue — conditional on From = Washbay */}
      {queueRequired && (
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
      )}

      {/* Fuel — conditional on To = Washbay */}
      {fuelConditional && (
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
            Fuel Level on Arrival
          </label>
          <div className="space-y-2 px-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold" style={{ color: fuel !== null ? fuelColor(fuel) : '#9ca3af' }}>
                ⛽ {fuel !== null ? FUEL_LABELS[fuel] : '—'}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                {fuel !== null ? `${fuel}/8` : 'optional'}
              </span>
            </div>
            <input
              type="range" min={0} max={8} step={1}
              value={fuel ?? 4}
              onChange={e => setFuel(Number(e.target.value))}
              onPointerDown={() => { if (fuel === null) setFuel(4); }}
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gray-200 dark:bg-gray-700 transition-colors"
              style={{ accentColor: fuel !== null ? fuelColor(fuel) : '#9ca3af' }}
            />
            <div className="flex justify-between px-0.5">
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className={`w-px h-1.5 rounded-full transition-colors ${fuel !== null && i <= fuel ? 'bg-gray-400 dark:bg-gray-400' : 'bg-gray-300 dark:bg-gray-700'}`} />
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500">
              <span>E</span><span>1/4</span><span>1/2</span><span>3/4</span><span>F</span>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      <NotesField value={notes} onChange={setNotes} tripState="form" />

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
