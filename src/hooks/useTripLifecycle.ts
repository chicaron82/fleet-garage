// The VSA airport-run lifecycle: form → in_transit → complete. All trip state,
// the in-progress recovery, the elapsed ticker, and the write handlers —
// extracted verbatim from TripStartForm at the 330-cap wall
// (docs/ticket-near-cap-file-extractions.md). State + side effects → a hook;
// the component keeps the render (and the collision-guard UI flow, which wraps
// `startTrip` at the call site).
import { useState, useEffect } from 'react';
import { useRoutedProp } from './useRoutedProp';
import { useAuth } from '../context/AuthContext';
import { useVehicleHoldContext } from '../context/VehicleHoldContext';
import { useActiveSessions } from '../context/ActiveSessionsContext';
import { writeOrEnqueue } from '../lib/vsaTripWrite';
import { withSubmitLock } from '../lib/submitLock';
import { hapticLight, hapticMedium } from '../lib/haptics';
import { useInProgressRecovery } from './useInProgressRecovery';
import { elapsedSince, TRIP_DURATION_THRESHOLDS, buildArrivalUpdate, buildTripStartInsert, parseRecoveredQueue } from '../lib/vsa-trip';
import type { Reason, Authorization, QueueSnapshot, TripState } from '../lib/vsa-trip';
import { pushNotification } from '../lib/garage-uploads';
import { detectTeslaByPlate } from '../lib/ev-detection';
import type { TripRun } from '../data/trips';
import type { EvAssetStatus } from '../types';

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

export function useTripLifecycle({
  initialPlate,
  onTripStarted,
  onTripComplete,
}: {
  initialPlate?: string;
  onTripStarted?: (info: TripStartInfo) => void;
  onTripComplete?: (trip: TripRun) => void;
}) {
  const { user } = useAuth();
  const { shuttlePlate } = useVehicleHoldContext();
  const { refresh: refreshActiveSessions } = useActiveSessions();

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

  // The header scan-router routes here with a freshly-scanned plate (Screen: movement-log +
  // prefillPlate). `useState(initialPlate)` above only reads it on MOUNT — so scanning a tag
  // while ALREADY on the Movement Log re-navigates to the same mounted component, the plate
  // never lands, and "Start trip" looks like it did nothing (found live on the lot, 2026-07-19:
  // Aaron scanned LJF691 from the header, got dropped on the Movement Log with an empty field,
  // and had to re-scan in-page to actually start). Syncing on change makes the route keep its
  // promise. Guarded on a truthy plate so it never blanks a plate the operator typed himself.
  //
  // Done as a render-time adjustment (React's documented "adjusting state when a prop changes"),
  // NOT a useEffect — the repo lints `react-hooks/set-state-in-effect`, and an effect would also
  // cost an extra render pass with a visible empty-field flash. Remounting via a `key` was the
  // other option and was rejected: it would blow away in-flight trip state mid-shift.
  useRoutedProp(initialPlate, setVehiclePlate);
  const [isTeslaRun, setIsTeslaRun]           = useState(false);
  const [evCableStatus, setEvCableStatus]     = useState<EvAssetStatus | null>(null);
  const [evAdapterStatus, setEvAdapterStatus] = useState<EvAssetStatus | null>(null);
  const [pendingTripId, setPendingTripId]     = useState<string | null>(null);
  const [starting, setStarting]               = useState(false);
  const [startError, setStartError]           = useState(false);

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
  const startTrip = async (r: Reason, auth: Authorization | null, tripNotes: string) => {
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
    void startTrip('CODE_RED', 'MANAGEMENT', 'Code Red dispatch');
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

  return {
    tripState,
    reason,
    queue, setQueue,
    queueArrival, setQueueArrival,
    authorization, setAuthorization,
    notes, setNotes,
    isShuttle,
    departureTime, arrivalTime, elapsed, completedOneWay,
    vehiclePlate, setVehiclePlate,
    isTeslaRun, setIsTeslaRun,
    evCableStatus, setEvCableStatus,
    evAdapterStatus, setEvAdapterStatus,
    startError,
    handleShuttleToggle,
    handlePlateBlur,
    startTrip,
    handleCodeRedDispatch,
    handleArrived,
    handleReset,
  };
}
