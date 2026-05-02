import { SectionHeader, EmptyState } from '../lib/analytics';

interface HoldType { label: string; count: number; color: string; text: string; }
interface DamageType { label: string; count: number; }

export function AnalyticsHoldsSummary({ holdTypes, totalHolds, damageTypes, isDemo, hasLiveHolds }: {
  holdTypes: HoldType[];
  totalHolds: number;
  damageTypes: DamageType[];
  isDemo: boolean;
  hasLiveHolds: boolean;
}) {
  return (
    <>
      {/* Holds by type */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-colors">
        <SectionHeader title="Active Holds by Type" />
        {totalHolds === 0 || (!isDemo && !hasLiveHolds) ? (
          <EmptyState message="No active holds recorded yet." />
        ) : (
          <div className="space-y-3">
            {holdTypes.map(t => (
              <div key={t.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${t.text} transition-colors`}>{t.label}</span>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 transition-colors">{t.count}</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden transition-colors">
                  <div
                    className={`h-full rounded-full ${t.color} transition-all`}
                    style={{ width: `${(t.count / totalHolds) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top damage types */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-colors">
        <SectionHeader title={isDemo ? 'Top Damage Types (30 days)' : 'Top Damage Types — Active Holds'} />
        {damageTypes.length === 0 ? (
          <EmptyState message="No damage holds recorded yet." />
        ) : (
          <div className="space-y-2">
            {damageTypes.map((d, i) => (
              <div key={d.label} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 dark:text-gray-600 w-4 text-right tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300 transition-colors truncate">{d.label}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-colors shrink-0">{d.count}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
