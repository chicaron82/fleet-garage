import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { hapticMedium } from '../lib/haptics';
import { supabase } from '../lib/supabase';
import { elapsedSince, fmtTime, NotesField } from '../lib/vsa-trip';
import type { TripRun } from '../data/trips';
import { PriorityHint } from './PriorityHint';

const LOCATIONS = ['Washbay', 'Airport', 'Other'] as const;
type Location = typeof LOCATIONS[number];

interface Props {
  topClasses: string[];
  flaggedClasses: string[];
  onTripComplete: (trip: TripRun) => void;
}

export function DriverLiveForm({ topClasses, flaggedClasses, onTripComplete }: Props) {
  const { user } = useAuth();

  const [liveState, setLiveState]         = useState<'form' | 'in_transit' | 'complete'>('form');
  const [from, setFrom]                   = useState<Location>('Washbay');
  const [to, setTo]                       = useState<Location>('Airport');
  const [customFrom, setCustomFrom]       = useState('');
  const [customTo, setCustomTo]           = useState('');
  const [plate, setPlate]                 = useState('');
  const [notes, setNotes]                 = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [arrivalTime, setArrivalTime]     = useState('');
  const [elapsed, setElapsed]             = useState('');
  const [submitting, setSubmitting]       = useState(false);

  useEffect(() => {
    if (liveState !== 'in_transit' || !departureTime) return;
    const id = setInterval(() => setElapsed(elapsedSince(departureTime)), 1000);
    return () => clearInterval(id);
  }, [liveState, departureTime]);

  const fromLabel = from === 'Other' ? (customFrom || 'Other') : from;
  const toLabel   = to   === 'Other' ? (customTo   || 'Other') : to;
  const canStart  = plate.trim().length > 0 && (from !== 'Other' || customFrom.trim().length > 0) && (to !== 'Other' || customTo.trim().length > 0);

  const handleStart = () => {
    hapticMedium();
    setDepartureTime(new Date().toISOString());
    setElapsed('0m 00s');
    setLiveState('in_transit');
  };

  const handleArrived = async () => {
    hapticMedium();
    setSubmitting(true);
    const arrived = new Date().toISOString();
    setArrivalTime(arrived);

    if (user) {
      const trip: TripRun = {
        id:             `live-${Date.now()}`,
        vehiclePlate:   plate.trim().toUpperCase(),
        vehicleUnit:    '',
        tripType:       'clean',
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

      await supabase.from('vsa_trips').insert({
        id:              trip.id,
        vehicle_plate:   trip.vehiclePlate,
        vehicle_unit:    '',
        trip_type:       trip.tripType,
        depart_location: trip.departLocation,
        arrive_location: trip.arriveLocation,
        depart_time:     trip.departTime,
        arrive_time:     trip.arriveTime,
        driver_id:       trip.driverId,
        notes:           trip.notes ?? null,
        branch_id:       trip.branchId,
      });

      onTripComplete(trip);
    }

    setSubmitting(false);
    setLiveState('complete');
  };

  const handleReset = () => {
    setLiveState('form');
    setFrom('Washbay');
    setTo('Airport');
    setCustomFrom('');
    setCustomTo('');
    setPlate('');
    setNotes('');
    setDepartureTime('');
    setArrivalTime('');
    setElapsed('');
  };

  // ── Form ──────────────────────────────────────────────────────────────────
  if (liveState === 'form') {
    return (
      <div className="space-y-4">
        <PriorityHint flaggedClasses={flaggedClasses} topClasses={topClasses} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Starting At</label>
            <div className="flex flex-col gap-1.5">
              {LOCATIONS.map(loc => (
                <button
                  key={loc} type="button"
                  onClick={() => setFrom(loc)}
                  className={`py-2 rounded-lg border text-sm font-medium transition cursor-pointer ${
                    from === loc
                      ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-gray-900 dark:text-gray-100'
                      : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >{loc}</button>
              ))}
              {from === 'Other' && (
                <input
                  type="text" placeholder="Specify…" value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
                />
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Going To</label>
            <div className="flex flex-col gap-1.5">
              {LOCATIONS.map(loc => (
                <button
                  key={loc} type="button"
                  onClick={() => setTo(loc)}
                  className={`py-2 rounded-lg border text-sm font-medium transition cursor-pointer ${
                    to === loc
                      ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-gray-900 dark:text-gray-100'
                      : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >{loc}</button>
              ))}
              {to === 'Other' && (
                <input
                  type="text" placeholder="Specify…" value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
                />
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">License Plate *</label>
          <input
            type="text" placeholder="e.g. JFT 881" value={plate}
            onChange={e => setPlate(e.target.value.toUpperCase())}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition uppercase"
          />
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
        <button
          type="button" onClick={handleArrived} disabled={submitting}
          className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
        >
          ✓ Arrived at Destination
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
      <button type="button" onClick={handleReset} className="text-xs font-semibold text-yellow-600 hover:text-yellow-800 transition cursor-pointer">
        Log another →
      </button>
    </div>
  );
}
