import { NotesField, REASON_LABELS, fmtTime } from '../lib/vsa-trip';
import type { Authorization, Reason, QueueSnapshot } from '../lib/vsa-trip';

export function TripComplete({ isShuttle, authorization, reason, departureTime, arrivalTime, queue, notes, setNotes, onReset }: {
  isShuttle: boolean;
  authorization: Authorization | null;
  reason: Reason | null;
  departureTime: string; arrivalTime: string;
  queue: QueueSnapshot | null;
  notes: string; setNotes: (v: string) => void;
  onReset: () => void;
}) {
  const dur = Math.round((new Date(arrivalTime).getTime() - new Date(departureTime).getTime()) / 60000);
  const metaLine = [
    `${fmtTime(departureTime)} → ${fmtTime(arrivalTime)} · ${dur}m`,
    queue ? `Queue: ${queue === 'TOO_MUCH' ? '10+' : queue}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="space-y-3">
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-lg overflow-hidden transition-colors">
        <div className="px-4 py-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-widest mb-1.5">Trip Complete</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Airport Run</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{metaLine}</p>
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
