import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { hapticLight, hapticMedium } from '../lib/haptics';
import { useGarage } from '../context/GarageContext';
import { supabase } from '../lib/supabase';
import { isTesla } from '../lib/vehicles';
import type { TripRun } from '../data/trips';
import { generateDayManifest, getNextFiveNeeded } from '../data/manifest';
import { loadFlags } from '../lib/manifestFlags';
import { elapsedSince, TRIP_DURATION_THRESHOLDS } from '../lib/vsa-trip';
import type { Reason, Authorization, QueueSnapshot, TripState } from '../lib/vsa-trip';
import { pushNotification } from '../lib/garage-uploads';
import { TripForm } from './TripForm';
import { TripInTransit } from './TripInTransit';
import { TripComplete } from './TripComplete';
import type { EvLastCheck } from './EVAssetCheck';
import type { Vehicle, EvAssetStatus } from '../types';

export type { TripState };

export type TripStartInfo = {
  departTime: string;
  tripType: 'clean' | 'transfer';
  authorization: Authorization;
  reason: Reason;
  queueAtDeparture: QueueSnapshot | null;
  notes: string;
  vehicleUnit?: string;
  evCableStatus?: 'present' | 'missing' | null;
  evAdapterStatus?: 'present' | 'missing' | null;
};

