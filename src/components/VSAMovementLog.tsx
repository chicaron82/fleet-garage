import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import type { TripRun } from '../data/trips';

const VSA_LOCATIONS = [
  'Washbay', 'Airport', 'Ready Line', 'Hold Bay', 'Main Lot',
  'Off Branch', 'Dealership', 'Body Shop', 'Other',
] as const;
type VSALocation = typeof VSA_LOCATIONS[number];
type Condition = 'CLEAN' | 'DIRTY';
type Reason = 'MOVING_CLEANS' | 'LOT_CLEARED' | 'OTHER';
type Authorization = 'MANAGEMENT' | 'LEAD_VSA' | 'PERSONAL';
type QueueSnapshot = '0' | '~5' | 'TOO_MUCH';
type FuelLevel = 0 | 1 | 2 | 3 | 4;
type TripState = 'form' | 'in_transit' | 'complete';

const FUEL_LABELS = ['Empty', '¼', '½', '¾', 'Full'];
const FUEL_COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

const REASON_LABELS: Record<Reason, string> = {
  MOVING_CLEANS: 'Moving Cleans',
  LOT_CLEARED: 'Lot Cleared',
  OTHER: 'Other',
};

const AUTH_OPTIONS: { value: Authorization; label: string }[] = [
  { value: 'MANAGEMENT', label: 'Management Decision' },
  { value: 'LEAD_VSA',   label: 'Lead VSA / Senior VSA' },
  { value: 'PERSONAL',   label: 'Personal — Proactive' },
];

function defaultCondition(to: VSALocation): Condition {
  return to === 'Washbay' ? 'DIRTY' : 'CLEAN';
}

function elapsedSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
}

function buildMetaLine(
  from: string, to: string,
  dep: string, arr: string,
  queue: QueueSnapshot | null,
  fuel: FuelLevel | null,
) {
  const dur = Math.round((new Date(arr).getTime() - new Date(dep).getTime()) / 60000);
  let s = `${fmtTime(dep)} → ${fmtTime(arr)} · ${dur}m`;
  if (from === 'Washbay' && queue !== null) s += ` · Queue: ${queue === 'TOO_MUCH' ? '10+' : queue}`;
  if (to === 'Washbay' && fuel !== null) s += ` · Fuel: ${FUEL_LABELS[fuel]}`;
  return s;
}

