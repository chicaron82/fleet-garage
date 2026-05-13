import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { hapticLight, hapticMedium } from '../lib/haptics';
import { useGarage } from '../context/GarageContext';
import type { TripRun } from '../data/trips';
import { generateDayManifest, getNextFiveNeeded } from '../data/manifest';
import { loadFlags } from '../lib/manifestFlags';
import { loadOverrides } from '../lib/classOverrides';
import { elapsedSince, TRIP_DURATION_THRESHOLDS } from '../lib/vsa-trip';
import type { Reason, Authorization, QueueSnapshot, TripState } from '../lib/vsa-trip';
import { pushNotification } from '../lib/garage-uploads';
import { detectTeslaByPlate } from '../lib/ev-detection';
import { TripForm } from './TripForm';
import { TripInTransit } from './TripInTransit';
import { TripComplete } from './TripComplete';
import type { EvAssetStatus } from '../types';

export type { TripState };

export type TripStartInfo = {
  departTime: string;
  tripType: 'clean' | 'transfer';
  authorization: Authorization;
  reason: Reason;
  queueAtDeparture: QueueSnapshot | null;
  notes: string;
  vehiclePlate?: string;
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
  const { shuttlePlate, setShuttlePlate } = useGarage();

  const [tripState, setTripState]           = useState<TripState>('form');
  const [reason, setReason]                 = useState<Reason | null>(null);
  const [queue, setQueue]                   = useState<QueueSnapshot | null>(null);
  const [authorization, setAuthorization]   = useState<Authorization | null>(null);
  const [notes, setNotes]                   = useState('');
  const [isShuttle, setIsShuttle]           = useState(false);
  const [departureTime, setDepartureTime]   = useState('');
  const [arrivalTime, setArrivalTime]       = useState('');
  const [elapsed, setElapsed]               = useState('');

  const [vehiclePlate, setVehiclePlate]       = useState('');
  const [isTeslaRun, setIsTeslaRun]           = useState(false);
  const [evCableStatus, setEvCableStatus]     = useState<EvAssetStatus | null>(null);
  const [evAdapterStatus, setEvAdapterStatus] = useState<EvAssetStatus | null>(null);

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
    if (tripState !== 'in_transit' || !departureTime) return;
    const id = setInterval(() => setElapsed(elapsedSince(departureTime)), 1000);
    return () => clearInterval(id);
  }, [tripState, departureTime]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('vsa_trips')
      .select('id, vehicle_plate, depart_location, depart_time, trip_type, is_shuttle, auth_type, reason, queue_at_departure, ev_cable_status, ev_adapter_status')
      .eq('driver_id', user.id)
      .eq('status', 'in_progress')
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const row = data as Record<string, unknown>;
        setDepartureTime(row.depart_time as string);
        setVehiclePlate((row.vehicle_plate as string) ?? '');
        setIsShuttle((row.is_shuttle as boolean) ?? false);
        setAuthorization((row.auth_type as Authorization) ?? null);
        setReason((row.reason as Reason) ?? null);
        const rawQueue = row.queue_at_departure;
        setQueue(rawQueue
          ? (typeof rawQueue === 'string' ? JSON.parse(rawQueue) : rawQueue as QueueSnapshot)
          : { count: 0, label: 'Resumed' });
        setTripState('in_transit');
        const plate = (row.vehicle_plate as string) ?? '';
        if (plate) {
          detectTeslaByPlate(plate).then(res => {
            if (res.isTesla) {
              setIsTeslaRun(true);
              setEvCableStatus((row.ev_cable_status as EvAssetStatus) ?? null);
              setEvAdapterStatus((row.ev_adapter_status as EvAssetStatus) ?? null);
            }
          });
        }
      });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleShuttleToggle = (checked: boolean) => {
    if (checked === isShuttle) return;
    hapticLight();
    setIsShuttle(checked);
    if (checked && shuttlePlate) setVehiclePlate(shuttlePlate.toUpperCase());
    else if (!checked && shuttlePlate && vehiclePlate === shuttlePlate.toUpperCase()) setVehiclePlate('');
  };

  const handlePlateBlur = async () => {
    const result = await detectTeslaByPlate(vehiclePlate);
    if (result.isTesla) {
      setIsTeslaRun(true);
      setEvCableStatus(result.lastCable);
      setEvAdapterStatus(result.lastAdapter);
    }
  };

  const canStart = reason !== null && !!authorization && queue !== null;

  const handleStartTripWith = (r: Reason, auth: Authorization, tripNotes: string) => {
    hapticMedium();
    const now = new Date().toISOString();
    setReason(r);
    setAuthorization(auth);
    setNotes(tripNotes);
    setDepartureTime(now);
    setElapsed('0m 00s');
    setTripState('in_transit');
    onTripStarted?.({
      departTime:       now,
      tripType:         isShuttle ? 'transfer' : 'clean',
      authorization:    auth,
      reason:           r,
      queueAtDeparture: queue,
      notes:            tripNotes.trim(),
      vehiclePlate:     vehiclePlate.trim() || undefined,
      evCableStatus:    isTeslaRun ? evCableStatus : undefined,
      evAdapterStatus:  isTeslaRun ? evAdapterStatus : undefined,
    });
  };

  const handleStartTrip = () => {
    handleStartTripWith(reason!, authorization!, notes);
  };

  const handleCodeRedDispatch = () => {
    if (!queue) {
      setQueue('0');
    }
    handleStartTripWith('CODE_RED', 'MANAGEMENT', 'Code Red dispatch');
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
    setVehiclePlate('');
    setIsTeslaRun(false);
    setEvCableStatus(null);
    setEvAdapterStatus(null);
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
            vehiclePlate={vehiclePlate} setVehiclePlate={setVehiclePlate} onPlateBlur={handlePlateBlur}
            topClasses={topClasses} flaggedClasses={flaggedClasses}
            canStart={canStart}
            onShuttleToggle={handleShuttleToggle}
            onStartTrip={handleStartTrip}
            onCodeRedDispatch={handleCodeRedDispatch}
            isTeslaRun={isTeslaRun}         setIsTeslaRun={setIsTeslaRun}
            evCableStatus={evCableStatus}   setEvCableStatus={setEvCableStatus}
            evAdapterStatus={evAdapterStatus} setEvAdapterStatus={setEvAdapterStatus}
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
