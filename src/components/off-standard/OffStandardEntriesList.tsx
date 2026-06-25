import type { OffStandardEntry } from '../../types';
import { fmtTime, fmtMinutes } from '../../lib/offStandardReport';
import { hapticLight } from '../../lib/haptics';

interface OffStandardEntriesListProps {
  entries: OffStandardEntry[];
  onEditClick: (entry: OffStandardEntry) => void;
}

export function OffStandardEntriesList({ entries, onEditClick }: OffStandardEntriesListProps) {
  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Entries</p>
      {entries.map(entry => (
        <div
          key={entry.id}
          className={`rounded-xl border px-4 py-3 transition-colors ${
            entry.autoFromTrip
              ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/40'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {fmtTime(entry.startTime)} – {fmtTime(entry.stopTime)}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                  {entry.reason}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {fmtMinutes(entry.minutes)}
                </span>
                {entry.presetReason === 'edv' && (entry.edvPlate || entry.edvExterior || entry.edvInterior) && (
                  <>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">EDV</span>
                    {entry.edvPlate && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">{entry.edvPlate}</span>
                    )}
                    {entry.edvExterior && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Exterior</span>
                    )}
                    {entry.edvInterior && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Interior</span>
                    )}
                  </>
                )}
                {entry.presetReason === 'airport_flip' && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Flipping Returns</span>
                )}
                {entry.autoFromTrip && (
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">🔗 From movement log</span>
                )}
                {entry.isBackdated && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">Backdated</span>
                )}
                {entry.editStatus === 'pending' && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Pending approval</span>
                )}
              </div>
              {entry.explanation && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{entry.explanation}</p>
              )}
              {entry.editStatus === 'denied' && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">
                  {entry.isBackdated ? 'Entry denied — not counted toward your rate' : 'Edit denied — you may request again'}
                </p>
              )}
            </div>
            {!entry.autoFromTrip && !entry.isBackdated && entry.editStatus !== 'pending' && (
              <button
                onClick={() => { hapticLight(); onEditClick(entry); }}
                className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm cursor-pointer transition-colors"
                aria-label="Edit entry"
              >
                ✏️
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
