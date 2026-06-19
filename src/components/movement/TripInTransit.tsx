import { useState } from 'react';
import { fmtTime, TRIP_DURATION_THRESHOLDS } from '../../lib/vsa-trip';
import type { Authorization, QueueSnapshot } from '../../lib/vsa-trip';
import { NotesField, Pill } from './VSATripComponents';

export function TripInTransit({
  authorization, setAuthorization,
  queue, setQueue,
  queueArrival, setQueueArrival,
  departureTime, elapsed,
  notes, setNotes,
  onArrived,
  onDelete,
}: {
  authorization: Authorization | null; setAuthorization: (a: Authorization) => void;
  queue: QueueSnapshot | null;         setQueue: (q: QueueSnapshot) => void;
  queueArrival: QueueSnapshot | null;  setQueueArrival: (q: QueueSnapshot) => void;
  departureTime: string; elapsed: string;
  notes: string; setNotes: (v: string) => void;
  onArrived: (oneWay: boolean) => void;
  onDelete: () => void;
}) {
  const canEnd = authorization !== null;

  // A real run is ~8–15 min; under 5 is almost always a mis-tap on either
  // end-state. pendingShort holds the chosen path (oneWay true/false) while the
  // confirm card is up; null = no confirm. Applies to both buttons (ticket: a
  // one-way under-5 trip is just as suspicious as a round trip).
  const [pendingShort, setPendingShort] = useState<boolean | null>(null);

  const attemptEnd = (oneWay: boolean) => {
    const mins = (Date.now() - new Date(departureTime).getTime()) / 60000;
    if (mins < TRIP_DURATION_THRESHOLDS.short) { setPendingShort(oneWay); return; }
    onArrived(oneWay);
  };

  return (
    <div className="space-y-3">
      {/* In-transit header */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg px-4 py-4 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-2">In Transit</p>
            <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">Airport Run</p>
            {authorization && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {authorization === 'MANAGEMENT' ? 'Management Decision' : authorization === 'LEAD_VSA' ? 'Lead VSA Authorization' : 'Personal — Proactive'}
              </p>
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Departed {fmtTime(departureTime)}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 tabular-nums">{elapsed || '0m 00s'}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">elapsed</p>
          </div>
        </div>
      </div>

      {/* Queue at departure */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
          Washbay Queue at Departure
        </label>
        <div className="flex gap-2">
          <Pill label="0"   active={queue === '0'}        onClick={() => setQueue('0')} />
          <Pill label="~5"  active={queue === '~5'}       onClick={() => setQueue('~5')} />
          <Pill label="10+" active={queue === '10+'} danger onClick={() => setQueue('10+')} />
        </div>
      </div>

      {/* Queue on return — round-trip reading only. "End Trip" (one-way) ignores
          it and stores null; it's the captured queue for "Back at Washbay." */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
          Washbay Queue on Return <span className="text-gray-400 dark:text-gray-600 normal-case font-normal">round trip · optional</span>
        </label>
        <div className="flex gap-2">
          <Pill label="0"   active={queueArrival === '0'}        onClick={() => setQueueArrival('0')} />
          <Pill label="~5"  active={queueArrival === '~5'}       onClick={() => setQueueArrival('~5')} />
          <Pill label="10+" active={queueArrival === '10+'} danger onClick={() => setQueueArrival('10+')} />
        </div>
      </div>

      {/* Authorization — pre-selected from the trip type, tap to change */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
          Authorization *
        </label>
        <div className="flex gap-2">
          <Pill label="Management"    active={authorization === 'MANAGEMENT'} onClick={() => setAuthorization('MANAGEMENT')} />
          <Pill label="Lead / Sr VSA" active={authorization === 'LEAD_VSA'}   onClick={() => setAuthorization('LEAD_VSA')} />
          <Pill label="Personal"      active={authorization === 'PERSONAL'}   onClick={() => setAuthorization('PERSONAL')} />
        </div>
      </div>

      <NotesField value={notes} onChange={setNotes} tripState="in_transit" />

      {pendingShort !== null ? (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800/50 rounded-lg px-4 py-3 space-y-3">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
            Only {elapsed || '0m 00s'} — short for a real trip. Log it, or delete it?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setPendingShort(null); onDelete(); }}
              className="flex-1 py-2.5 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-semibold transition cursor-pointer"
            >
              Delete it
            </button>
            <button
              type="button"
              onClick={() => onArrived(pendingShort)}
              className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition cursor-pointer"
            >
              Log it
            </button>
          </div>
        </div>
      ) : !canEnd ? (
        <button
          type="button"
          disabled
          className="w-full py-3 bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition"
        >
          Select authorization to end trip
        </button>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => attemptEnd(false)}
            className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-semibold text-sm rounded-lg transition cursor-pointer"
          >
            ✓ Back at Washbay
          </button>
          <button
            type="button"
            onClick={() => attemptEnd(true)}
            className="w-full py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-semibold text-sm transition cursor-pointer"
          >
            ⬛ End Trip — staying here
          </button>
        </div>
      )}
    </div>
  );
}
