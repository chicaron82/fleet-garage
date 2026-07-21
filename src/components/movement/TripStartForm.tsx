// The VSA airport-run card: thin composition over useTripLifecycle (all trip
// state + writes live there — extracted at the 330-cap wall,
// docs/ticket-near-cap-file-extractions.md). This file keeps the render, the
// collision-guard UI flow, the scan-register wiring, and the flagged-classes
// read; the three trip screens are their own sections (TripForm /
// TripInTransit / TripComplete).
import { useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useActiveSessions } from '../../context/ActiveSessionsContext';
import { useStartCollisionGuard } from '../../hooks/useStartCollisionGuard';
import { SessionCollisionGuard } from '../shared/SessionCollisionGuard';
import type { TripRun } from '../../data/trips';
import { generateDayManifest } from '../../data/manifest';
import { loadFlags } from '../../lib/manifestFlags';
import { loadOverrides } from '../../lib/classOverrides';
import { DEFAULT_AUTH } from '../../lib/vsa-trip';
import type { Reason, TripState } from '../../lib/vsa-trip';
import { useEvDispatchWarning } from '../../hooks/useEvDispatchWarning';
import { useTripLifecycle } from '../../hooks/useTripLifecycle';
import type { TripStartInfo } from '../../hooks/useTripLifecycle';
import { TripForm } from './TripForm';
import { TripInTransit } from './TripInTransit';
import { TripComplete } from './TripComplete';
import { Toast } from '../shared/Toast';
import { useRegisterOnScan } from '../../hooks/useRegisterOnScan';

export type { TripState };
export type { TripStartInfo };

