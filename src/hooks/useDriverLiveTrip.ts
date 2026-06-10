import { useReducer, useEffect } from 'react';
import { hapticLight, hapticMedium } from '../lib/haptics';
import { supabase, writeWithRefresh } from '../lib/supabase';
import { enqueueOfflineAction } from '../lib/offlineQueue';
import { elapsedSince, TRIP_DURATION_THRESHOLDS } from '../lib/vsa-trip';
import { writeOrEnqueue } from '../lib/vsaTripWrite';
import { pushNotification } from '../lib/garage-uploads';
import { detectTeslaByPlate, searchVehicles } from '../lib/ev-detection';
import type { VehicleSearchResult } from '../lib/ev-detection';
import { useInProgressRecovery } from '../hooks/useInProgressRecovery';
import { useVehicleHoldContext } from '../context/VehicleHoldContext';
import {
  driverTripReducer, INITIAL_DRIVER_TRIP_STATE, LOCATIONS,
  type FormDraft,
} from './driverTripReducer';
import type { TripRun } from '../data/trips';
import type { User } from '../types';

export { LOCATIONS } from './driverTripReducer';
export type { Location, RouteStep, VehicleDetails } from './driverTripReducer';

interface UseDriverLiveTripProps {
  user: User | null;
  onTripComplete: (trip: TripRun) => void;
}

