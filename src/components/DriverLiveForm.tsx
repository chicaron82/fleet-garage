import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import { hapticLight, hapticMedium } from '../lib/haptics';
import { supabase } from '../lib/supabase';
import { elapsedSince, fmtTime, NotesField, TRIP_DURATION_THRESHOLDS } from '../lib/vsa-trip';
import { pushNotification } from '../lib/garage-uploads';
import type { TripRun } from '../data/trips';
import type { RentalClass } from '../data/manifest';
import { PriorityHint } from './PriorityHint';

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

  useEffect(() => {
    if (liveState !== 'in_transit' || !departureTime) return;
    const id = setInterval(() => setElapsed(elapsedSince(departureTime)), 1000);
    return () => clearInterval(id);
  }, [liveState, departureTime]);

  const fromLabel = from === 'Other' ? (customFrom || 'Other') : (from ?? '');
  const toLabel   = to   === 'Other' ? (customTo   || 'Other') : (to   ?? '');

  const canStart = plate.trim().length > 0
    && routeStep === 'confirmed'
    && (from !== 'Other' || customFrom.trim().length > 0)
    && (to   !== 'Other' || customTo.trim().length > 0);

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

  const handleStart = () => {
    hapticMedium();
    setDepartureTime(new Date().toISOString());
    setElapsed('0m 00s');
    setLiveState('in_transit');
  };

  const handleArrived = async () => {
    hapticMedium();
    setSaveError(false);
    setSubmitting(true);
    const arrived = arrivalTime || new Date().toISOString();
    if (!arrivalTime) setArrivalTime(arrived);

    if (user) {
      const trip: TripRun = {
        id:             `live-${Date.now()}`,
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

      const { error } = await supabase.from('vsa_trips').insert({
        id:              trip.id,
        vehicle_plate:   trip.vehiclePlate,
        vehicle_unit:    '',
        trip_type:       trip.tripType,
        depart_location: trip.departLocation,
        arrive_location: trip.arriveLocation,
        depart_time:     trip.departTime,
        arrive_time:     trip.arriveTime,
        driver_id:       trip.driverId,
        is_shuttle:      isShuttle,
        notes:           trip.notes ?? null,
        branch_id:       trip.branchId,
      });

      if (error) {
        setSubmitting(false);
        setSaveError(true);
        return;
      }

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
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">License Plate *</label>
          <input
            type="text" placeholder="e.g. JFT 881" value={plate}
            onChange={e => {
              const val = e.target.value.toUpperCase();
              setPlate(val);
              if (shuttlePlate) setIsShuttle(val.trim() === shuttlePlate.toUpperCase().trim());
            }}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition uppercase"
          />
          <label className="flex items-center gap-2 mt-3 cursor-pointer group">
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
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">Using Lot Shuttle</span>
          </label>
        </div>

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
      <div className="space-y-3">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg px-4 py-4 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-2">In Transit</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{plate}</p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1 font-medium">{fromLabel} → {toLabel}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Departed {fmtTime(departureTime)}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 tabular-nums">{elapsed || '0m 00s'}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">elapsed</p>
            </div>
          </div>
        </div>
        <NotesField value={notes} onChange={setNotes} tripState="in_transit" />
        {saveError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg px-4 py-3">
            <p className="text-xs font-semibold text-red-700 dark:text-red-400">Couldn't save — check connection and try again.</p>
          </div>
        )}
        <button
          type="button" onClick={handleArrived} disabled={submitting}
          className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
        >
          {submitting ? 'Saving…' : '✓ Arrived at Destination'}
        </button>
      </div>
    );
  }

  // ── Complete ──────────────────────────────────────────────────────────────
  const dur = Math.round((new Date(arrivalTime).getTime() - new Date(departureTime).getTime()) / 60000);

  return (
    <div className="space-y-3">
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-lg px-4 py-3 transition-colors">
        <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-widest mb-1.5">Trip Complete</p>
        <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{plate}</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{fromLabel} → {toLabel}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {fmtTime(departureTime)} → {fmtTime(arrivalTime)} · {dur}m
        </p>
        {notes && <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-2">"{notes}"</p>}
      </div>
      <button
        type="button"
        onClick={handleReset}
        className="w-full py-2.5 rounded-lg border border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-400 font-semibold text-sm transition cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20"
      >
        Log another →
      </button>
    </div>
  );
}
