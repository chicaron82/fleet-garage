import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ModuleHeader } from '../shared/ModuleHeader';
import { canRelease } from '../../types';
import type { TripRun } from '../../data/trips';
import { supabase } from '../../lib/supabase';
import { ShareAction } from '../shared/ShareAction';
import { localDateStr } from '../../hooks/useFleetBalance';
import { shiftDayStartISO } from '../../lib/shiftDay';
import { DriverLiveForm } from './DriverLiveForm';
import { getTripDurationMinutes } from '../../lib/trip-utils';
import { loadOverrides } from '../../lib/classOverrides';
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
    oneWay:          (row.one_way as boolean) ?? false,
    authorization:   (row.auth_type as TripRun['authorization']) ?? undefined,
    reason:          (row.reason as TripRun['reason']) ?? undefined,
    queueAtDeparture: (row.queue_at_departure as string) ?? undefined,
    fuelOnArrival:   (row.fuel_on_arrival as string) ?? undefined,
    condition:       (row.condition as TripRun['condition']) ?? undefined,
    notes:           (row.notes as string) ?? undefined,
  };
}



export function MovementLogView({ prefillPlate }: { prefillPlate?: string } = {}) {
  const { user } = useAuth();

  // All hooks unconditional — declare before early returns
  const [liveTrips, setLiveTrips] = useState<TripRun[]>([]);

  // Class overrides the operator flagged as priority — surfaced in the live trip form.
  const overrideClasses = useMemo(() => [...loadOverrides()], []);

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

  const buildTripShare = (trips: TripRun[]) => ({
    title: `Trip Log — ${user.name ?? user.id} · ${new Date().toLocaleDateString('en-CA')}`,
    text: buildTripLog(trips),
  });

  // ── VSA view — Movement Log + Off-Standard Time tabs ─────────────────────
  if (isVSA) {
    return <MovementLogVsaView user={user} today={today} prefillPlate={prefillPlate} liveTrips={liveTrips} setLiveTrips={setLiveTrips} />;
  }

  // ── Driver / CSR / HIR / Management ──────────────────────────────────────
  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">
      <ModuleHeader
        align="start"
        title={isManagement ? 'All Trips Today' : "Today's Runs"}
        subtitle={today}
      />

      {/* Log trip */}
      {!isManagement && (
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
      )}

      {/* Summary */}
      {(() => {
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
      })()}

      {/* Trip list */}
      {(() => {
        const liveOnly = liveTrips.filter(t => t.driverId === user.id);
        return liveOnly.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 text-center transition-colors">
            <p className="text-gray-400 dark:text-gray-500 text-sm">No runs logged today.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Logged Today</p>
              <ShareAction label="Share log" build={() => buildTripShare(liveOnly)} />
            </div>
            <TripList trips={liveOnly} isManagement={false} />
          </div>
        );
      })()}
    </div>
  );
}
