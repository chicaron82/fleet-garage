import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { writeOrEnqueue } from '../../lib/vsaTripWrite';
import { withSubmitLock } from '../../lib/submitLock';
import { hapticLight, hapticMedium } from '../../lib/haptics';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useActiveSessions } from '../../context/ActiveSessionsContext';
import { useStartCollisionGuard } from '../../hooks/useStartCollisionGuard';
import { SessionCollisionGuard } from '../shared/SessionCollisionGuard';
import { useInProgressRecovery } from '../../hooks/useInProgressRecovery';
import type { TripRun } from '../../data/trips';
import { generateDayManifest } from '../../data/manifest';
import { loadFlags } from '../../lib/manifestFlags';
import { loadOverrides } from '../../lib/classOverrides';
import { elapsedSince, TRIP_DURATION_THRESHOLDS, DEFAULT_AUTH, buildArrivalUpdate, buildTripStartInsert, parseRecoveredQueue } from '../../lib/vsa-trip';
import type { Reason, Authorization, QueueSnapshot, TripState } from '../../lib/vsa-trip';
import { pushNotification } from '../../lib/garage-uploads';
import { detectTeslaByPlate } from '../../lib/ev-detection';
import { useEvDispatchWarning } from '../../hooks/useEvDispatchWarning';
import { TripForm } from './TripForm';
import { TripInTransit } from './TripInTransit';
import { TripComplete } from './TripComplete';
import { Toast } from '../shared/Toast';
import { useRegisterOnScan } from '../../hooks/useRegisterOnScan';
import type { EvAssetStatus } from '../../types';

export type { TripState };

export type TripStartInfo = {
  departTime: string;
  tripType: 'clean' | 'transfer';
  authorization: Authorization | null;
  reason: Reason;
  queueAtDeparture: QueueSnapshot | null;
  notes: string;
  vehiclePlate?: string;
  evCableStatus?: 'present' | 'missing' | null;
  evAdapterStatus?: 'present' | 'missing' | null;
};

