import { SectionHeader, EmptyState } from './AnalyticsComponents';
import type { ChronicEntry, ChronicCategory } from '../../lib/chronicIssues';

const CATEGORY_META: Record<ChronicCategory, { icon: string; label: string }> = {
  mechanical: { icon: '🔧', label: 'Mechanical' },
  damage:     { icon: '🩹', label: 'Damage' },
};

function StreakPill({ category, count, crossed }: { category: ChronicCategory; count: number; crossed: boolean }) {
  const m = CATEGORY_META[category];
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition-colors ${
        crossed
          ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
      }`}
    >
      {m.icon} {m.label} {count}×
    </span>
  );
}

/**
 * The chronic-issues escalation list: vehicles released-unrepaired ≥ threshold in
 * mechanical and/or damage, worst-first. Mechanical vs damage are pilled
 * separately (a car can be chronic for one and clean on the other). Rows open the
 * vehicle when `onOpenVehicle` is wired.
 */
export function ChronicIssuesSection({ entries, threshold, onOpenVehicle }: {
  entries: ChronicEntry[];
  threshold: number;
  onOpenVehicle?: (vehicleId: string) => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-colors">
      <SectionHeader title="Chronic Issues — Released Unrepaired" />
      <p className="-mt-3 mb-4 text-xs text-gray-400 dark:text-gray-500">
        Circulated broken {threshold}× or more without a repair, by category.
      </p>

      {entries.length === 0 ? (
        <EmptyState message={`No repeat offenders — nothing released unrepaired ${threshold}× or more.`} />
      ) : (
        <div className="space-y-1.5">
          {entries.map((e, i) => {
            const pills = (['mechanical', 'damage'] as ChronicCategory[])
              .filter(cat => e[cat] > 0)
              .map(cat => <StreakPill key={cat} category={cat} count={e[cat]} crossed={e[cat] >= threshold} />);
            const inner = (
              <>
                <span className="text-xs text-gray-400 dark:text-gray-600 w-4 text-right tabular-nums shrink-0">{i + 1}</span>
                <span className="min-w-0 flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{e.vehicle.unitNumber}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{e.vehicle.licensePlate}</span>
                </span>
                <span className="ml-auto flex items-center gap-1.5">{pills}</span>
              </>
            );
            return onOpenVehicle ? (
              <button
                key={e.vehicle.id}
                onClick={() => onOpenVehicle(e.vehicle.id)}
                className="w-full flex items-center gap-3 px-2 py-1.5 -mx-2 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 transition cursor-pointer"
              >
                {inner}
              </button>
            ) : (
              <div key={e.vehicle.id} className="flex items-center gap-3 px-2 py-1.5">
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
