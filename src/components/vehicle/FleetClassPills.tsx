import { hapticLight } from '../../lib/haptics';
import { NO_CLASS } from '../../lib/fleetCohorts';

// One pill per rental class under the Fleet search — tap to filter, tap again to clear.
//
// Aaron, 2026-09-17: *"how bout showing that underneath fleet view's search as additional filtered
// pills."* The class mix used to live behind a tap inside the origin card's Winnipeg row; here it
// does work instead of only counting. Same visual language as FleetHealthChips on purpose — two rows
// of the same kind of control, so the second reads as "more filters", not a new widget to learn.
//
// ⚠️ Combines with the health chip (AND): `No keytag` + `B5` is the B5 cars with no keytag. The counts
// here stay whole-fleet, like the health chips, so a pill's number never shrinks when another filter
// is on — it tells you what the fleet holds, and the list tells you what matched.

interface Props {
  counts: readonly [string, number][];
  active: string | null;
  onSelect: (cls: string | null) => void;
}

export function FleetClassPills({ counts, active, onSelect }: Props) {
  if (counts.length === 0) return null;
  const base =
    'shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors';
  const on = 'bg-fg-yellow border-fg-yellow text-black';
  const off =
    'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50';

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="group" aria-label="Class filters">
      {counts.map(([cls, n]) => {
        const isOn = active === cls;
        return (
          <button
            key={cls}
            type="button"
            onClick={() => { hapticLight(); onSelect(isOn ? null : cls); }}
            aria-pressed={isOn}
            className={`${base} ${isOn ? on : off}`}
          >
            <span className={cls === NO_CLASS ? '' : 'font-mono'}>{cls === NO_CLASS ? 'No class' : cls}</span>
            <span className="tabular-nums opacity-70">{n}</span>
          </button>
        );
      })}
    </div>
  );
}