export function VSAMovementLog({
  onTripComplete,
  onTripStarted,
}: {
  onTripComplete?: (trip: TripRun) => void;
  onTripStarted?: (info: TripStartInfo) => void;
}) {
  const { user } = useAuth();
  const { shuttlePlate, setShuttlePlate, getVehicleByUnit } = useGarage();

  const [tripState, setTripState]           = useState<TripState>('form');
  const [reason, setReason]                 = useState<Reason | null>(null);
  const [queue, setQueue]                   = useState<QueueSnapshot | null>(null);
  const [authorization, setAuthorization]   = useState<Authorization | null>(null);
  const [notes, setNotes]                   = useState('');
  const [isShuttle, setIsShuttle]           = useState(false);
  const [departureTime, setDepartureTime]   = useState('');
  const [arrivalTime, setArrivalTime]       = useState('');
  const [elapsed, setElapsed]               = useState('');

  const [vehicleUnit, setVehicleUnit]       = useState('');
  const [teslaVehicle, setTeslaVehicle]     = useState<Vehicle | null>(null);
  const [evCableStatus, setEvCableStatus]   = useState<EvAssetStatus | null>(null);
  const [evAdapterStatus, setEvAdapterStatus] = useState<EvAssetStatus | null>(null);
  const [lastEvCheck, setLastEvCheck]       = useState<EvLastCheck | null>(null);

  const { topClasses, flaggedClasses } = useMemo(() => {
    const manifest = generateDayManifest();
    const flags    = loadFlags();
    const next5    = getNextFiveNeeded(manifest);
    return {
      topClasses:     [...new Set(next5.map(r => r.rentalClass))].slice(0, 3),
      flaggedClasses: [...new Set(manifest.filter(r => flags.has(r.id)).map(r => r.rentalClass))],
    };
  }, []);

  useEffect(() => {
    if (tripState !== 'in_transit' || !departureTime) return;
    const id = setInterval(() => setElapsed(elapsedSince(departureTime)), 1000);
    return () => clearInterval(id);
  }, [tripState, departureTime]);

  useEffect(() => {
    const trimmed = vehicleUnit.trim().toUpperCase();
    if (!trimmed) { setTeslaVehicle(null); setLastEvCheck(null); return; }
    const vehicle = getVehicleByUnit(trimmed);
    if (!vehicle || !isTesla(vehicle)) { setTeslaVehicle(null); setLastEvCheck(null); return; }
    setTeslaVehicle(vehicle);
    setEvCableStatus(null);
    setEvAdapterStatus(null);

    async function fetchLastCheck() {
      const [{ data: trip }, { data: checkin }] = await Promise.all([
        supabase.from('vsa_trips')
          .select('ev_cable_status, ev_adapter_status, depart_time, driver_id')
          .eq('vehicle_unit', trimmed)
          .not('ev_cable_status', 'is', null)
          .order('depart_time', { ascending: false })
          .limit(1).maybeSingle(),
        supabase.from('vehicle_checkins')
          .select('ev_cable_status, ev_adapter_status, created_at, checked_in_by_name')
          .eq('vehicle_unit', trimmed)
          .not('ev_cable_status', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1).maybeSingle(),
      ]);
      const candidates: EvLastCheck[] = [];
      if (trip) {
        const r = trip as Record<string, unknown>;
        candidates.push({
          cableStatus:   (r.ev_cable_status as EvAssetStatus) ?? null,
          adapterStatus: (r.ev_adapter_status as EvAssetStatus) ?? null,
          when:          r.depart_time as string,
          byName:        (r.driver_id as string) ?? 'Unknown',
        });
      }
      if (checkin) {
        const r = checkin as Record<string, unknown>;
        candidates.push({
          cableStatus:   (r.ev_cable_status as EvAssetStatus) ?? null,
          adapterStatus: (r.ev_adapter_status as EvAssetStatus) ?? null,
          when:          r.created_at as string,
          byName:        (r.checked_in_by_name as string) ?? 'Unknown',
        });
      }
      if (candidates.length === 0) { setLastEvCheck(null); return; }
      candidates.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
      setLastEvCheck(candidates[0]);
    }
    fetchLastCheck();
  }, [vehicleUnit]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleShuttleToggle = (checked: boolean) => {
    hapticLight();
    setIsShuttle(checked);
  };

  const canStart = reason !== null && !!authorization && queue !== null;

  const handleStartTrip = () => {
    hapticMedium();
    const now = new Date().toISOString();
    setDepartureTime(now);
    setElapsed('0m 00s');
    setTripState('in_transit');
    onTripStarted?.({
      departTime:       now,
      tripType:         isShuttle ? 'transfer' : 'clean',
      authorization:    authorization!,
      reason:           reason!,
      queueAtDeparture: queue,
      notes:            notes.trim(),
      vehicleUnit:      teslaVehicle ? vehicleUnit.trim().toUpperCase() : undefined,
      evCableStatus:    teslaVehicle ? evCableStatus : undefined,
      evAdapterStatus:  teslaVehicle ? evAdapterStatus : undefined,
    });
  };

  const handleArrived = async () => {
    hapticMedium();
    const arrived = new Date().toISOString();
    setArrivalTime(arrived);
    setTripState('complete');

    if (onTripComplete && user) {
      onTripComplete({
        id:                `vsa-session-${Date.now()}`,
        vehicleUnit:       '',
        vehiclePlate:      '',
        tripType:          isShuttle ? 'transfer' : 'clean',
        departLocation:    'Airport Run',
        arriveLocation:    'Airport Run',
        departTime:        departureTime,
        arriveTime:        arrived,
        gasLevel:          '',
        odometer:          0,
        driverId:          user.id,
        isVsaInterruption: true,
        authorization:     authorization ?? undefined,
        reason:            reason ?? undefined,
        queueAtDeparture:  queue ?? undefined,
        notes:             notes.trim() || undefined,
        branchId:          user.branchId,
      });
    }

    if (user && departureTime) {
      const elapsedMinutes = Math.round(
        (new Date(arrived).getTime() - new Date(departureTime).getTime()) / 60000
      );
      if (elapsedMinutes > TRIP_DURATION_THRESHOLDS.alert) {
        await pushNotification(
          user.branchId,
          ['Branch Manager', 'Operations Manager', 'City Manager', 'Lead VSA'],
          '🐢',
          `Long airport run — ${user.name} · Airport Run · ${elapsedMinutes} minutes`,
          'warning',
          { userId: user.id, elapsedMinutes },
        );
      }
    }
  };

  const handleReset = () => {
    setTripState('form');
    setReason(null);
    setQueue(null);
    setAuthorization(null);
    setNotes('');
    setIsShuttle(false);
    setDepartureTime('');
    setArrivalTime('');
    setElapsed('');
    setVehicleUnit('');
    setTeslaVehicle(null);
    setEvCableStatus(null);
    setEvAdapterStatus(null);
    setLastEvCheck(null);
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Movement Log</p>
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
        {tripState === 'form' && (
          <TripForm
            queue={queue}           setQueue={setQueue}
            reason={reason}         setReason={setReason}
            authorization={authorization} setAuthorization={setAuthorization}
            notes={notes}           setNotes={setNotes}
            isShuttle={isShuttle}   shuttlePlate={shuttlePlate} setShuttlePlate={setShuttlePlate}
            topClasses={topClasses} flaggedClasses={flaggedClasses}
            canStart={canStart}
            onShuttleToggle={handleShuttleToggle}
            onStartTrip={handleStartTrip}
            vehicleUnit={vehicleUnit}       setVehicleUnit={setVehicleUnit}
            teslaVehicle={teslaVehicle}
            evCableStatus={evCableStatus}   setEvCableStatus={setEvCableStatus}
            evAdapterStatus={evAdapterStatus} setEvAdapterStatus={setEvAdapterStatus}
            lastEvCheck={lastEvCheck}
          />
        )}

        {tripState === 'in_transit' && (
          <TripInTransit
            authorization={authorization}
            departureTime={departureTime} elapsed={elapsed}
            notes={notes}           setNotes={setNotes}
            onArrived={handleArrived}
          />
        )}

        {tripState === 'complete' && (
          <TripComplete
            isShuttle={isShuttle}
            authorization={authorization} reason={reason}
            departureTime={departureTime} arrivalTime={arrivalTime}
            queue={queue}
            notes={notes}           setNotes={setNotes}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}
