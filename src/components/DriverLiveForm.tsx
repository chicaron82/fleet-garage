import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import { hapticLight, hapticMedium } from '../lib/haptics';
import { supabase, writeWithRefresh } from '../lib/supabase';
import { enqueueOfflineAction } from '../lib/offlineQueue';
import { elapsedSince, fmtTime, TRIP_DURATION_THRESHOLDS } from '../lib/vsa-trip';
import { NotesField } from './VSATripComponents';
import { pushNotification } from '../lib/garage-uploads';
import { detectTeslaByPlate, searchVehicles } from '../lib/ev-detection';
import { useInProgressRecovery } from '../hooks/useInProgressRecovery';
import type { VehicleSearchResult } from '../lib/ev-detection';
import { EVAssetCheck } from './EVAssetCheck';
import type { TripRun } from '../data/trips';
import type { RentalClass } from '../data/manifest';
import type { EvAssetStatus } from '../types';
import { PriorityHint } from './PriorityHint';
import { DriverLiveTransitView } from './DriverLiveTransitView';
import { DriverLiveCompleteView } from './DriverLiveCompleteView';

const LOCATIONS = ['Airport', 'Washbay', 'Other'] as const;
type Location = typeof LOCATIONS[number];
type RouteStep = 'origin' | 'destination' | 'confirmed';

interface Props {
  flaggedClasses: RentalClass[];
  onTripComplete: (trip: TripRun) => void;
}

export function DriverLiveForm({ flaggedClasses, onTripComplete }: Props) {
  const { user } = useAuth();
  const { shuttlePlate } = useGarage();

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
          driver_id:         user!.id,
          branch_id:         user!.branchId,
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
          driver_id:         user!.id,
          branch_id:         user!.branchId,
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
              driver_id:         user!.id,
              branch_id:         user!.branchId,
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
    setSaveError(false);
    setSubmitting(true);
    const arrived = new Date().toISOString();
    setArrivalTime(arrived);

    if (!user) { setSaveError(true); setSubmitting(false); return; }

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

  // ── Form ──────────────────────────────────────────────────────────────────
  if (liveState === 'form') {
    return (
      <div className="space-y-4">
        <PriorityHint flaggedClasses={flaggedClasses} topClasses={[]} />

        {/* Route picker */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {routeStep === 'origin'      && 'Starting at?'}
            {routeStep === 'destination' && 'Going to?'}
            {routeStep === 'confirmed'   && (
              <>
                <button type="button" onClick={handleRouteReset} className="text-yellow-600 dark:text-yellow-400 hover:underline normal-case font-semibold cursor-pointer">
                  {fromLabel} → {toLabel}
                </button>
                <span className="ml-1.5 text-[10px] normal-case font-normal text-gray-400 dark:text-gray-500">tap to change</span>
              </>
            )}
          </p>

          {routeStep !== 'confirmed' && (
            <div className="flex gap-2">
              {LOCATIONS.map(loc => (
                <button
                  key={loc} type="button"
                  onClick={() => handleLocationTap(loc)}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition cursor-pointer ${
                    from === loc
                      ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-gray-900 dark:text-gray-100'
                      : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >{loc}</button>
              ))}
            </div>
          )}

          {routeStep === 'destination' && from === 'Other' && (
            <div className="relative">
              <input
                type="text" autoFocus placeholder="Specify origin…" value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="w-full px-3 py-2 pr-8 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
              />
              <button
                type="button"
                onClick={() => { hapticLight(); setFrom(null); setCustomFrom(''); setRouteStep('origin'); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-lg leading-none"
              >×</button>
            </div>
          )}
          {routeStep === 'confirmed' && to === 'Other' && (
            <div className="relative">
              <input
                type="text" autoFocus placeholder="Specify destination…" value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="w-full px-3 py-2 pr-8 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
              />
              <button
                type="button"
                onClick={() => { hapticLight(); setTo(null); setCustomTo(''); setRouteStep('destination'); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-lg leading-none"
              >×</button>
            </div>
          )}
        </div>

        {/* License Plate */}
        <div className="relative z-10">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">License Plate *</label>
          <input
            type="text" placeholder="e.g. JFT 881" value={plate}
            onChange={e => {
              const val = e.target.value.toUpperCase();
              setPlate(val);
              if (shuttlePlate) setIsShuttle(val.trim() === shuttlePlate.toUpperCase().trim());
              if (!val) setShowSuggestions(false);
            }}
            onBlur={() => {
              // Delay hiding to allow click event on suggestion
              setTimeout(() => setShowSuggestions(false), 200);
              handlePlateBlur();
            }}
            onFocus={() => {
              if (plateSuggestions.length > 0) setShowSuggestions(true);
            }}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition uppercase"
          />
          {showSuggestions && plateSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-[68px] bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden z-50">
              {plateSuggestions.map(v => (
                <button
                  key={v.license_plate}
                  type="button"
                  onClick={() => handleSuggestionSelect(v)}
                  className="w-full text-left px-4 py-2.5 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 transition-colors border-b border-gray-100 dark:border-gray-700/50 last:border-0 flex justify-between items-center cursor-pointer"
                >
                  <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{v.license_plate}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{v.year} {v.make} {v.model}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4 mt-3">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isShuttle ? 'bg-yellow-400 border-yellow-400 text-black' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700'}`}>
                {isShuttle && <span className="text-xs font-bold leading-none">✓</span>}
              </div>
              <input type="checkbox" className="sr-only" checked={isShuttle} onChange={e => {
                hapticLight();
                const checked = e.target.checked;
                setIsShuttle(checked);
                if (checked && shuttlePlate) setPlate(shuttlePlate.toUpperCase());
                else if (!checked && shuttlePlate && plate === shuttlePlate.toUpperCase()) setPlate('');
              }} />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">Lot Shuttle</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group" onClick={() => { hapticLight(); setIsTeslaRun(v => !v); }}>
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isTeslaRun ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700'}`}>
                {isTeslaRun && <span className="text-xs font-bold leading-none">✓</span>}
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">Tesla ⚡</span>
            </label>
          </div>
        </div>

        {isTeslaRun && (
          <EVAssetCheck
            cableStatus={evCableStatus}
            adapterStatus={evAdapterStatus}
            onCableChange={setEvCableStatus}
            onAdapterChange={setEvAdapterStatus}
          />
        )}

        <NotesField value={notes} onChange={setNotes} tripState="form" />

        {user && (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Logging as: <span className="font-semibold">{user.name ?? user.id}</span> · {user.role} · #{user.employeeId}
          </p>
        )}

        <button
          type="button" disabled={!canStart} onClick={handleStart}
          className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition cursor-pointer"
        >
          Start Trip →
        </button>
      </div>
    );
  }

  // ── In Transit ────────────────────────────────────────────────────────────
  if (liveState === 'in_transit') {
    return (
      <DriverLiveTransitView
        vehicleDetails={vehicleDetails}
        plate={plate}
        fromLabel={fromLabel}
        toLabel={toLabel}
        departureTime={departureTime}
        elapsed={elapsed}
        notes={notes}
        setNotes={setNotes}
        saveError={saveError}
        submitting={submitting}
        handleArrived={handleArrived}
        handleCancelTrip={handleCancelTrip}
      />
    );
  }

  // ── Complete ──────────────────────────────────────────────────────────────
  return (
    <DriverLiveCompleteView
      vehicleDetails={vehicleDetails}
      plate={plate}
      fromLabel={fromLabel}
      toLabel={toLabel}
      departureTime={departureTime}
      arrivalTime={arrivalTime}
      notes={notes}
      handleReset={handleReset}
    />
  );
}
