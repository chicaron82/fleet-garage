import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ModuleHeader } from '../shared/ModuleHeader';
import { useCanDemo } from '../../hooks/useCanDemo';
import { canRelease } from '../../types';
import { MOCK_TRIPS } from '../../data/trips';
import type { TripRun } from '../../data/trips';
import { supabase } from '../../lib/supabase';
import { hapticMedium } from '../../lib/haptics';
import { localDateStr } from '../../hooks/useFleetBalance';
import { shiftDayStartISO } from '../../lib/shiftDay';
import { DriverLiveForm } from './DriverLiveForm';
import { getTripDurationMinutes } from '../../lib/trip-utils';
import { generateDayManifest, getNextFiveNeeded } from '../../data/manifest';
import { loadFlags } from '../../lib/manifestFlags';
import { loadOverrides } from '../../lib/classOverrides';
import { DriverDemoForm } from './DriverDemoForm';
import { TripList, SummaryCard } from './TripList';
import { MovementLogVsaView } from './MovementLogVsaView';

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
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
  const [liveTrips, setLiveTrips] = useState<TripRun[]>([]);
  const [driverMode, setDriverMode] = useState<'demo' | 'live'>('live');
  const canDemo = useCanDemo();

  const [copied, setCopied] = useState(false);


  const { topClasses, flaggedClasses, overrideClasses } = useMemo(() => {
    const manifest  = generateDayManifest();
    const flags     = loadFlags();
    const overrides = loadOverrides();
    const next5     = getNextFiveNeeded(manifest);
    const manifestFlagged = [...new Set(manifest.filter(r => flags.has(r.id)).map(r => r.rentalClass))];
    return {
      topClasses:     [...new Set(next5.map(r => r.rentalClass))].slice(0, 3),
      flaggedClasses: [...new Set([...overrides, ...manifestFlagged])],
      overrideClasses: [...overrides],
    };
  }, []);

  useEffect(() => {
    async function loadTrips() {
      const { data } = await supabase
        .from('vsa_trips')
        .select('*')
        .gte('depart_time', shiftDayStartISO(localDateStr(0)))
        .not('arrive_time', 'is', null)
        .order('depart_time', { ascending: false });

      if (data) {
        const rows = data as Record<string, unknown>[];
        const plates = [...new Set(rows.map(r => r.vehicle_plate as string).filter(Boolean))];
        
        let vehicleMap = new Map();
        if (plates.length > 0) {
          const { data: vData } = await supabase
            .from('vehicles')
            .select('license_plate, make, model, year, color')
            .in('license_plate', plates);
          if (vData) {
            vehicleMap = new Map(vData.map(v => [v.license_plate, v]));
          }
        }

        setLiveTrips(rows.map(row => {
          const trip = rowToTrip(row);
          const vInfo = vehicleMap.get(trip.vehiclePlate);
          if (vInfo) {
            trip.vehicleMake = vInfo.make;
            trip.vehicleModel = vInfo.model;
            trip.vehicleYear = vInfo.year;
            trip.vehicleColor = vInfo.color;
          }
          return trip;
        }));
      }

      // Check for any in_progress trip for this user
    }
    loadTrips();
  }, [user?.id, user?.role]);

  if (!user) return null;


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


  const buildTripLog = (trips: TripRun[]): string => {
    const clean    = trips.filter(t => t.tripType === 'clean').length;
    const dirty    = trips.filter(t => t.tripType === 'dirty').length;
    const other    = trips.length - clean - dirty;
    const header   = [
      'Fleet Garage — Driver Trip Log',
      `${user.name ?? user.id} · #${user.employeeId} · ${user.branchId}`,
      today,
      '',
      `${trips.length} run${trips.length !== 1 ? 's' : ''} · ${clean} clean · ${dirty} dirty · ${other} other`,
      '',
    ].join('\n');
    const rows = trips.map(t => {
      const dur = getTripDurationMinutes(t);
      return `${fmtTime(t.departTime)}  ${t.vehiclePlate.padEnd(10)}  ${t.departLocation} → ${t.arriveLocation}  (${dur}m)`;
    });
    return header + rows.join('\n');
  };

  const handleShareLog = async (trips: TripRun[]) => {
    hapticMedium();
    const text  = buildTripLog(trips);
    const title = `Trip Log — ${user.name ?? user.id} · ${new Date().toLocaleDateString('en-CA')}`;
    if (navigator.share) {
      try { await navigator.share({ title, text }); return; } catch { /* fall through */ }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // ── VSA view — Movement Log + Off-Standard Time tabs ─────────────────────
  if (isVSA) {
    return <MovementLogVsaView user={user} today={today} liveTrips={liveTrips} setLiveTrips={setLiveTrips} />;
  }

  // ── Driver / CSR / HIR / Management ──────────────────────────────────────
  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">
      <ModuleHeader
        align="start"
        title={isManagement ? 'All Trips Today' : "Today's Runs"}
        subtitle={today}
        action={!isVSA && !isManagement && canDemo ? (
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
        ) : undefined}
      />

      {/* Log trip — Live or Demo */}
      {!isManagement && driverMode === 'live' ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Log Trip</p>
          </div>
          <div className="p-4">
            <DriverLiveForm
              flaggedClasses={overrideClasses}
              onTripComplete={trip => setLiveTrips(prev => [trip, ...prev])}
            />
          </div>
        </div>
      ) : !isManagement && (
        <DriverDemoForm flaggedClasses={flaggedClasses} topClasses={topClasses} />
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
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Logged Today</p>
              <button
                type="button"
                onClick={() => handleShareLog(liveOnly)}
                className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition cursor-pointer"
              >
                {copied ? '✓ Copied' : 'Share log ↗'}
              </button>
            </div>
            <TripList trips={liveOnly} isManagement={false} />
          </div>
        );
      })() : (
        <>
          {myTrips.length > 0 && (
            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Logged Today</p>
              <button
                type="button"
                onClick={() => handleShareLog(myTrips)}
                className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition cursor-pointer"
              >
                {copied ? '✓ Copied' : 'Share log ↗'}
              </button>
            </div>
          )}
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
