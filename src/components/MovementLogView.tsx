import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { canRelease } from '../types';
import { MOCK_TRIPS } from '../data/trips';
import type { TripRun } from '../data/trips';
import { supabase } from '../lib/supabase';
import { MockBarcodeScanner } from './MockBarcodeScanner';
import { VSAMovementLog } from './VSAMovementLog';
import { OffStandardTimeLog } from './OffStandardTimeLog';
import { DriverLiveForm } from './DriverLiveForm';
import { PriorityHint } from './PriorityHint';
import { getTripDurationMinutes, isTripFlagged } from '../lib/trip-utils';
import type { ScannedPayload, OffStandardEntry } from '../types';
import { generateDayManifest, getNextFiveNeeded } from '../data/manifest';
import { loadFlags } from '../lib/manifestFlags';
import { loadOverrides } from '../lib/classOverrides';

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
}

const LOCATIONS = ['Washbay', 'Airport', 'Branch', 'Other'] as const;
type Location = typeof LOCATIONS[number];

type TripScanState = 'idle' | 'in_transit' | 'completed';

function elapsedLabel(from: string, to: string) {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

function rowToTrip(row: Record<string, unknown>): TripRun {
  return {
    id:              row.id as string,
    vehiclePlate:    row.vehicle_plate as string,
    vehicleUnit:     row.vehicle_unit as string,
    tripType:        row.trip_type as TripRun['tripType'],
    departLocation:  row.depart_location as string,
    arriveLocation:  row.arrive_location as string,
    departTime:      row.depart_time as string,
    arriveTime:      row.arrive_time as string,
    gasLevel:        '',
    odometer:        0,
    driverId:        row.driver_id as string,
    branchId:        (row.branch_id as string ?? 'YWG') as TripRun['branchId'],
    isVsaInterruption: (row.is_vsa_interruption as boolean) ?? false,
    authorization:   (row.auth_type as TripRun['authorization']) ?? undefined,
    reason:          (row.reason as TripRun['reason']) ?? undefined,
    queueAtDeparture: (row.queue_at_departure as string) ?? undefined,
    fuelOnArrival:   (row.fuel_on_arrival as string) ?? undefined,
    condition:       (row.condition as TripRun['condition']) ?? undefined,
    notes:           (row.notes as string) ?? undefined,
  };
}

export function MovementLogView() {
  const { user } = useAuth();

  // All hooks unconditional — declare before early returns
  const [tripState, setTripState] = useState<TripScanState>('idle');
  const [origin, setOrigin] = useState<Location>('Washbay');
  const [destination, setDestination] = useState<Location>('Airport');
  const [customOrigin, setCustomOrigin] = useState('');
  const [customDestination, setCustomDestination] = useState('');
  const [activeUnit, setActiveUnit] = useState<ScannedPayload | null>(null);
  const [departureTime, setDepartureTime] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [liveTrips, setLiveTrips] = useState<TripRun[]>([]);
  const [driverMode, setDriverMode] = useState<'demo' | 'live'>('demo');

  // Off-standard state lifted here so it survives tab switches
  const [activeTab, setActiveTab] = useState<'movement-log' | 'off-standard'>('movement-log');
  const [offStandardEntries, setOffStandardEntries] = useState<OffStandardEntry[]>([]);

  const { topClasses, flaggedClasses } = useMemo(() => {
    const manifest  = generateDayManifest();
    const flags     = loadFlags();
    const overrides = loadOverrides();
    const next5     = getNextFiveNeeded(manifest);
    const manifestFlagged = [...new Set(manifest.filter(r => flags.has(r.id)).map(r => r.rentalClass))];
    return {
      topClasses:     [...new Set(next5.map(r => r.rentalClass))].slice(0, 3),
      flaggedClasses: [...new Set([...overrides, ...manifestFlagged])],
    };
  }, []);

  useEffect(() => {
    async function loadTrips() {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from('vsa_trips')
        .select('*')
        .gte('depart_time', todayStart.toISOString())
        .order('depart_time', { ascending: false });
      if (data) setLiveTrips((data as Record<string, unknown>[]).map(rowToTrip));
    }
    loadTrips();
  }, []);

  if (!user) return null;

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

  const isVSA = user.role === 'VSA' || user.role === 'Lead VSA';
  const isManagement = canRelease(user.role);

  const myTrips = [
    ...MOCK_TRIPS.filter(t => t.driverId === user.id),
    ...liveTrips.filter(t => t.driverId === user.id),
  ];
  const allLiveAndMock = [...MOCK_TRIPS, ...liveTrips];
  const displayTrips = isManagement ? allLiveAndMock : myTrips;

  const cleanCount    = displayTrips.filter(t => t.tripType === 'clean').length;
  const dirtyCount    = displayTrips.filter(t => t.tripType === 'dirty').length;
  const customerCount = displayTrips.filter(t => t.tripType === 'customer').length;
  const transferCount = displayTrips.filter(t => t.tripType === 'transfer').length;
  const totalRuns     = displayTrips.length;

  const today = new Date().toLocaleDateString('en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // ── VSA view — Movement Log + Off-Standard Time tabs ─────────────────────
  if (isVSA) {
    const myLiveTrips  = liveTrips.filter(t => t.driverId === user.id);

    const addOffStandardEntry = (entry: OffStandardEntry) => {
      setOffStandardEntries(prev => [...prev, entry]);
    };

    const handleTripComplete = async (trip: TripRun) => {
      const { error } = await supabase.from('vsa_trips').insert({
        id:                  trip.id,
        vehicle_plate:       trip.vehiclePlate,
        vehicle_unit:        trip.vehicleUnit,
        trip_type:           trip.tripType,
        depart_location:     trip.departLocation,
        arrive_location:     trip.arriveLocation,
        depart_time:         trip.departTime,
        arrive_time:         trip.arriveTime,
        driver_id:           trip.driverId,
        is_vsa_interruption: trip.isVsaInterruption ?? false,
        auth_type:           trip.authorization ?? null,
        reason:              trip.reason ?? null,
        queue_at_departure:  trip.queueAtDeparture ?? null,
        fuel_on_arrival:     trip.fuelOnArrival ?? null,
        condition:           trip.condition ?? null,
        is_shuttle:          trip.tripType === 'transfer',
        notes:               trip.notes ?? null,
        branch_id:           trip.branchId,
      });
      if (!error) setLiveTrips(prev => [trip, ...prev]);

      // Auto-create off-standard entry for VSA airport runs (≥5 min)
      if (trip.isVsaInterruption && trip.tripType !== 'transfer') {
        const minutes = Math.round(
          (new Date(trip.arriveTime).getTime() - new Date(trip.departTime).getTime()) / 60000
        );
        if (minutes >= 5) {
          addOffStandardEntry({
            id:           `auto-${trip.id}`,
            startTime:    trip.departTime,
            stopTime:     trip.arriveTime,
            minutes,
            reason:       'OTH',
            explanation:  `VSA Airport Run`,
            autoFromTrip: true,
          });
        }
      }
    };

    return (
      <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 transition-colors">Movement Log</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 transition-colors">{today}</p>
        </div>

        {/* Tab strip */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
          {(['movement-log', 'off-standard'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === tab
                  ? 'text-yellow-600 dark:text-yellow-400 border-b-2 border-yellow-500 -mb-px'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab === 'movement-log' ? 'Movement Log' : 'Off-Standard Time'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'movement-log' ? (
          <>
            <VSAMovementLog onTripComplete={handleTripComplete} />
            {myLiveTrips.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Your Runs Today</p>
                <TripList trips={myLiveTrips} isManagement={false} />
              </div>
            )}
          </>
        ) : (
          <OffStandardTimeLog
            entries={offStandardEntries}
            onAddEntry={addOffStandardEntry}
            user={user}
          />
        )}
      </div>
    );
  }

  // ── Driver / CSR / HIR / Management ──────────────────────────────────────
  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 transition-colors">
            {isManagement ? 'All Trips Today' : "Today's Runs"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 transition-colors">{today}</p>
        </div>
        {!isVSA && !isManagement && (
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {(['live', 'demo'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setDriverMode(mode)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                  driverMode === mode
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Log trip — Live or Demo */}
      {!isManagement && driverMode === 'live' ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Log Trip</p>
          </div>
          <div className="p-4">
            <DriverLiveForm
              onTripComplete={trip => setLiveTrips(prev => [trip, ...prev])}
            />
          </div>
        </div>
      ) : !isManagement && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Log Trip</p>
            {tripState !== 'idle' && (
              <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer">Reset</button>
            )}
          </div>
          <div className="p-4 space-y-4">
            {tripState === 'idle' && (
              <>
                <PriorityHint flaggedClasses={flaggedClasses} topClasses={topClasses} />
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
      )}

      {/* Summary */}
      {driverMode === 'live' ? (() => {
        const liveOnly = liveTrips.filter(t => t.driverId === user.id);
        const liveOther = liveOnly.filter(t => t.tripType !== 'clean' && t.tripType !== 'dirty').length;
        return (
          <div className="grid grid-cols-4 gap-3">
            <SummaryCard value={liveOnly.length}                                          label="Total"  color="text-gray-900 dark:text-gray-100" />
            <SummaryCard value={liveOnly.filter(t => t.tripType === 'clean').length}      label="Clean"  color="text-green-600 dark:text-green-500" />
            <SummaryCard value={liveOnly.filter(t => t.tripType === 'dirty').length}      label="Dirty"  color="text-amber-500" />
            <SummaryCard value={liveOther}                                                label="Other"  color="text-gray-500 dark:text-gray-400" />
          </div>
        );
      })() : (
        <div className="grid grid-cols-5 gap-3">
          <SummaryCard value={totalRuns}     label="Total"    color="text-gray-900 dark:text-gray-100" />
          <SummaryCard value={cleanCount}    label="Clean"    color="text-green-600 dark:text-green-500" />
          <SummaryCard value={dirtyCount}    label="Dirty"    color="text-amber-500" />
          <SummaryCard value={customerCount} label="Customer" color="text-blue-600 dark:text-blue-500" />
          <SummaryCard value={transferCount} label="Transfer" color="text-purple-600 dark:text-purple-500" />
        </div>
      )}

      {/* Trip list */}
      {driverMode === 'live' ? (() => {
        const liveOnly = liveTrips.filter(t => t.driverId === user.id);
        return liveOnly.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 text-center transition-colors">
            <p className="text-gray-400 dark:text-gray-500 text-sm">No runs logged today.</p>
          </div>
        ) : (
          <TripList trips={liveOnly} isManagement={false} />
        );
      })() : (
        <>
          <TripList trips={myTrips} isManagement={false} />
          {myTrips.length === 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 text-center transition-colors">
              <p className="text-gray-400 dark:text-gray-500 text-sm">No runs logged today.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SummaryCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center transition-colors">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function TripList({ trips, isManagement }: { trips: typeof MOCK_TRIPS; isManagement: boolean }) {
  return (
    <div className="space-y-2">
      {trips.map(trip => {
        const duration = getTripDurationMinutes(trip);
        const flagged  = isTripFlagged(trip);
        return (
          <div key={trip.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm transition-colors">{trip.vehicleUnit}</span>
                  <span className="text-gray-400 dark:text-gray-600 text-xs">·</span>
                  <span className="text-gray-500 dark:text-gray-400 text-xs transition-colors">{trip.vehiclePlate}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">{trip.departLocation} → {trip.arriveLocation}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 transition-colors">
                  {fmtTime(trip.departTime)} → {fmtTime(trip.arriveTime)}
                  <span className={flagged ? 'text-amber-600 dark:text-amber-500 font-semibold' : ''}>
                    {' '}· {duration}m
                  </span>
                  {'gasLevel' in trip && trip.gasLevel ? ` · Gas: ${trip.gasLevel}` : ''}
                  {trip.queueAtDeparture ? ` · Queue: ${trip.queueAtDeparture === 'TOO_MUCH' ? '10+' : trip.queueAtDeparture}` : ''}
                  {trip.fuelOnArrival ? ` · Fuel: ${trip.fuelOnArrival}` : ''}
                </p>
                {trip.isVsaInterruption && (
                  <div className="mt-1.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
                      trip.authorization === 'PERSONAL'
                        ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    } transition-colors`}>
                      {trip.authorization === 'PERSONAL' ? '🌀 Proactive Run' : '⚠️ VSA Interruption'}
                    </span>
                  </div>
                )}
                {isManagement && flagged && (
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 transition-colors">
                      ⚠️ Long trip · {duration}m
                    </span>
                  </div>
                )}
                {trip.notes && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-2 transition-colors">"{trip.notes}"</p>
                )}
              </div>
              <TripBadge type={trip.tripType} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const TRIP_BADGE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  clean:    { bg: 'bg-green-100 dark:bg-green-900/30',   text: 'text-green-700 dark:text-green-400',   label: 'Clean' },
  dirty:    { bg: 'bg-amber-100 dark:bg-amber-900/30',   text: 'text-amber-700 dark:text-amber-400',   label: 'Dirty' },
  customer: { bg: 'bg-blue-100 dark:bg-blue-900/30',     text: 'text-blue-700 dark:text-blue-400',     label: 'Customer' },
  transfer: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', label: 'Transfer' },
};

function TripBadge({ type }: { type: string }) {
  const style = TRIP_BADGE_STYLES[type] ?? TRIP_BADGE_STYLES.clean;
  return (
    <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text} transition-colors`}>
      {style.label}
    </span>
  );
}
