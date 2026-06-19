import { REASON_LABELS, fmtTime, queueWorsened } from '../../lib/vsa-trip';
import type { Authorization, Reason, QueueSnapshot } from '../../lib/vsa-trip';
import { NotesField } from './VSATripComponents';

export function TripComplete({ isShuttle, authorization, reason, departureTime, arrivalTime, queue, queueArrival, oneWay, notes, setNotes, onReset }: {
  isShuttle: boolean;
  authorization: Authorization | null;
  reason: Reason | null;
  departureTime: string; arrivalTime: string;
  queue: QueueSnapshot | null;
  queueArrival: QueueSnapshot | null;
  oneWay: boolean;
  notes: string; setNotes: (v: string) => void;
  onReset: () => void;
}) {
  const dur = Math.round((new Date(arrivalTime).getTime() - new Date(departureTime).getTime()) / 60000);
  // A one-way trip never returned, so there's no return queue to compare —
  // show the departure reading alone, no worsened flag.
  const worsened = !oneWay && queueWorsened(queue, queueArrival);
  const queueText = !queue
    ? null
    : oneWay
      ? queue
      : (queueArrival && queueArrival !== queue ? `${queue} → ${queueArrival}` : queue);

  return (
    <div className="space-y-3">
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-lg overflow-hidden transition-colors">
        <div className="px-4 py-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-widest mb-1.5">Trip Complete</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
              Airport Run
              {oneWay && <span className="text-gray-400 dark:text-gray-500 font-normal"> · one-way</span>}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{fmtTime(departureTime)} → {fmtTime(arrivalTime)} · {dur}m</p>
            {queueText && (
              <p className={`text-xs mt-0.5 font-medium ${worsened ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>
                Queue: {queueText}{worsened ? ' ⚠ worse on return' : ''}
              </p>
            )}
          </div>
          <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${
            isShuttle
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
          }`}>
            {isShuttle ? 'Shuttle' : 'VSA Run'}
          </span>
        </div>
        <div className={`px-4 py-2 border-t ${
          authorization === 'PERSONAL'
            ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-100 dark:border-teal-900/30'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30'
        } transition-colors`}>
          <span className={`text-xs font-semibold ${
            authorization === 'PERSONAL' ? 'text-teal-700 dark:text-teal-400' : 'text-amber-700 dark:text-amber-400'
          }`}>
            {authorization === 'PERSONAL' ? '🌀 Proactive Run' : '⚠️ VSA Interruption'}
            <span className="font-normal opacity-70 mx-1">·</span>
            <span className="font-normal">{REASON_LABELS[reason!]}</span>
          </span>
        </div>
      </div>
      <NotesField value={notes} onChange={setNotes} tripState="complete" />
      <button type="button" onClick={onReset} className="text-xs font-semibold text-yellow-600 hover:text-yellow-800 transition cursor-pointer">
        Log another run →
      </button>
    </div>
  );
}
