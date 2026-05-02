import { SectionHeader, EmptyState } from '../lib/analytics';

interface DayActivity { day: string; holds: number; releases: number; }
interface ExceptionEntry { reason: string; count: number; }

export function AnalyticsActivityChart({ weekActivity, exceptionSummary, isDemo }: {
  weekActivity: DayActivity[];
  exceptionSummary: ExceptionEntry[];
  isDemo: boolean;
}) {
  const maxActivity = Math.max(...weekActivity.map(d => d.holds + d.releases), 1);

  return (
    <>
      {/* Hold activity this week */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-colors">
        <SectionHeader title="Hold Activity — This Week" />
        <div className="flex items-end gap-2 h-24 mb-3">
          {weekActivity.map(d => {
            const holdH    = maxActivity > 0 ? (d.holds    / maxActivity) * 100 : 8;
            const releaseH = maxActivity > 0 ? (d.releases / maxActivity) * 100 : 8;
            return (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end gap-0.5 h-20">
                  <div className="flex-1 bg-red-400 dark:bg-red-500 rounded-t transition-all" style={{ height: `${holdH}%` }} />
                  <div className="flex-1 bg-green-400 rounded-t transition-all"               style={{ height: `${releaseH}%` }} />
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500">{d.day}</span>
              </div>
            );
          })}
        </div>
        {!isDemo && weekActivity.every(d => d.holds === 0 && d.releases === 0) && (
          <EmptyState message="No hold activity recorded this week yet." />
        )}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-red-400 dark:bg-red-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Holds</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-green-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Releases</span>
          </div>
        </div>
      </div>

      {/* Exception release summary */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-colors">
        <SectionHeader title="Exception Release Summary" />
        {exceptionSummary.length === 0 ? (
          <EmptyState message="No exception releases recorded yet." />
        ) : (
          <div className="space-y-2">
            {exceptionSummary.map((e, i) => (
              <div key={e.reason} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 dark:text-gray-600 w-4 text-right tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300 transition-colors truncate">{e.reason}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-colors shrink-0">{e.count}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
