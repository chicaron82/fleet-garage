import { useState, type Dispatch, type SetStateAction } from 'react';
import { supabase, writeWithRefresh } from '../../lib/supabase';
import { localDateStr } from '../../hooks/useFleetBalance';
import { createOrEnrichRegistry } from '../../lib/vehicleRegistry';
import { useActiveSessions } from '../../context/ActiveSessionsContext';
import { TripStartForm, type TripStartInfo } from './TripStartForm';
import { OverflowSendForm } from './OverflowSendForm';
import { OffStandardTimeLog } from '../off-standard/OffStandardTimeLog';
import { TripList } from './TripList';
import { ModuleHeader } from '../shared/ModuleHeader';
import type { TripRun } from '../../data/trips';
import type { OffStandardEntry, User } from '../../types';

interface Props {
  user: User;
  today: string;
  liveTrips: TripRun[];
  setLiveTrips: Dispatch<SetStateAction<TripRun[]>>;
}

/** VSA / Lead-VSA movement screen: Movement Log + Off-Standard Time tabs. Both
 *  tabs stay mounted so the OTH timer survives switches. Owns its own tab +
 *  off-standard-refresh state — separate from the driver/management view. */
export function MovementLogVsaView({ user, today, liveTrips, setLiveTrips }: Props) {
  const [offStandardRefresh, setOffStandardRefresh] = useState(0);
  // One-way ("staying here") end of an airport run = the VSA stayed to flip returns. Bumping this
  // signals OffStandardTimeLog to auto-start the flipping timer (see lib/autoFlipSignal).
  const [autoFlipSignal, setAutoFlipSignal] = useState(0);
  // Tab is context-owned so a pill tap (from anywhere in the shell) selects it as
  // controlled state — no consume-and-clear signal, no effect.
  const { refresh: refreshActiveSessions, movementTab: activeTab, setMovementTab: setActiveTab } = useActiveSessions();

  const myLiveTrips = liveTrips.filter(t => t.driverId === user.id);

  const addAutoOffStandardEntry = async (entry: OffStandardEntry) => {
    await writeWithRefresh(() => supabase.from('off_standard_entries').insert({
      user_id:        user.id,
      branch_id:      user.branchId,
      date:           localDateStr(0),
      start_time:     entry.startTime,
      stop_time:      entry.stopTime,
      minutes:        entry.minutes,
      reason:         entry.reason,
      explanation:    entry.explanation ?? null,
      auto_from_trip: true,
      status:         'complete',
    }));
    setOffStandardRefresh(n => n + 1);
  };

  const handleTripStarted = (info: TripStartInfo) => {
    refreshActiveSessions(); // surface the pill the moment a trip starts
    if (info.vehiclePlate) {
      void createOrEnrichRegistry({
        branchId: user.branchId,
        plate: info.vehiclePlate,
        dispatchedAt: info.departTime,
      });
    }
  };

  const handleTripComplete = (trip: TripRun) => {
    refreshActiveSessions(); // trip ended — drop the pill
    setLiveTrips(prev => [trip, ...prev.filter(t => t.id !== trip.id)]);

    // "Staying here" (one-way): stayed at the airport to flip returns. Auto-start the flipping
    // timer AND switch to the off-standard tab so the running timer is visible, not a silent start.
    if (trip.oneWay) {
      setAutoFlipSignal(n => n + 1);
      setActiveTab('off-standard');
    }

    if (trip.isVsaInterruption) {
      const minutes = Math.round(
        (new Date(trip.arriveTime).getTime() - new Date(trip.departTime).getTime()) / 60000
      );
      if (minutes >= 5) {
        addAutoOffStandardEntry({
          id:           `auto-${trip.id}`,
          startTime:    trip.departTime,
          stopTime:     trip.arriveTime,
          minutes,
          reason:       'OTH',
          explanation:  'VSA Airport Run',
          autoFromTrip: true,
        });
      }
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <ModuleHeader title="Movement Log" subtitle={today} />

      {/* Tab strip */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1 transition-colors">
        {(['movement-log', 'off-standard'] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === tab
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab === 'movement-log' ? 'Movement Log' : 'Off-Standard Time'}
          </button>
        ))}
      </div>

      {/* Tab content — both tabs stay mounted so OTH timer state survives tab switches */}
      <div className={activeTab === 'movement-log' ? 'space-y-5' : 'hidden'}>
        <TripStartForm onTripComplete={handleTripComplete} onTripStarted={handleTripStarted} />
        <OverflowSendForm onLogged={refreshActiveSessions} />
        {myLiveTrips.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Your Runs Today</p>
            <TripList trips={myLiveTrips} isManagement={false} />
          </div>
        )}
      </div>
      <div className={activeTab === 'off-standard' ? undefined : 'hidden'}>
        <OffStandardTimeLog user={user} refreshTrigger={offStandardRefresh} autoFlipTrigger={autoFlipSignal} />
      </div>
    </div>
  );
}
