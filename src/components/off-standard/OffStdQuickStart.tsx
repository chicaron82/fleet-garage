import type { QuickTap } from '../../hooks/useOffStandardTimer';
import { useQuickStart } from '../../hooks/useQuickStart';
import { QuickStartCustomizer } from './QuickStartCustomizer';
import type { User, ShiftType } from '../../types';

interface Props {
  user: User;
  shifts: { userId: string; date: string; shiftType: ShiftType }[];
  timerState: string;
  isRecovering: boolean;
  handleQuickTap: (tap: QuickTap) => void;
  onBackdate: () => void;
  startError: boolean;
}

const TAP_BTN = 'flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:border-fg-yellow dark:hover:border-fg-yellow-hi hover:text-yellow-700 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 active:scale-95 shadow-sm transition-all cursor-pointer';

export function OffStdQuickStart({ user, shifts, timerState, isRecovering, handleQuickTap, onBackdate, startError }: Props) {
  const qs = useQuickStart(user.id, shifts);

  if (timerState !== 'idle' || isRecovering) return null;

  const renderTap = (tap: QuickTap) => (
    <button key={tap.id} type="button" onClick={() => handleQuickTap(tap)} className={TAP_BTN}>
      <span className="text-base">{tap.emoji}</span>
      <span>{tap.label}</span>
    </button>
  );

  return (
    <>
      <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            ⚡ Quick Start
          </p>
          <button
            type="button"
            onClick={qs.openCustomize}
            className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
          >
            ✏️ Customize
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {qs.topTaps.map(renderTap)}
          {qs.expanded && qs.restTaps.map(renderTap)}
        </div>

        {qs.restTaps.length > 0 && (
          <button
            type="button"
            onClick={qs.toggleExpanded}
            className="mt-3 w-full flex items-center justify-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
          >
            {qs.expanded ? '∧ Show less' : `∨ ${qs.restTaps.length} more`}
          </button>
        )}
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

      {qs.customizing && (
        <QuickStartCustomizer
          draftTaps={qs.draftTaps}
          draftOrder={qs.draftOrder}
          isCustomized={qs.isCustomized}
          onDragEnd={qs.handleDragEnd}
          onSave={qs.saveCustomize}
          onReset={qs.resetCustomize}
          onClose={qs.closeCustomize}
        />
      )}
    </>
  );
}
