import { hapticLight } from '../../lib/haptics';
import type { HoldKind, KindPill } from '../../lib/holdKinds';

// Filter the Holds list by WHAT is wrong — hail, windshield, recall, PM… (Aaron, 2026-09-30).
// The pills are derived from the list in view (`kindPills`), so a kind with nothing on hold simply isn't
// here, and each count is of the cars in front of him. docs/ticket-holds-filter-pills.md

interface Props {
  pills: KindPill[];
  active: HoldKind | null;
  /** Tapping the active pill clears it. */
  onSelect: (kind: HoldKind | null) => void;
}

export function HoldKindPills({ pills, active, onSelect }: Props) {
  if (pills.length === 0) return null;
  return (
    <div role="group" aria-label="Filter holds by kind" className="-mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
      {pills.map(p => {
        const on = p.kind === active;
        // ⭐ Recalls wait on parts (the Bronco Sports until December), so how long the longest one has sat is
        // the useful fact on that pill. On the others the pile clears in days and an age would be noise.
        const age = p.kind === 'recall' && p.oldestDays > 0 ? ` · ${p.oldestDays}d` : '';
        return (
          <button
            key={p.kind}
            type="button"
            aria-pressed={on}
            onClick={() => { hapticLight(); onSelect(on ? null : p.kind); }}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
              on
                ? 'border-fg-yellow bg-fg-yellow text-black'
                : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:border-fg-yellow'
            }`}
          >
            {p.label} <span className={on ? 'text-black/70' : 'text-gray-400 dark:text-gray-500'}>{p.count}{age}</span>
          </button>
        );
      })}
    </div>
  );
}