export function useDriverLiveTrip({ user, onTripComplete }: UseDriverLiveTripProps) {
  const [state, dispatch] = useReducer(driverTripReducer, INITIAL_DRIVER_TRIP_STATE);
  const { updateVehicleEVAssets } = useVehicleHoldContext();

  // ── Recovery: restore any in_progress trip for this driver on mount ────────

  useInProgressRecovery(
    {
      table: 'vsa_trips',
      userField: 'driver_id',
      userId: user?.id,
      columns: 'id, vehicle_plate, depart_location, arrive_location, depart_time, is_shuttle, notes, trip_type',
      orderBy: 'depart_time',
    },
    row => {
      const plate  = (row.vehicle_plate as string) ?? '';
      const depLoc = (row.depart_location as string) ?? '';
      const arrLoc = (row.arrive_location as string) ?? '';
      const knownDep = LOCATIONS.includes(depLoc as import('./driverTripReducer').Location);
      const knownArr = LOCATIONS.includes(arrLoc as import('./driverTripReducer').Location);
      dispatch({
        type: 'recoverInTransit',
        tripId:        row.id as string,
        plate,
        fromLabel:     knownDep ? depLoc : (depLoc || 'Other'),
        toLabel:       knownArr ? arrLoc : (arrLoc || 'Other'),
        departureTime: row.depart_time as string,
        isShuttle:     (row.is_shuttle as boolean) ?? false,
        notes:         (row.notes as string | null) ?? '',
      });
      // Async vehicle lookup — updates vehicleDetails in the transit state
      detectTeslaByPlate(plate).then(res => {
        dispatch({ type: 'patchVehicleDetails', vehicleDetails: res.vehicle ?? null, evVehicleId: res.vehicle?.id ?? null });
      });
    },
  );

  // ── Elapsed timer ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (state.phase !== 'in_transit') return;
    const id = setInterval(
      () => dispatch({ type: 'setElapsed', elapsed: elapsedSince(state.trip.departureTime) }),
      1000,
    );
    return () => clearInterval(id);
  }, [state.phase, state.phase === 'in_transit' ? state.trip.departureTime : null]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Plate autocomplete (form only) ────────────────────────────────────────

  const plate = state.phase === 'form' ? state.draft.plate : '';
  const plateSuggestions = state.phase === 'form' ? state.draft.plateSuggestions : [];
  const showSuggestions  = state.phase === 'form' ? state.draft.showSuggestions  : false;

  useEffect(() => {
    if (state.phase !== 'form') return;
    const timer = setTimeout(async () => {
      if (plate.trim().length < 2) {
        dispatch({ type: 'setFormField', key: 'plateSuggestions', value: [] });
        dispatch({ type: 'setFormField', key: 'showSuggestions',  value: false });
        return;
      }
      if (plateSuggestions.some(p => p.license_plate === plate.trim().toUpperCase()) && !showSuggestions) return;
      const results = await searchVehicles(plate);
      dispatch({ type: 'setFormField', key: 'plateSuggestions', value: results });
      dispatch({ type: 'setFormField', key: 'showSuggestions',  value: results.length > 0 });
    }, 300);
    return () => clearTimeout(timer);
  }, [plate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ────────────────────────────────────────────────────────────────

  const setFormField = <K extends keyof FormDraft>(key: K) =>
    (value: FormDraft[K] | ((prev: FormDraft[K]) => FormDraft[K])) =>
      dispatch({ type: 'setFormField', key, value });

  const buildTransitPayload = (overrides: Record<string, unknown> = {}): Record<string, unknown> => {
    const trip = state.phase !== 'form' ? state.trip : null;
    if (!trip) return overrides;
    return {
      vehicle_plate:     trip.plate,
      vehicle_unit:      '',
      trip_type:         trip.isShuttle ? 'transfer' : 'clean',
      depart_location:   trip.fromLabel,
      arrive_location:   trip.toLabel,
      driver_id:         user?.id ?? '',
      branch_id:         user?.branchId ?? 'YWG',
      is_shuttle:        trip.isShuttle,
      notes:             trip.notes.trim() || null,
      ev_cable_status:   trip.isTeslaRun ? (trip.evCableStatus  ?? null) : null,
      ev_adapter_status: trip.isTeslaRun ? (trip.evAdapterStatus ?? null) : null,
      ...overrides,
    };
  };

  const dispatchStartTrip = (tripId: string, departureTime: string) =>
    dispatch({ type: 'startTrip', tripId, departureTime });

  // ── Event handlers ─────────────────────────────────────────────────────────

  const handlePlateBlur = async () => {
    if (state.phase !== 'form') return;
    const result = await detectTeslaByPlate(state.draft.plate);
    dispatch({ type: 'patchVehicleDetails', vehicleDetails: result.vehicle ?? null, evVehicleId: result.vehicle?.id ?? null });
    if (result.isTesla) {
      dispatch({ type: 'setFormField', key: 'isTeslaRun',      value: true });
      dispatch({ type: 'setFormField', key: 'evCableStatus',   value: result.lastCable });
      dispatch({ type: 'setFormField', key: 'evAdapterStatus', value: result.lastAdapter });
    }
  };

  const handleSuggestionSelect = (v: VehicleSearchResult) => {
    hapticLight();
    dispatch({ type: 'setFormField', key: 'plate',          value: v.license_plate });
    dispatch({ type: 'setFormField', key: 'showSuggestions', value: false });
    dispatch({ type: 'setFormField', key: 'vehicleDetails', value: { make: v.make, model: v.model, year: v.year, color: v.color } });
    detectTeslaByPlate(v.license_plate).then(res => {
      dispatch({ type: 'patchVehicleDetails', vehicleDetails: res.vehicle ?? null, evVehicleId: res.vehicle?.id ?? null });
      dispatch({ type: 'setFormField', key: 'isTeslaRun',      value: res.isTesla });
      dispatch({ type: 'setFormField', key: 'evCableStatus',   value: res.isTesla ? res.lastCable   : null });
      dispatch({ type: 'setFormField', key: 'evAdapterStatus', value: res.isTesla ? res.lastAdapter : null });
    });
  };

  const handleLocationTap = (loc: import('./driverTripReducer').Location) => {
    if (state.phase !== 'form') return;
    const { routeStep, from } = state.draft;
    if (routeStep === 'destination' && loc !== from) hapticMedium();
    else hapticLight();
    dispatch({ type: 'locationTap', loc });
  };

  const handleRouteReset = () => {
    hapticLight();
    dispatch({ type: 'routeReset' });
  };

  const handleStart = async () => {
    hapticMedium();
    if (!user || state.phase !== 'form') return;
    const { draft } = state;
    const now    = new Date().toISOString();
    const tripId = crypto.randomUUID();
    const fromLabel = draft.from === 'Other' ? (draft.customFrom || 'Other') : (draft.from ?? '');
    const toLabel   = draft.to   === 'Other' ? (draft.customTo   || 'Other') : (draft.to   ?? '');

    const payload = {
      id:            tripId,
      vehicle_plate: draft.plate.trim().toUpperCase(),
      vehicle_unit:  '',
      trip_type:     draft.isShuttle ? 'transfer' : 'clean',
      depart_location:   fromLabel,
      arrive_location:   toLabel,
      driver_id:         user.id,
      branch_id:         user.branchId ?? 'YWG',
      is_shuttle:        draft.isShuttle,
      notes:             draft.notes.trim() || null,
      ev_cable_status:   draft.isTeslaRun ? (draft.evCableStatus  ?? null) : null,
      ev_adapter_status: draft.isTeslaRun ? (draft.evAdapterStatus ?? null) : null,
      depart_time:   now,
      arrive_time:   null,
      status:        'in_progress',
    };

    const { ok } = await writeOrEnqueue('insert', payload);
    if (!ok) {
      console.error('[DriverLiveForm] start write failed');
      dispatch({ type: 'setSaveError', value: true });
      return;
    }

    dispatch({ type: 'setSaveError', value: false });
    dispatchStartTrip(tripId, now);

    if (draft.isTeslaRun && draft.evVehicleId && draft.evCableStatus != null && draft.evAdapterStatus != null) {
      void updateVehicleEVAssets(draft.evVehicleId, draft.evCableStatus === 'present', draft.evAdapterStatus === 'present', 'driver_trip');
    }
  };

  const handleArrived = async () => {
    hapticMedium();
    if (!user || state.phase !== 'in_transit') { dispatch({ type: 'setSaveError', value: true }); return; }
    dispatch({ type: 'setSaveError', value: false });
    dispatch({ type: 'setSubmitting', value: true });
    const arrived = new Date().toISOString();
    const { trip } = state;

    const arrivalOverrides = { arrive_time: arrived, status: 'complete' };
    let ok: boolean;
    // The one-shot "depart + arrive logged together" path inserts a fresh row, so it
    // needs a client id — without one the offline-queue dedup (upsert on `id`) can't
    // turn a lost-ack retry into a no-op, and the PK-less-insert guard would refuse it.
    let completedId: string | undefined;

    if (trip.inProgressId) {
      ({ ok } = await writeOrEnqueue('update', buildTransitPayload(arrivalOverrides), 'id', trip.inProgressId));
    } else {
      completedId = crypto.randomUUID();
      ({ ok } = await writeOrEnqueue('insert', buildTransitPayload({ id: completedId, depart_time: trip.departureTime, ...arrivalOverrides })));
    }

    if (!ok) {
      dispatch({ type: 'setSubmitting', value: false });
      dispatch({ type: 'setSaveError',  value: true });
      return;
    }

    const tripRun: TripRun = {
      id:             trip.inProgressId ?? completedId ?? `live-${Date.now()}`,
      vehiclePlate:   trip.plate,
      vehicleUnit:    '',
      tripType:       trip.isShuttle ? 'transfer' : 'clean',
      departLocation: trip.fromLabel,
      arriveLocation: trip.toLabel,
      departTime:     trip.departureTime,
      arriveTime:     arrived,
      gasLevel:       '',
      odometer:       0,
      driverId:       user.id,
      branchId:       user.branchId,
      notes:          trip.notes.trim() || undefined,
    };

    onTripComplete(tripRun);

    const elapsedMinutes = Math.round(
      (new Date(arrived).getTime() - new Date(trip.departureTime).getTime()) / 60000,
    );
    if (elapsedMinutes > TRIP_DURATION_THRESHOLDS.alert) {
      await pushNotification(
        user.branchId,
        ['Branch Manager', 'Operations Manager', 'City Manager', 'Lead VSA'],
        '🐢',
        `Long trip flagged — ${user.name} · ${trip.plate} · ${trip.fromLabel} → ${trip.toLabel} · ${elapsedMinutes} minutes`,
        'warning',
        { driverId: user.id, plate: trip.plate, from: trip.fromLabel, to: trip.toLabel, elapsedMinutes, tripDate: arrived.split('T')[0] },
      );
    }

    dispatch({ type: 'setSubmitting', value: false });
    dispatch({ type: 'arriveTrip',    arrivalTime: arrived });
  };

  const handleReset = () => {
    if (state.phase === 'in_transit' && state.trip.inProgressId) {
      void writeOrEnqueue('delete', {}, 'id', state.trip.inProgressId);
    }
    dispatch({ type: 'reset' });
  };

  const handleCancelTrip = async () => {
    if (state.phase === 'in_transit' && state.trip.inProgressId) {
      const id = state.trip.inProgressId;
      if (!navigator.onLine) {
        enqueueOfflineAction({ table: 'vsa_trips', action: 'delete', payload: {}, eqField: 'id', eqValue: id });
      } else {
        const res = await writeWithRefresh(() => supabase.from('vsa_trips').delete().eq('id', id));
        if (res.error) {
          const isNetworkErr = !navigator.onLine || res.error.message?.includes('Fetch') || !res.error.code;
          if (isNetworkErr) enqueueOfflineAction({ table: 'vsa_trips', action: 'delete', payload: {}, eqField: 'id', eqValue: id });
        }
      }
    }
    handleReset();
  };

  // ── Phase-conditional return (discriminated union) ─────────────────────────

  if (state.phase === 'form') {
    const { draft, submitting, saveError } = state;
    const fromLabel = draft.from === 'Other' ? (draft.customFrom || 'Other') : (draft.from ?? '');
    const toLabel   = draft.to   === 'Other' ? (draft.customTo   || 'Other') : (draft.to   ?? '');
    const canStart  = draft.plate.trim().length > 0
      && draft.routeStep === 'confirmed'
      && (draft.from !== 'Other' || draft.customFrom.trim().length > 0)
      && (draft.to   !== 'Other' || draft.customTo.trim().length   > 0);
    return {
      phase: 'form' as const,
      ...draft,
      fromLabel, toLabel, canStart, submitting, saveError,
      setFormField,
      handleStart, handleLocationTap, handleRouteReset,
      handlePlateBlur, handleSuggestionSelect, handleReset,
    };
  }

  if (state.phase === 'in_transit') {
    const { trip, elapsed, submitting, saveError } = state;
    const setNotes = (notes: string) => dispatch({ type: 'setTransitNotes', notes });
    return {
      phase: 'in_transit' as const,
      ...trip,
      elapsed, submitting, saveError,
      setNotes,
      handleArrived, handleCancelTrip, handleReset,
    };
  }

  // complete
  return {
    phase: 'complete' as const,
    ...state.trip,
    handleReset,
  };
}
