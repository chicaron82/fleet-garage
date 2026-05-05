import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { hapticLight, hapticMedium } from '../lib/haptics';
import { useGarage } from '../context/GarageContext';
import type { TripRun } from '../data/trips';
import { generateDayManifest, getNextFiveNeeded } from '../data/manifest';
import { loadFlags } from '../lib/manifestFlags';
import { elapsedSince, TRIP_DURATION_THRESHOLDS } from '../lib/vsa-trip';
import type { Reason, Authorization, QueueSnapshot, TripState } from '../lib/vsa-trip';
import { pushNotification } from '../lib/garage-uploads';
import { TripForm } from './TripForm';
import { TripInTransit } from './TripInTransit';
import { TripComplete } from './TripComplete';

export type { TripState };

export function VSAMovementLog({ onTripComplete }: { onTripComplete?: (trip: TripRun) => void }) {
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

  const handleShuttleToggle = (checked: boolean) => {
    hapticLight();
    setIsShuttle(checked);
  };

  const canStart = reason !== null && !!authorization && queue !== null;

  const handleStartTrip = () => {
    hapticMedium();
    setDepartureTime(new Date().toISOString());
    setElapsed('0m 00s');
    setTripState('in_transit');
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
