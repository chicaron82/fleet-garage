import { fmtTime } from '../lib/vsa-trip';
import type { Authorization, QueueSnapshot } from '../lib/vsa-trip';
import { NotesField, Pill } from './VSATripComponents';

export function TripInTransit({
  authorization, setAuthorization,
  queue, setQueue,
  departureTime, elapsed,
  notes, setNotes,
  onArrived,
}: {
  authorization: Authorization | null; setAuthorization: (a: Authorization) => void;
  queue: QueueSnapshot | null;         setQueue: (q: QueueSnapshot) => void;
  departureTime: string; elapsed: string;
  notes: string; setNotes: (v: string) => void;
  onArrived: () => void;
}) {
  const canEnd = authorization !== null;

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

      {/* Authorization — required before ending */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
          Authorization *
        </label>
        <select
          value={authorization ?? ''}
          onChange={e => { if (e.target.value) setAuthorization(e.target.value as Authorization); }}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition cursor-pointer"
        >
          <option value="">Select authorization…</option>
          <option value="MANAGEMENT">Management Decision</option>
          <option value="LEAD_VSA">Lead VSA / Senior VSA</option>
          <option value="PERSONAL">Personal — Proactive</option>
        </select>
      </div>

      <NotesField value={notes} onChange={setNotes} tripState="in_transit" />

      <button
        type="button"
        onClick={onArrived}
        disabled={!canEnd}
        className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition cursor-pointer"
      >
        {canEnd ? '✓ Back at Washbay' : 'Select authorization to end trip'}
      </button>
    </div>
  );
}
