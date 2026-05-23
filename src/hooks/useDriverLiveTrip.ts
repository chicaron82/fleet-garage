import { useState, useEffect } from 'react';
import { hapticLight, hapticMedium } from '../lib/haptics';
import { supabase, writeWithRefresh } from '../lib/supabase';
import { enqueueOfflineAction } from '../lib/offlineQueue';
import { elapsedSince, TRIP_DURATION_THRESHOLDS } from '../lib/vsa-trip';
import { pushNotification } from '../lib/garage-uploads';
import { detectTeslaByPlate, searchVehicles } from '../lib/ev-detection';
import type { VehicleSearchResult } from '../lib/ev-detection';
import { useInProgressRecovery } from '../hooks/useInProgressRecovery';
import type { TripRun } from '../data/trips';
import type { EvAssetStatus, User } from '../types';

export const LOCATIONS = ['Airport', 'Washbay', 'Other'] as const;
export type Location = typeof LOCATIONS[number];
export type RouteStep = 'origin' | 'destination' | 'confirmed';

interface UseDriverLiveTripProps {
  user: User | null;
  onTripComplete: (trip: TripRun) => void;
}

export function useDriverLiveTrip({ user, onTripComplete }: UseDriverLiveTripProps) {
  const [liveState, setLiveState]         = useState<'form' | 'in_transit' | 'complete'>('form');
  const [routeStep, setRouteStep]         = useState<RouteStep>('origin');
  const [from, setFrom]                   = useState<Location | null>(null);
  const [to, setTo]                       = useState<Location | null>(null);
  const [customFrom, setCustomFrom]       = useState('');
  const [customTo, setCustomTo]           = useState('');
  const [plate, setPlate]                 = useState('');
  const [isShuttle, setIsShuttle]         = useState(false);
  const [notes, setNotes]                 = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [arrivalTime, setArrivalTime]     = useState('');
  const [elapsed, setElapsed]             = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [saveError, setSaveError]         = useState(false);
  const [isTeslaRun, setIsTeslaRun]       = useState(false);
  const [evCableStatus, setEvCableStatus] = useState<EvAssetStatus | null>(null);
  const [evAdapterStatus, setEvAdapterStatus] = useState<EvAssetStatus | null>(null);
  const [vehicleDetails, setVehicleDetails] = useState<{ make: string, model: string, year: number, color: string } | null>(null);
  const [inProgressId, setInProgressId]   = useState<string | null>(null);

  const [plateSuggestions, setPlateSuggestions] = useState<VehicleSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Recovery: restore any in_progress trip for this driver on mount
  useInProgressRecovery(
    {
      table: 'vsa_trips',
      userField: 'driver_id',
      userId: user?.id,
      columns: 'id, vehicle_plate, depart_location, arrive_location, depart_time, is_shuttle, notes, trip_type',
    },
    row => {
      const depLoc = (row.depart_location as string) ?? '';
      const arrLoc = (row.arrive_location as string) ?? '';
      setInProgressId(row.id as string);
      const loadedPlate = (row.vehicle_plate as string) ?? '';
      setPlate(loadedPlate);
      detectTeslaByPlate(loadedPlate).then(res => {
        setVehicleDetails(res.vehicle ?? null);
      });
      if (LOCATIONS.includes(depLoc as Location)) setFrom(depLoc as Location);
      else { setFrom('Other'); setCustomFrom(depLoc); }
      if (LOCATIONS.includes(arrLoc as Location)) setTo(arrLoc as Location);
      else { setTo('Other'); setCustomTo(arrLoc); }
      setRouteStep('confirmed');
      setIsShuttle((row.is_shuttle as boolean) ?? false);
      setNotes((row.notes as string | null) ?? '');
      setDepartureTime(row.depart_time as string);
      setLiveState('in_transit');
    },
  );

  useEffect(() => {
    if (liveState !== 'in_transit' || !departureTime) return;
    const id = setInterval(() => setElapsed(elapsedSince(departureTime)), 1000);
    return () => clearInterval(id);
  }, [liveState, departureTime]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (plate.trim().length < 2) {
        setPlateSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      // Don't search if we already selected a full match
      if (plateSuggestions.some(p => p.license_plate === plate.trim().toUpperCase()) && !showSuggestions) return;
      const results = await searchVehicles(plate);
      setPlateSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, 300);
    return () => clearTimeout(timer);
  }, [plate]); // eslint-disable-line react-hooks/exhaustive-deps

  const fromLabel = from === 'Other' ? (customFrom || 'Other') : (from ?? '');
  const toLabel   = to   === 'Other' ? (customTo   || 'Other') : (to   ?? '');

  const canStart = plate.trim().length > 0
    && routeStep === 'confirmed'
    && (from !== 'Other' || customFrom.trim().length > 0)
    && (to   !== 'Other' || customTo.trim().length > 0);

  const handlePlateBlur = async () => {
    const result = await detectTeslaByPlate(plate);
    setVehicleDetails(result.vehicle ?? null);
    if (result.isTesla) {
      setIsTeslaRun(true);
      setEvCableStatus(result.lastCable);
      setEvAdapterStatus(result.lastAdapter);
    }
  };

  const handleSuggestionSelect = (v: VehicleSearchResult) => {
    hapticLight();
    setPlate(v.license_plate);
    setShowSuggestions(false);
    setVehicleDetails({ make: v.make, model: v.model, year: v.year, color: v.color });
    detectTeslaByPlate(v.license_plate).then(res => {
      if (res.isTesla) {
        setIsTeslaRun(true);
        setEvCableStatus(res.lastCable);
        setEvAdapterStatus(res.lastAdapter);
      } else {
        setIsTeslaRun(false);
        setEvCableStatus(null);
        setEvAdapterStatus(null);
      }
    });
  };

  const handleLocationTap = (loc: Location) => {
    if (routeStep === 'origin') {
      hapticLight();
      setFrom(loc);
      setRouteStep('destination');
    } else if (routeStep === 'destination') {
      if (loc === from) {
        hapticLight();
        setFrom(null);
        setRouteStep('origin');
      } else {
        hapticMedium();
        setTo(loc);
        setRouteStep('confirmed');
      }
    }
  };

  const handleRouteReset = () => {
    hapticLight();
    setFrom(null);
    setTo(null);
    setCustomFrom('');
    setCustomTo('');
    setRouteStep('origin');
  };

  const handleStart = async () => {
    hapticMedium();
    if (!user) return;
    const now    = new Date().toISOString();
    const tripId = crypto.randomUUID();
    let error = null;

    if (!navigator.onLine) {
      enqueueOfflineAction({
        table: 'vsa_trips',
        action: 'insert',
        payload: {
          id:                tripId,
          vehicle_plate:     plate.trim().toUpperCase(),
          vehicle_unit:      '',
          trip_type:         isShuttle ? 'transfer' : 'clean',
          depart_location:   fromLabel,
          arrive_location:   toLabel,
          depart_time:       now,
          arrive_time:       null,
          driver_id:         user.id,
          branch_id:         user.branchId,
          is_shuttle:        isShuttle,
          notes:             notes.trim() || null,
          ev_cable_status:   isTeslaRun ? (evCableStatus ?? null) : null,
          ev_adapter_status: isTeslaRun ? (evAdapterStatus ?? null) : null,
          status:            'in_progress',
        }
      });
    } else {
      const res = await writeWithRefresh(() =>
        supabase.from('vsa_trips').insert({
          id:                tripId,
          vehicle_plate:     plate.trim().toUpperCase(),
          vehicle_unit:      '',
          trip_type:         isShuttle ? 'transfer' : 'clean',
          depart_location:   fromLabel,
          arrive_location:   toLabel,
          depart_time:       now,
          arrive_time:       null,
          driver_id:         user.id,
          branch_id:         user.branchId,
          is_shuttle:        isShuttle,
          notes:             notes.trim() || null,
          ev_cable_status:   isTeslaRun ? (evCableStatus ?? null) : null,
          ev_adapter_status: isTeslaRun ? (evAdapterStatus ?? null) : null,
          status:            'in_progress',
        })
      );
      if (res.error) {
        const isNetworkErr = !navigator.onLine || res.error.message?.includes('Fetch') || !res.error.code;
        if (isNetworkErr) {
          enqueueOfflineAction({
            table: 'vsa_trips',
            action: 'insert',
            payload: {
              id:                tripId,
              vehicle_plate:     plate.trim().toUpperCase(),
              vehicle_unit:      '',
              trip_type:         isShuttle ? 'transfer' : 'clean',
              depart_location:   fromLabel,
              arrive_location:   toLabel,
              depart_time:       now,
              arrive_time:       null,
              driver_id:         user.id,
              branch_id:         user.branchId,
              is_shuttle:        isShuttle,
              notes:             notes.trim() || null,
              ev_cable_status:   isTeslaRun ? (evCableStatus ?? null) : null,
              ev_adapter_status: isTeslaRun ? (evAdapterStatus ?? null) : null,
              status:            'in_progress',
            }
          });
        } else {
          error = res.error;
        }
      }
    }

    if (error) {
      console.error('[DriverLiveForm] start write failed:', JSON.stringify(error));
      setSaveError(true);
      return;
    }

    setSaveError(false);
    setInProgressId(tripId);
    setDepartureTime(now);
    setElapsed('0m 00s');
    setLiveState('in_transit');
  };

  const handleArrived = async () => {
    hapticMedium();
    if (!user) { setSaveError(true); return; }
    setSaveError(false);
    setSubmitting(true);
    const arrived = new Date().toISOString();
    setArrivalTime(arrived);

    let error: { message: string } | null = null;

    if (inProgressId) {
      // Happy path: complete the in_progress record
      if (!navigator.onLine) {
        enqueueOfflineAction({
          table: 'vsa_trips',
          action: 'update',
          payload: {
            arrive_time:       arrived,
            notes:             notes.trim() || null,
            ev_cable_status:   isTeslaRun ? (evCableStatus ?? null) : null,
            ev_adapter_status: isTeslaRun ? (evAdapterStatus ?? null) : null,
            status:            'complete',
          },
          eqField: 'id',
          eqValue: inProgressId
        });
      } else {
        const res = await writeWithRefresh(() => supabase.from('vsa_trips').update({
          arrive_time:       arrived,
          notes:             notes.trim() || null,
          ev_cable_status:   isTeslaRun ? (evCableStatus ?? null) : null,
          ev_adapter_status: isTeslaRun ? (evAdapterStatus ?? null) : null,
          status:            'complete',
        }).eq('id', inProgressId));
        if (res.error) {
          const isNetworkErr = !navigator.onLine || res.error.message?.includes('Fetch') || !res.error.code;
          if (isNetworkErr) {
            enqueueOfflineAction({
              table: 'vsa_trips',
              action: 'update',
              payload: {
                arrive_time:       arrived,
                notes:             notes.trim() || null,
                ev_cable_status:   isTeslaRun ? (evCableStatus ?? null) : null,
                ev_adapter_status: isTeslaRun ? (evAdapterStatus ?? null) : null,
                status:            'complete',
              },
              eqField: 'id',
              eqValue: inProgressId
            });
          } else {
            error = res.error;
          }
        }
      }
    } else {
      // Fallback: start write failed, insert now
      if (!navigator.onLine) {
        enqueueOfflineAction({
          table: 'vsa_trips',
          action: 'insert',
          payload: {
            vehicle_plate:     plate.trim().toUpperCase(),
            vehicle_unit:      '',
            trip_type:         isShuttle ? 'transfer' : 'clean',
            depart_location:   fromLabel,
            arrive_location:   toLabel,
            depart_time:       departureTime,
            arrive_time:       arrived,
            driver_id:         user.id,
            branch_id:         user.branchId,
            is_shuttle:        isShuttle,
            notes:             notes.trim() || null,
            ev_cable_status:   isTeslaRun ? (evCableStatus ?? null) : null,
            ev_adapter_status: isTeslaRun ? (evAdapterStatus ?? null) : null,
            status:            'complete',
          }
        });
      } else {
        const res = await writeWithRefresh(() => supabase.from('vsa_trips').insert({
          vehicle_plate:     plate.trim().toUpperCase(),
          vehicle_unit:      '',
          trip_type:         isShuttle ? 'transfer' : 'clean',
          depart_location:   fromLabel,
          arrive_location:   toLabel,
          depart_time:       departureTime,
          arrive_time:       arrived,
          driver_id:         user.id,
          branch_id:         user.branchId,
          is_shuttle:        isShuttle,
          notes:             notes.trim() || null,
          ev_cable_status:   isTeslaRun ? (evCableStatus ?? null) : null,
          ev_adapter_status: isTeslaRun ? (evAdapterStatus ?? null) : null,
          status:            'complete',
        }));
        if (res.error) {
          const isNetworkErr = !navigator.onLine || res.error.message?.includes('Fetch') || !res.error.code;
          if (isNetworkErr) {
            enqueueOfflineAction({
              table: 'vsa_trips',
              action: 'insert',
              payload: {
                vehicle_plate:     plate.trim().toUpperCase(),
                vehicle_unit:      '',
                trip_type:         isShuttle ? 'transfer' : 'clean',
                depart_location:   fromLabel,
                arrive_location:   toLabel,
                depart_time:       departureTime,
                arrive_time:       arrived,
                driver_id:         user.id,
                branch_id:         user.branchId,
                is_shuttle:        isShuttle,
                notes:             notes.trim() || null,
                ev_cable_status:   isTeslaRun ? (evCableStatus ?? null) : null,
                ev_adapter_status: isTeslaRun ? (evAdapterStatus ?? null) : null,
                status:            'complete',
              }
            });
          } else {
            error = res.error;
          }
        }
      }
    }

    if (error) {
      setSubmitting(false);
      setSaveError(true);
      return;
    }

    const trip: TripRun = {
      id:             inProgressId ?? `live-${Date.now()}`,
      vehiclePlate:   plate.trim().toUpperCase(),
      vehicleUnit:    '',
      tripType:       isShuttle ? 'transfer' : 'clean',
      departLocation: fromLabel,
      arriveLocation: toLabel,
      departTime:     departureTime,
      arriveTime:     arrived,
      gasLevel:       '',
      odometer:       0,
      driverId:       user.id,
      branchId:       user.branchId,
      notes:          notes.trim() || undefined,
    };

    onTripComplete(trip);

    const elapsedMinutes = Math.round(
      (new Date(arrived).getTime() - new Date(departureTime).getTime()) / 60000
    );
    if (elapsedMinutes > TRIP_DURATION_THRESHOLDS.alert) {
      await pushNotification(
        user.branchId,
        ['Branch Manager', 'Operations Manager', 'City Manager', 'Lead VSA'],
        '🐢',
        `Long trip flagged — ${user.name} · ${plate.trim().toUpperCase()} · ${fromLabel} → ${toLabel} · ${elapsedMinutes} minutes`,
        'warning',
        { driverId: user.id, plate: plate.trim().toUpperCase(), from: fromLabel, to: toLabel, elapsedMinutes, tripDate: arrived.split('T')[0] },
      );
    }

    setSubmitting(false);
    setLiveState('complete');
  };

  const handleReset = () => {
    setLiveState('form');
    setRouteStep('origin');
    setFrom(null);
    setTo(null);
    setCustomFrom('');
    setCustomTo('');
    setPlate('');
    setIsShuttle(false);
    setNotes('');
    setDepartureTime('');
    setArrivalTime('');
    setElapsed('');
    setSaveError(false);
    setIsTeslaRun(false);
    setEvCableStatus(null);
    setEvAdapterStatus(null);
    setVehicleDetails(null);
    setInProgressId(null);
  };

  const handleCancelTrip = async () => {
    if (inProgressId) {
      if (!navigator.onLine) {
        enqueueOfflineAction({
          table: 'vsa_trips',
          action: 'delete',
          payload: null,
          eqField: 'id',
          eqValue: inProgressId
        });
      } else {
        await writeWithRefresh(() => supabase.from('vsa_trips').delete().eq('id', inProgressId));
      }
    }
    handleReset();
  };

  return {
    liveState,
    routeStep,
    from,
    to,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    plate,
    setPlate,
    isShuttle,
    setIsShuttle,
    notes,
    setNotes,
    departureTime,
    arrivalTime,
    elapsed,
    submitting,
    saveError,
    isTeslaRun,
    setIsTeslaRun,
    evCableStatus,
    setEvCableStatus,
    evAdapterStatus,
    setEvAdapterStatus,
    vehicleDetails,
    plateSuggestions,
    showSuggestions,
    setShowSuggestions,
    fromLabel,
    toLabel,
    canStart,
    handlePlateBlur,
    handleSuggestionSelect,
    handleLocationTap,
    handleRouteReset,
    handleStart,
    handleArrived,
    handleReset,
    handleCancelTrip,
  };
}
