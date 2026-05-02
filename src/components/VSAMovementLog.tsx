import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { hapticLight, hapticMedium } from '../lib/haptics';
import { useGarage } from '../context/GarageContext';
import type { TripRun } from '../data/trips';
import { generateDayManifest, getNextFiveNeeded } from '../data/manifest';
import {
  FUEL_LABELS,
  defaultCondition, elapsedSince,
} from '../lib/vsa-trip';
import type {
  VSALocation, Condition, Reason, Authorization,
  QueueSnapshot, FuelLevel, TripState, RouteStep,
} from '../lib/vsa-trip';
import { TripForm } from './TripForm';
import { TripInTransit } from './TripInTransit';
import { TripComplete } from './TripComplete';

export type { TripState, RouteStep };

export function VSAMovementLog({ onTripComplete }: { onTripComplete?: (trip: TripRun) => void }) {
  const { user } = useAuth();
  const { vehicles, shuttlePlate, setShuttlePlate } = useGarage();

  const [tripState, setTripState] = useState<TripState>('form');
  const [routeStep, setRouteStep] = useState<RouteStep>('origin');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');

  const [plate, setPlate]                     = useState('');
  const [from, setFrom]                       = useState<VSALocation>('Washbay');
  const [to, setTo]                           = useState<VSALocation>('Airport');
  const [condition, setCondition]             = useState<Condition>('CLEAN');
  const [conditionManual, setConditionManual] = useState(false);
  const [reason, setReason]                   = useState<Reason | null>(null);
  const [queue, setQueue]                     = useState<QueueSnapshot | null>(null);
  const [fuel, setFuel]                       = useState<FuelLevel | null>(null);
  const [authorization, setAuthorization]     = useState<Authorization | null>(null);
  const [notes, setNotes]                     = useState('');
  const [isShuttle, setIsShuttle]             = useState(false);

  const [departureTime, setDepartureTime] = useState('');
  const [arrivalTime, setArrivalTime]     = useState('');
  const [elapsed, setElapsed]             = useState('');

  const topClasses = useMemo(() => {
    const manifest = generateDayManifest();
    const next5 = getNextFiveNeeded(manifest);
    return [...new Set(next5.map(r => r.rentalClass))].slice(0, 3);
  }, []);

  const vehicleMeta = useMemo(() => {
    const t = plate.trim().replace(/\s/g, '').toUpperCase();
    if (isShuttle) return 'Internal Transport · Lot Shuttle';
    if (t.length < 3) return null;
    const match = vehicles.find(v => v.licensePlate.replace(/\s/g, '').toUpperCase() === t);
    return match ? `${match.year} ${match.make} ${match.model} · ${match.unitNumber}` : null;
  }, [plate, isShuttle, vehicles]);

  useEffect(() => {
    if (tripState !== 'in_transit' || !departureTime) return;
    const id = setInterval(() => setElapsed(elapsedSince(departureTime)), 1000);
    return () => clearInterval(id);
  }, [tripState, departureTime]);

  const handleSetFrom = (loc: VSALocation) => { setFrom(loc); setQueue(null); };
  const handleSetTo   = (loc: VSALocation) => {
    setTo(loc);
    setFuel(null);
    if (!conditionManual) setCondition(defaultCondition(loc));
  };

  const handleShuttleToggle = (checked: boolean) => {
    hapticLight();
    setIsShuttle(checked);
    if (checked && shuttlePlate) {
      setPlate(shuttlePlate);
    } else if (!checked && plate.trim().toUpperCase() === shuttlePlate) {
      setPlate('');
    }
  };

  const handleLocationTap = (loc: VSALocation) => {
    if (routeStep === 'origin') {
      hapticLight();
      handleSetFrom(loc);
      setRouteStep('destination');
    } else if (routeStep === 'destination') {
      if (loc === from) {
        hapticLight();
        handleSetFrom('Washbay');
        setCustomFrom('');
        setRouteStep('origin');
      } else {
        hapticMedium();
        handleSetTo(loc);
        setRouteStep('confirmed');
      }
    }
  };

  const handleRouteReset = () => {
    hapticLight();
    handleSetFrom('Washbay');
    handleSetTo('Airport');
    setCustomFrom('');
    setCustomTo('');
    setRouteStep('origin');
  };

  const handlePlateChange = (newPlate: string) => {
    const upper = newPlate.toUpperCase();
    setPlate(upper);
    if (shuttlePlate && upper.trim() === shuttlePlate) {
      setIsShuttle(true);
    } else if (isShuttle && upper.trim() !== shuttlePlate) {
      setIsShuttle(false);
    }
  };

  const canStart = plate.trim().length > 0 && routeStep === 'confirmed' && reason !== null
    && !!authorization && (from !== 'Washbay' || queue !== null);

  const handleStartTrip = () => {
    hapticMedium();
    const now = new Date().toISOString();
    setDepartureTime(now);
    setElapsed('0m 00s');
    setTripState('in_transit');
  };

  const handleArrived = () => {
    hapticMedium();
    const arrived = new Date().toISOString();
    setArrivalTime(arrived);
    setTripState('complete');

    if (onTripComplete && user) {
      onTripComplete({
        id: `vsa-session-${Date.now()}`,
        vehicleUnit:      vehicleMeta?.split(' · ')[1] ?? '',
        vehiclePlate:     plate,
        tripType:         isShuttle ? 'transfer' : (condition === 'CLEAN' ? 'clean' : 'dirty'),
        departLocation:   from,
        arriveLocation:   to,
        departTime:       departureTime,
        arriveTime:       arrived,
        gasLevel:         '',
        odometer:         0,
        driverId:         user.id,
        isVsaInterruption: true,
        authorization:    authorization ?? undefined,
        reason:           reason ?? undefined,
        queueAtDeparture: queue ?? undefined,
        fuelOnArrival:    fuel !== null ? FUEL_LABELS[fuel] : undefined,
        condition:        isShuttle ? undefined : condition,
        notes:            notes.trim() || undefined,
        branchId:         user.branchId,
      });
    }
  };

  const handleReset = () => {
    setTripState('form');
    setPlate('');
    setFrom('Washbay');       setTo('Airport');
    setConditionManual(false); setCondition('CLEAN');
    setReason(null);           setQueue(null); setFuel(null); setAuthorization(null);
    setNotes('');              setIsShuttle(false);
    setDepartureTime('');      setArrivalTime(''); setElapsed('');
    setRouteStep('origin');
    setCustomFrom('');         setCustomTo('');
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
            plate={plate}           setPlate={setPlate}
            from={from}             to={to}
            condition={condition}   conditionManual={conditionManual}
            reason={reason}         setReason={setReason}
            queue={queue}           setQueue={setQueue}
            fuel={fuel}             setFuel={setFuel}
            authorization={authorization} setAuthorization={setAuthorization}
            notes={notes}           setNotes={setNotes}
            isShuttle={isShuttle}
            routeStep={routeStep}
            customFrom={customFrom} setCustomFrom={setCustomFrom}
            customTo={customTo}     setCustomTo={setCustomTo}
            shuttlePlate={shuttlePlate} setShuttlePlate={setShuttlePlate}
            vehicleMeta={vehicleMeta}   topClasses={topClasses} canStart={canStart}
            onShuttleToggle={handleShuttleToggle}
            onConditionTap={c => { hapticLight(); setCondition(c); setConditionManual(true); }}
            onLocationTap={handleLocationTap}
            onRouteReset={handleRouteReset}
            onStartTrip={handleStartTrip}
            onPlateChange={handlePlateChange}
          />
        )}

        {tripState === 'in_transit' && (
          <TripInTransit
            plate={plate}           vehicleMeta={vehicleMeta}
            from={from}             to={to}
            authorization={authorization}
            departureTime={departureTime} elapsed={elapsed}
            notes={notes}           setNotes={setNotes}
            onArrived={handleArrived}
          />
        )}

        {tripState === 'complete' && (
          <TripComplete
            plate={plate}           vehicleMeta={vehicleMeta}
            from={from}             to={to}
            authorization={authorization} reason={reason}
            condition={condition}   isShuttle={isShuttle}
            departureTime={departureTime} arrivalTime={arrivalTime}
            queue={queue}           fuel={fuel}
            notes={notes}           setNotes={setNotes}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}
