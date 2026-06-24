import { SCHEDULE_GROUPS } from '../../lib/scheduleGroups';
import type { ScheduleGroup } from '../../lib/scheduleGroups';

const PILL = 'px-3 py-1 rounded-full text-xs font-semibold border transition';
const ON   = 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100';
const OFF  = 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500';

interface Props {
  activeGroups: Set<ScheduleGroup>;
  onToggleGroup: (g: ScheduleGroup) => void;
  showMock: boolean;
  onToggleMock: () => void;
  myShift: { show: boolean; available: boolean; active: boolean; tooltip: string; onToggle: () => void };
}

export function ScheduleFilterBar({ activeGroups, onToggleGroup, showMock, onToggleMock, myShift }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-400 dark:text-gray-500 font-medium shrink-0">Showing:</span>

      {SCHEDULE_GROUPS.map(g => (
        <button
          key={g.id}
          onClick={() => onToggleGroup(g.id)}
          className={`${PILL} cursor-pointer ${activeGroups.has(g.id) ? ON : OFF}`}
        >
          {g.label}
        </button>
      ))}

      {/* "My Shift" — overlap filter; sits after the groups, before Test accounts.
          Disabled (with tooltip) when you have no shift to overlap against today. */}
      {myShift.show && (
        <button
          onClick={myShift.available ? myShift.onToggle : undefined}
          disabled={!myShift.available}
          title={myShift.tooltip}
          className={`${PILL} ${
            myShift.active
              ? ON
              : myShift.available
                ? `${OFF} cursor-pointer`
                : 'border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed'
          }`}
        >
          👤 My Shift
        </button>
      )}

      <button
        onClick={onToggleMock}
        title="Show demo / test accounts in the schedule"
        className={`ml-auto ${PILL} cursor-pointer ${
          showMock
            ? ON
            : 'border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
      >
        🧪 Test accounts{showMock ? ' · on' : ''}
      </button>
    </div>
  );
}
