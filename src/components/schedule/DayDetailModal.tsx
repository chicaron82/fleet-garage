import { useSchedule } from '../../context/ScheduleContext';
import { useAuth } from '../../context/AuthContext';
import type { ShiftType } from '../../types';

const SHIFT_COLORS: Record<ShiftType, string> = {
  'opening': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  'mid':     'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
  'closing': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  'day-off': 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
  'pto':     'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
  'sick':    'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
};

function fmtTime(t?: string): string {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}

interface Props {
  date: string;
  onClose: () => void;
  onAddShift: () => void;
  visibleUserIds: Set<string>;
}

export function DayDetailModal({ date, onClose, onAddShift, visibleUserIds }: Props) {
  const { shifts } = useSchedule();
  const { user }   = useAuth();

  const dayShifts = shifts.filter(s => s.date === date && visibleUserIds.has(s.userId)).sort((a, b) => {
    if (!a.startTime) return 1;
    if (!b.startTime) return -1;
    return a.startTime.localeCompare(b.startTime);
  });

  const myShift = dayShifts.find(s => s.userId === user?.id);

  const displayDate = new Date(date + 'T12:00:00').toLocaleDateString('en-CA', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-5 space-y-4 transition-colors max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-base">{displayDate}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl cursor-pointer">×</button>
        </div>

        {/* Shifts list */}
        {dayShifts.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No shifts entered for this day.</p>
        ) : (
          <div className="space-y-2">
            {dayShifts.map(shift => (
              <div
                key={shift.id}
                className={`flex items-center justify-between p-3 rounded-lg ${shift.userId === user?.id ? 'ring-1 ring-yellow-400 dark:ring-yellow-500' : 'bg-gray-50 dark:bg-gray-800/50'}`}
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{shift.user.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{shift.user.role}</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${SHIFT_COLORS[shift.shiftType]}`}>
                  {shift.shiftType === 'day-off' ? 'Day Off'
                    : shift.shiftType === 'pto'  ? 'PTO'
                    : shift.shiftType === 'sick' ? 'Sick Day'
                    : `${fmtTime(shift.startTime)} – ${fmtTime(shift.endTime)}`
                  }
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Add my shift */}
        {!myShift && (
          <button
            onClick={onAddShift}
            className="w-full py-2.5 border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-sm font-medium rounded-xl hover:border-yellow-400 hover:text-yellow-600 dark:hover:border-yellow-500 dark:hover:text-yellow-400 transition cursor-pointer"
          >
            + Add my shift for this day
          </button>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium text-sm rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
}