export function TripStartForm({
  onTripComplete,
  onTripStarted,
  initialPlate,
}: {
  onTripComplete?: (trip: TripRun) => void;
  onTripStarted?: (info: TripStartInfo) => void;
  /** Plate handed in by the scan-router ("Start trip" on a scanned tag) — starts the form filled. */
  initialPlate?: string;
}) {
  const { user } = useAuth();
  const { shuttlePlate, setShuttlePlate, addVehicle, updateVehicleFields, vehicles } = useVehicleHoldContext();
  // Scanning a key tag to start a trip registers a new vehicle (or backfills a partial) so the
  // trip isn't logged against a car FG doesn't fully know.
  const { registerToast, handleScanRead } = useRegisterOnScan({ vehicles, addVehicle, updateVehicleFields, user });
  const { oth, setMovementTab, refresh: refreshActiveSessions } = useActiveSessions();
  const collision = useStartCollisionGuard(oth); // speed-bump: trip-start while an OTH timer runs

  const [tripState, setTripState]           = useState<TripState>('form');
  const [reason, setReason]                 = useState<Reason | null>(null);
  const [queue, setQueue]                   = useState<QueueSnapshot | null>(null);
  const [queueArrival, setQueueArrival]     = useState<QueueSnapshot | null>(null);
  const [authorization, setAuthorization]   = useState<Authorization | null>(null);
  const [notes, setNotes]                   = useState('');
  const [isShuttle, setIsShuttle]           = useState(false);
  const [departureTime, setDepartureTime]   = useState('');
  const [arrivalTime, setArrivalTime]       = useState('');
  const [elapsed, setElapsed]               = useState('');
  const [completedOneWay, setCompletedOneWay] = useState(false);

  const [vehiclePlate, setVehiclePlate]       = useState(initialPlate ?? '');
  const [isTeslaRun, setIsTeslaRun]           = useState(false);
  const [evCableStatus, setEvCableStatus]     = useState<EvAssetStatus | null>(null);
  const [evAdapterStatus, setEvAdapterStatus] = useState<EvAssetStatus | null>(null);
  const [pendingTripId, setPendingTripId]     = useState<string | null>(null);
  const [starting, setStarting]               = useState(false);
  const [startError, setStartError]           = useState(false);

  const flaggedClasses = useMemo(() => {
    const manifest  = generateDayManifest();
    const flags     = loadFlags();
    const overrides = loadOverrides();
    const manifestFlagged = [...new Set(manifest.filter(r => flags.has(r.id)).map(r => r.rentalClass))];
    return [...new Set([...overrides, ...manifestFlagged])];
  }, []);

  // Dispatch guard — flags a Tesla with known-missing EV kit before the run (see hook).
  const evWarning = useEvDispatchWarning(vehiclePlate);

  useEffect(() => {
    if (tripState !== 'in_transit' || !departureTime) return;
    const id = setInterval(() => setElapsed(elapsedSince(departureTime)), 1000);
    return () => clearInterval(id);
  }, [tripState, departureTime]);

  useInProgressRecovery(
    {
      table: 'vsa_trips',
      userField: 'driver_id',
      userId: user?.id,
      columns: 'id, vehicle_plate, depart_location, depart_time, trip_type, is_shuttle, auth_type, reason, queue_at_departure, ev_cable_status, ev_adapter_status',
      orderBy: 'depart_time',
    },
    row => {
      setDepartureTime(row.depart_time as string);
      setVehiclePlate((row.vehicle_plate as string) ?? '');
      setIsShuttle((row.is_shuttle as boolean) ?? false);
      setAuthorization((row.auth_type as Authorization) ?? null);
      setReason((row.reason as Reason) ?? null);
      setQueue(parseRecoveredQueue(row.queue_at_departure));
      setPendingTripId(row.id as string);
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
    },
  );

  const handleShuttleToggle = (checked: boolean) => {
    if (checked === isShuttle) return;
    hapticLight();
    setIsShuttle(checked);
    if (checked && shuttlePlate) setVehiclePlate(shuttlePlate.toUpperCase());
    else if (!checked && shuttlePlate && vehiclePlate === shuttlePlate.toUpperCase()) setVehiclePlate('');
  };

  // `plate` lets a caller (the key-tag scan) run detection on a freshly-set value before
  // React state catches up; a plain blur passes nothing and uses the current field.
  const handlePlateBlur = async (plate?: string) => {
    const result = await detectTeslaByPlate(plate ?? vehiclePlate);
    if (result.isTesla) {
      setIsTeslaRun(true);
      setEvCableStatus(result.lastCable);
      setEvAdapterStatus(result.lastAdapter);
    }
  };

  // ─── WRITE-FIRST RULE ────────────────────────────────────────────────────────
  // Always await the Supabase insert before setting tripState.
  // Never delegate the write to a parent callback.
  // Violating this causes silent persistence failure on module switch —
  // the component unmounts before the write lands, recovery finds nothing.
  //
  // Reference implementation: handleStartWith() in OffStandardTimeLog.tsx
  // ─────────────────────────────────────────────────────────────────────────────
  const handleStartTripWith = async (r: Reason, auth: Authorization | null, tripNotes: string) => {
    if (!user || starting) return;
    setStarting(true);
    hapticMedium();
    const now = new Date().toISOString();
    const tripId = `trip-${Date.now()}`;

    const { ok } = await writeOrEnqueue('insert', buildTripStartInsert({
      tripId, vehiclePlate, isShuttle, driverId: user.id, branchId: user.branchId,
      auth, reason: r, queue, notes: tripNotes, isTeslaRun, evCableStatus, evAdapterStatus,
    }, now));

    if (!ok) {
      console.error('[TripStartForm] trip start write failed');
      setStartError(true);
      setStarting(false);
      return;
    }
    setStartError(false);
    setStarting(false);

    setPendingTripId(tripId);

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

  const handleCodeRedDispatch = () => {
    if (!queue) setQueue('0');
    void handleStartTripWith('CODE_RED', 'MANAGEMENT', 'Code Red dispatch');
  };

  const handleQuickStart = (r: Reason) => {
    // Seed the authorization from the trip type (routine = personal, coverage =
    // management); the VSA can still change it on the in-transit screen. Guarded:
    // if an off-standard timer is already running, confirm before double-running.
    collision.guard(() => void handleStartTripWith(r, DEFAULT_AUTH[r] ?? null, ''));
  };

  // oneWay=true → "⬛ End Trip" (one-way, queue nulled); false → "✓ Back at Washbay".
  const handleArrived = async (oneWay: boolean) => {
    if (tripState !== 'in_transit') return;
    await withSubmitLock(`trip-arrive:${pendingTripId ?? 'vsa'}`, async () => {
    hapticMedium();
    const arrived = new Date().toISOString();
    setCompletedOneWay(oneWay);

    if (user && pendingTripId) {
      const { ok } = await writeOrEnqueue('update', buildArrivalUpdate(
        { oneWay, authorization, queue, queueArrival, notes, isTeslaRun, evCableStatus, evAdapterStatus },
        arrived,
      ), 'id', pendingTripId);
      if (!ok) console.error('[TripStartForm] trip arrive update failed');
    }

    setArrivalTime(arrived);
    setTripState('complete');

    if (onTripComplete && user) {
      onTripComplete({
        id:                pendingTripId ?? `vsa-session-${Date.now()}`,
        vehicleUnit:       '',
        vehiclePlate:      vehiclePlate.trim(),
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
        oneWay,
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
    });
  };

  const handleReset = () => {
    // Abandoning a started-but-not-arrived trip: delete its in_progress row so
    // it doesn't orphan in the DB (orphaned in_progress rows break recovery).
    // A completed trip is left alone — Reset there just clears the form.
    if (tripState === 'in_transit' && pendingTripId) {
      // Drop the pill once the delete COMMITS — firing refresh synchronously races
      // the not-yet-committed delete and re-reads the still-present in_progress row.
      void writeOrEnqueue('delete', {}, 'id', pendingTripId).then(refreshActiveSessions);
    }
    setTripState('form');
    setPendingTripId(null);
    setReason(null);
    setQueue(null);
    setQueueArrival(null);
    setAuthorization(null);
    setNotes('');
    setIsShuttle(false);
    setDepartureTime('');
    setArrivalTime('');
    setElapsed('');
    setCompletedOneWay(false);
    setVehiclePlate('');
    setIsTeslaRun(false);
    setEvCableStatus(null);
    setEvAdapterStatus(null);
    setStarting(false);
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
          <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer">Reset</button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {tripState === 'form' && collision.guardActive && oth && (
          <SessionCollisionGuard other={oth} onProceed={collision.proceed}
            onGoEnd={() => { collision.dismiss(); setMovementTab('off-standard'); }} />
        )}

        {tripState === 'form' && (
          <>
            <TripForm
              isShuttle={isShuttle}   shuttlePlate={shuttlePlate} setShuttlePlate={setShuttlePlate}
              vehiclePlate={vehiclePlate} setVehiclePlate={setVehiclePlate} onPlateBlur={handlePlateBlur} onScanRead={handleScanRead}
              flaggedClasses={flaggedClasses}
              onShuttleToggle={handleShuttleToggle}
              onCodeRedDispatch={handleCodeRedDispatch}
              onQuickStart={handleQuickStart}
              isTeslaRun={isTeslaRun}         setIsTeslaRun={setIsTeslaRun}
              evCableStatus={evCableStatus}   setEvCableStatus={setEvCableStatus}
              evAdapterStatus={evAdapterStatus} setEvAdapterStatus={setEvAdapterStatus}
              evWarning={evWarning}
            />
            {startError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-red-700 dark:text-red-400">Couldn't save — check connection and try again.</p>
              </div>
            )}
          </>
        )}

        {tripState === 'in_transit' && (
          <TripInTransit
            authorization={authorization} setAuthorization={setAuthorization}
            queue={queue}                 setQueue={setQueue}
            queueArrival={queueArrival}   setQueueArrival={setQueueArrival}
            departureTime={departureTime} elapsed={elapsed}
            notes={notes}                 setNotes={setNotes}
            onArrived={handleArrived}
            onDelete={handleReset}
          />
        )}

        {tripState === 'complete' && (
          <TripComplete
            isShuttle={isShuttle}
            authorization={authorization} reason={reason}
            departureTime={departureTime} arrivalTime={arrivalTime}
            queue={queue}                 queueArrival={queueArrival}
            oneWay={completedOneWay}
            notes={notes}           setNotes={setNotes}
            onReset={handleReset}
          />
        )}
      </div>
      {registerToast && <Toast message={registerToast} />}
    </div>
  );
}
