import { useAuth } from '../context/AuthContext';
import { hapticLight } from '../lib/haptics';
import { canRelease } from '../types';
import { REASON_LABELS, Pill, NotesField } from '../lib/vsa-trip';
import type { Reason, Authorization, QueueSnapshot } from '../lib/vsa-trip';
import { PriorityHint } from './PriorityHint';

export interface TripFormProps {
  queue: QueueSnapshot | null;         setQueue: (q: QueueSnapshot) => void;
  reason: Reason | null;               setReason: (r: Reason) => void;
  authorization: Authorization | null; setAuthorization: (a: Authorization | null) => void;
  notes: string;                       setNotes: (v: string) => void;
  isShuttle: boolean;
  shuttlePlate: string;                setShuttlePlate: (v: string) => void;
  topClasses: string[];
  flaggedClasses: string[];
  canStart: boolean;
  onShuttleToggle: (checked: boolean) => void;
  onStartTrip: () => void;
}

export function TripForm({
  queue, setQueue, reason, setReason,
  authorization, setAuthorization, notes, setNotes,
  isShuttle, shuttlePlate, setShuttlePlate,
  topClasses, flaggedClasses, canStart,
  onShuttleToggle, onStartTrip,
}: TripFormProps) {
  const { user } = useAuth();

  return (
    <>
      <PriorityHint flaggedClasses={flaggedClasses} topClasses={topClasses} />

      {/* Lot Shuttle */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer group">
          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isShuttle ? 'bg-yellow-400 border-yellow-400 text-black' : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700'}`}>
            {isShuttle && <span className="text-xs font-bold leading-none">✓</span>}
          </div>
          <input type="checkbox" className="sr-only" checked={isShuttle} onChange={e => onShuttleToggle(e.target.checked)} />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">Using Lot Shuttle</span>
        </label>
        {user && canRelease(user.role) && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">Designated Plate:</span>
            <input
              type="text" value={shuttlePlate}
              onChange={e => setShuttlePlate(e.target.value.toUpperCase())}
              className="w-20 px-2 py-0.5 text-xs rounded border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 focus:outline-none focus:border-yellow-400 transition-colors uppercase text-center"
            />
          </div>
        )}
      </div>

      {/* Queue */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
          Washbay Queue at Departure *
        </label>
        <div className="flex gap-2">
          <Pill label="0"   active={queue === '0'}        onClick={() => setQueue('0')} />
          <Pill label="~5"  active={queue === '~5'}       onClick={() => setQueue('~5')} />
          <Pill label="10+" active={queue === 'TOO_MUCH'} danger onClick={() => setQueue('TOO_MUCH')} />
        </div>
      </div>

      {/* Reason */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Reason *</label>
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(REASON_LABELS) as Reason[]).map(r => (
            <button
              key={r} type="button"
              onClick={() => { hapticLight(); setReason(r); }}
              className={`px-3 py-2 rounded-lg border text-sm transition cursor-pointer ${
                reason === r
                  ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-gray-900 dark:text-gray-100 font-medium'
                  : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
              }`}
            >
              {REASON_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      <NotesField value={notes} onChange={setNotes} tripState="form" />

      {/* Authorization */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Authorization *</label>
        <select
          value={authorization ?? ''}
          onChange={e => setAuthorization((e.target.value as Authorization) || null as unknown as Authorization)}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition cursor-pointer"
        >
          <option value="">Select authorization…</option>
          <option value="MANAGEMENT">Management Decision</option>
          <option value="LEAD_VSA">Lead VSA / Senior VSA</option>
          <option value="PERSONAL">Personal — Proactive</option>
        </select>
      </div>

      {user && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Logging as: <span className="font-semibold">{user.name ?? user.id}</span> · {user.role} · #{user.employeeId}
        </p>
      )}

      <button
        type="button" disabled={!canStart} onClick={onStartTrip}
        className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition cursor-pointer"
      >
        Start Trip →
      </button>
    </>
  );
}
