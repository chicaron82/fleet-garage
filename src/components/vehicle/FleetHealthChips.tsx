import { FLEET_COHORTS, type FleetCohortId, type FleetCohortCounts } from '../../lib/fleetCohorts';

interface Props {
  total: number;
  counts: FleetCohortCounts;
  active: FleetCohortId | null;
  onSelect: (cohort: FleetCohortId | null) => void;
}

/**
 * At-a-glance fleet-health chips — a compact, horizontally-scrollable row above the fleet list.
 * The "All" chip clears the filter (shows the whole live fleet); each cohort chip filters the
 * list to that gap AND shows its live count. Tapping the active chip again clears it. The number
 * is a doorway, not a vanity metric: see the pulse, tap to work it down.
 */
export function FleetHealthChips({ total, counts, active, onSelect }: Props) {
  const base =
    'shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors';
  const on = 'bg-fg-yellow border-fg-yellow text-black';
  const off =
    'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50';

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="group" aria-label="Fleet health filters">
      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-pressed={active === null}
        className={`${base} ${active === null ? on : off}`}
      >
        <span>All</span>
        <span className="tabular-nums opacity-70">{total}</span>
      </button>

      {FLEET_COHORTS.map((c) => {
        const isOn = active === c.id;
        const count = counts[c.id];
        return (
          <button
            key={c.id}
            type="button"
            // Toggle: tapping the active cohort clears back to All.
            onClick={() => onSelect(isOn ? null : c.id)}
            aria-pressed={isOn}
            className={`${base} ${isOn ? on : off}`}
          >
            <span aria-hidden="true">{c.icon}</span>
            <span>{c.label}</span>
            <span className="tabular-nums opacity-70">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
