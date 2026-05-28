import type { QuickTap } from '../../hooks/useOffStandardTimer';
import { QUICK_TAPS } from '../../hooks/useOffStandardTimer';

interface Props {
  timerState: string;
  isRecovering: boolean;
  handleQuickTap: (tap: QuickTap) => void;
  onBackdate: () => void;
  startError: boolean;
}

export function OthQuickStart({ timerState, isRecovering, handleQuickTap, onBackdate, startError }: Props) {
  if (timerState !== 'idle' || isRecovering) return null;

  return (
    <>
      <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
        <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
          ⚡ Quick Start
        </p>
        <div className="flex flex-wrap gap-2">
          {QUICK_TAPS.map(tap => (
            <button
              key={tap.label}
              type="button"
              onClick={() => handleQuickTap(tap)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:border-yellow-400 dark:hover:border-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 active:scale-95 shadow-sm transition-all cursor-pointer"
            >
              <span className="text-base">{tap.emoji}</span>
              <span>{tap.label}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onBackdate}
        className="w-full py-2.5 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
      >
        + Log Past Time
      </button>

      {startError && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-lg px-4 py-3">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400">Couldn't save — check connection and try again.</p>
        </div>
      )}
    </>
  );
}