export function TripStartForm({
  onTripComplete,
  onTripStarted,
  initialPlate,
  initialPlateNonce,
  autoStart,
}: {
  onTripComplete?: (trip: TripRun) => void;
  onTripStarted?: (info: TripStartInfo) => void;
  /** Plate handed in by the scan-router ("Start trip" on a scanned tag) — starts the form filled. */
  initialPlate?: string;
  /** Bumped per scan so re-scanning the same tag re-fills the plate (see Screen.prefillNonce). */
  initialPlateNonce?: number;
  /** Scan-router "Start trip" → auto-fire a Routine Transport run on arrival (land on the timer). */
  autoStart?: boolean;
}) {
  const { user } = useAuth();
  const { shuttlePlate, setShuttlePlate, addVehicle, updateVehicleFields, vehicles } = useVehicleHoldContext();
  // Scanning a key tag to start a trip registers a new vehicle (or backfills a partial) so the
  // trip isn't logged against a car FG doesn't fully know.
  const { registerToast, handleScanRead } = useRegisterOnScan({ vehicles, addVehicle, updateVehicleFields, user });
  const { oth, setMovementTab } = useActiveSessions();
  const collision = useStartCollisionGuard(oth); // speed-bump: trip-start while an OTH timer runs

  const t = useTripLifecycle({ initialPlate, initialPlateNonce, onTripStarted, onTripComplete });

  const flaggedClasses = useMemo(() => {
    const manifest  = generateDayManifest();
    const flags     = loadFlags();
    const overrides = loadOverrides();
    const manifestFlagged = [...new Set(manifest.filter(r => flags.has(r.id)).map(r => r.rentalClass))];
    return [...new Set([...overrides, ...manifestFlagged])];
  }, []);

  // Dispatch guard — flags a Tesla with known-missing EV kit before the run (see hook).
  const evWarning = useEvDispatchWarning(t.vehiclePlate);

  const handleQuickStart = (r: Reason) => {
    // Seed the authorization from the trip type (routine = personal, coverage =
    // management); the VSA can still change it on the in-transit screen. Guarded:
    // if an off-standard timer is already running, confirm before double-running.
    collision.guard(() => void t.startTrip(r, DEFAULT_AUTH[r] ?? null, ''));
  };

  // Scan-router "Start trip" auto-fires a Routine Transport run so the operator lands on the live
  // timer with the plate filled — one fewer tap than the old scan → land → quick-start route. Fired
  // from an EFFECT (once per scan nonce), so it runs AFTER useTripLifecycle's plate re-seed has
  // committed — startTrip reads the plate from state, so firing during render would grab the empty
  // one. Runs through the same collision guard as a manual quick-start (a live off-standard timer
  // still speed-bumps). Reason isn't editable in-transit, so it commits to ROUTINE; authorization
  // still is, and Reset abandons — Coverage-Assist runs use the form's quick-start instead.
  const autoStartedNonce = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!autoStart || !initialPlateNonce) return;
    if (autoStartedNonce.current === initialPlateNonce) return;
    autoStartedNonce.current = initialPlateNonce;
    handleQuickStart('ROUTINE');
    // handleQuickStart/collision intentionally omitted — the nonce ref makes this fire exactly once
    // per scan; including the per-render handler identity would re-fire it every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, initialPlateNonce]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Movement Log</p>
          {t.tripState === 'in_transit' && (
            <p className="text-[10px] text-amber-500 font-semibold uppercase tracking-wide mt-0.5">● In Transit</p>
          )}
          {t.tripState === 'complete' && (
            <p className="text-[10px] text-green-600 dark:text-green-400 font-semibold uppercase tracking-wide mt-0.5">✓ Trip Complete</p>
          )}
        </div>
        {t.tripState !== 'form' && (
          <button onClick={t.handleReset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer">Reset</button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {t.tripState === 'form' && collision.guardActive && oth && (
          <SessionCollisionGuard other={oth} onProceed={collision.proceed}
            onGoEnd={() => { collision.dismiss(); setMovementTab('off-standard'); }} />
        )}

        {t.tripState === 'form' && (
          <>
            <TripForm
              isShuttle={t.isShuttle}   shuttlePlate={shuttlePlate} setShuttlePlate={setShuttlePlate}
              vehiclePlate={t.vehiclePlate} setVehiclePlate={t.setVehiclePlate} onPlateBlur={t.handlePlateBlur} onScanRead={handleScanRead}
              flaggedClasses={flaggedClasses}
              onShuttleToggle={t.handleShuttleToggle}
              onCodeRedDispatch={t.handleCodeRedDispatch}
              onQuickStart={handleQuickStart}
              isTeslaRun={t.isTeslaRun}         setIsTeslaRun={t.setIsTeslaRun}
              evCableStatus={t.evCableStatus}   setEvCableStatus={t.setEvCableStatus}
              evAdapterStatus={t.evAdapterStatus} setEvAdapterStatus={t.setEvAdapterStatus}
              evWarning={evWarning}
            />
            {t.startError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-red-700 dark:text-red-400">Couldn't save — check connection and try again.</p>
              </div>
            )}
          </>
        )}

        {t.tripState === 'in_transit' && (
          <TripInTransit
            authorization={t.authorization} setAuthorization={t.setAuthorization}
            queue={t.queue}                 setQueue={t.setQueue}
            queueArrival={t.queueArrival}   setQueueArrival={t.setQueueArrival}
            departureTime={t.departureTime} elapsed={t.elapsed}
            notes={t.notes}                 setNotes={t.setNotes}
            onArrived={t.handleArrived}
            onDelete={t.handleReset}
          />
        )}

        {t.tripState === 'complete' && (
          <TripComplete
            isShuttle={t.isShuttle}
            authorization={t.authorization} reason={t.reason}
            departureTime={t.departureTime} arrivalTime={t.arrivalTime}
            queue={t.queue}                 queueArrival={t.queueArrival}
            oneWay={t.completedOneWay}
            notes={t.notes}           setNotes={t.setNotes}
            onReset={t.handleReset}
          />
        )}
      </div>
      {registerToast && <Toast message={registerToast} />}
    </div>
  );
}