// ── Pill button ────────────────────────────────────────────────────────────────
function Pill({
  label, active, danger, onClick,
}: { label: string; active: boolean; danger?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition cursor-pointer ${
        active
          ? danger
            ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            : 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-gray-900 dark:text-gray-100'
          : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
      }`}
    >
      {label}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function VSAMovementLog({ onTripComplete }: { onTripComplete?: (trip: TripRun) => void }) {
  const { user } = useAuth();
  const { vehicles } = useGarage();

  const [tripState, setTripState] = useState<TripState>('form');

  // Form fields
  const [plate, setPlate]                     = useState('');
  const [from, setFrom]                       = useState<VSALocation>('Washbay');
  const [to, setTo]                           = useState<VSALocation>('Airport');
  const [condition, setCondition]             = useState<Condition>('CLEAN');
  const [conditionManual, setConditionManual] = useState(false);
  const [reason, setReason]                   = useState<Reason | null>(null);
  const [queue, setQueue]                     = useState<QueueSnapshot | null>(null);
  const [fuel, setFuel]                       = useState<FuelLevel | null>(null);
  const [authorization, setAuthorization]     = useState<Authorization | null>(null);

  // Trip timestamps
  const [departureTime, setDepartureTime] = useState('');
  const [arrivalTime, setArrivalTime]     = useState('');
  const [elapsed, setElapsed]             = useState('');

  // Vehicle lookup — pure computation, no effect needed
  const vehicleMeta = useMemo(() => {
    const t = plate.trim().replace(/\s/g, '').toUpperCase();
    if (t.length < 3) return null;
    const match = vehicles.find(v => v.licensePlate.replace(/\s/g, '').toUpperCase() === t);
    return match ? `${match.year} ${match.make} ${match.model} · ${match.unitNumber}` : null;
  }, [plate, vehicles]);

  // Live elapsed timer — only interval callback sets state (no synchronous setState in effect)
  useEffect(() => {
    if (tripState !== 'in_transit' || !departureTime) return;
    const id = setInterval(() => setElapsed(elapsedSince(departureTime)), 1000);
    return () => clearInterval(id);
  }, [tripState, departureTime]);

  const handleSetFrom = (loc: VSALocation) => { setFrom(loc); setQueue(null); };
  const handleSetTo   = (loc: VSALocation) => {
    setTo(loc);
    setFuel(null);
    // Update condition default when destination changes (unless user has manually set it)
    if (!conditionManual) setCondition(defaultCondition(loc));
  };
  const handleConditionTap = (c: Condition) => { setCondition(c); setConditionManual(true); };

  const queueRequired = from === 'Washbay';
  const fuelConditional = to === 'Washbay';
  const canStart = plate.trim().length > 0 && reason !== null && authorization !== null && (!queueRequired || queue !== null);

  const handleStartTrip = () => {
    const now = new Date().toISOString();
    setDepartureTime(now);
    setElapsed('0m 00s'); // initial display; interval takes over after 1s
    setTripState('in_transit');
  };

  const handleArrived = () => {
    const arrived = new Date().toISOString();
    setArrivalTime(arrived);
    setTripState('complete');

    if (onTripComplete && user) {
      onTripComplete({
        id: `vsa-session-${Date.now()}`,
        vehicleUnit: vehicleMeta?.split(' · ')[1] ?? '',
        vehiclePlate: plate,
        tripType: condition === 'CLEAN' ? 'clean' : 'dirty',
        departLocation: from,
        arriveLocation: to,
        departTime: departureTime,
        arriveTime: arrived,
        gasLevel: '',
        odometer: 0,
        driverId: user.id,
        isVsaInterruption: true,
        authorization: authorization ?? undefined,
        reason: reason ?? undefined,
        queueAtDeparture: queue ?? undefined,
        fuelOnArrival: fuel !== null ? FUEL_LABELS[fuel] : undefined,
        condition,
      });
    }
  };

  const handleReset = () => {
    setTripState('form');
    setPlate('');
    setFrom('Washbay'); setTo('Airport');
    setConditionManual(false); setCondition('CLEAN');
    setReason(null); setQueue(null); setFuel(null); setAuthorization(null);
    setDepartureTime(''); setArrivalTime(''); setElapsed('');
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            Movement Log
          </p>
          {tripState === 'in_transit' && (
            <p className="text-[10px] text-amber-500 font-semibold uppercase tracking-wide mt-0.5">● In Transit</p>
          )}
          {tripState === 'complete' && (
            <p className="text-[10px] text-green-600 dark:text-green-400 font-semibold uppercase tracking-wide mt-0.5">✓ Trip Complete</p>
          )}
        </div>
        {tripState !== 'form' && (
          <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer">
            Reset
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">

        {/* ─── FORM ──────────────────────────────────────────────────────── */}
        {tripState === 'form' && (
          <>
            {/* Route */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">From</label>
                <select value={from} onChange={e => handleSetFrom(e.target.value as VSALocation)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition cursor-pointer">
                  {VSA_LOCATIONS.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">To</label>
                <select value={to} onChange={e => handleSetTo(e.target.value as VSALocation)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition cursor-pointer">
                  {VSA_LOCATIONS.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
            </div>

            {/* License Plate */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">License Plate *</label>
              <input
                type="text"
                placeholder="e.g. JFT 881"
                value={plate}
                onChange={e => setPlate(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition uppercase"
              />
              {plate.trim().length >= 3 && (
                <p className={`text-xs mt-1.5 ${vehicleMeta ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500 italic'}`}>
                  {vehicleMeta ?? 'Not in system — plate accepted as-is'}
                </p>
              )}
            </div>

            {/* Vehicle Condition */}
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">Vehicle Condition</label>
                {!conditionManual && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">auto · tap to override</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleConditionTap('CLEAN')}
                  className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition cursor-pointer ${
                    condition === 'CLEAN'
                      ? 'border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                      : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >Clean</button>
                <button
                  type="button"
                  onClick={() => handleConditionTap('DIRTY')}
                  className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition cursor-pointer ${
                    condition === 'DIRTY'
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                      : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
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
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
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
                    <span className="text-sm font-bold" style={{ color: fuel !== null ? FUEL_COLORS[fuel] : '#9ca3af' }}>
                      ⛽ {fuel !== null ? FUEL_LABELS[fuel] : '—'}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                      {fuel !== null ? `${fuel}/4` : 'optional'}
                    </span>
                  </div>
                  <input
                    type="range" min={0} max={4} step={1}
                    value={fuel ?? 2}
                    onChange={e => setFuel(Number(e.target.value) as FuelLevel)}
                    onPointerDown={() => { if (fuel === null) setFuel(2); }}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gray-200 dark:bg-gray-700 transition-colors"
                    style={{ accentColor: fuel !== null ? FUEL_COLORS[fuel] : '#9ca3af' }}
                  />
                  <div className="flex justify-between px-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <div key={i} className={`w-px h-1.5 rounded-full transition-colors ${fuel !== null && i <= fuel ? 'bg-gray-400' : 'bg-gray-300 dark:bg-gray-700'}`} />
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500">
                    <span>E</span><span>¼</span><span>½</span><span>¾</span><span>F</span>
                  </div>
                </div>
              </div>
            )}

            {/* Authorization */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Authorization *</label>
              <div className="space-y-1.5">
                {AUTH_OPTIONS.map(a => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setAuthorization(a.value)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg border text-sm transition cursor-pointer ${
                      authorization === a.value
                        ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-gray-900 dark:text-gray-100 font-medium'
                        : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Logging as */}
            {user && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Logging as: <span className="font-semibold">{user.name ?? user.id}</span> · {user.role} · #{user.employeeId}
              </p>
            )}

            {/* Start Trip */}
            <button
              type="button"
              disabled={!canStart}
              onClick={handleStartTrip}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition cursor-pointer"
            >
              Start Trip →
            </button>
          </>
        )}

        {/* ─── IN TRANSIT ────────────────────────────────────────────────── */}
        {tripState === 'in_transit' && (
          <div className="space-y-3">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg px-4 py-4 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-2">In Transit</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{plate}</p>
                  {vehicleMeta && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{vehicleMeta.split(' · ')[0]}</p>}
                  <p className="text-sm text-amber-700 dark:text-amber-400 mt-2 font-medium">{from} → {to}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {authorization === 'MANAGEMENT' ? 'Management Decision' : authorization === 'LEAD_VSA' ? 'Lead VSA Authorization' : 'Personal — Proactive'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Departed {fmtTime(departureTime)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 tabular-nums">{elapsed || '0m 00s'}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">elapsed</p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleArrived}
              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
            >
              ✓ Arrived at Destination
            </button>
          </div>
        )}

        {/* ─── COMPLETE ──────────────────────────────────────────────────── */}
        {tripState === 'complete' && (
          <div className="space-y-3">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-lg overflow-hidden transition-colors">
              <div className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-widest mb-1.5">Trip Complete</p>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{plate}</span>
                    {vehicleMeta && (
                      <>
                        <span className="text-gray-400 dark:text-gray-600 text-xs">·</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{vehicleMeta.split(' · ')[0]}</span>
                      </>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{from} → {to}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {buildMetaLine(from, to, departureTime, arrivalTime, queue, fuel)}
                  </p>
                </div>
                <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  condition === 'CLEAN'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                }`}>
                  {condition === 'CLEAN' ? 'Clean' : 'Dirty'}
                </span>
              </div>
              {/* Interruption / Proactive badge */}
              <div className={`px-4 py-2 border-t ${
                authorization === 'PERSONAL'
                  ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-100 dark:border-teal-900/30'
                  : 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30'
              } transition-colors`}>
                <span className={`text-xs font-semibold ${
                  authorization === 'PERSONAL' ? 'text-teal-700 dark:text-teal-400' : 'text-amber-700 dark:text-amber-400'
                }`}>
                  {authorization === 'PERSONAL' ? '🌀 Proactive Run' : '⚠️ VSA Interruption'}
                  <span className="font-normal opacity-70 mx-1">·</span>
                  <span className="font-normal">{REASON_LABELS[reason!]}</span>
                </span>
              </div>
            </div>
            <button type="button" onClick={handleReset} className="text-xs font-semibold text-yellow-600 hover:text-yellow-800 transition cursor-pointer">
              Log another run →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
