import type { ShiftEntry } from '../data/schedule';

interface Props {
  schedule: ShiftEntry;
}

function formatTime(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

function getShiftTypeColor(start: string, off: boolean): string {
  if (off) return 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400';

  const hour = parseInt(start.split(':')[0], 10);

  // Open shift (before 12pm)
  if (hour < 12) return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';

  // Close shift (after 12pm)
  if (hour >= 13) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';

  // PT (scattered/flexible)
  return 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400';
}

export function PersonalScheduleView({ schedule }: Props) {
  const today = new Date().toISOString().split('T')[0];

  // Calculate week range
  const firstDay = new Date(schedule.shifts[0].date);
  const lastDay = new Date(schedule.shifts[schedule.shifts.length - 1].date);
  const weekRange = `${firstDay.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} – ${lastDay.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 transition-colors">
          Your Schedule
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 transition-colors">
          Week of {weekRange}
        </p>
      </div>

      {/* Week Card */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
        <div className="p-5 space-y-3">
          {schedule.shifts.map((shift) => {
            const isToday = shift.date === today;
            const colorClass = getShiftTypeColor(shift.start, shift.off);

            return (
              <div
                key={shift.date}
                className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                  isToday
                    ? 'bg-yellow-50 dark:bg-yellow-900/10 border-2 border-yellow-400 dark:border-yellow-500'
                    : 'bg-gray-50 dark:bg-gray-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`font-semibold text-sm ${isToday ? 'text-yellow-700 dark:text-yellow-400' : 'text-gray-700 dark:text-gray-300'} transition-colors`}>
                    {shift.day}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 transition-colors">
                    {new Date(shift.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div>
                  {shift.off ? (
                    <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${colorClass} transition-colors`}>
                      OFF
                    </span>
                  ) : (
                    <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${colorClass} transition-colors`}>
                      {formatTime(shift.start)} – {formatTime(shift.end)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 transition-colors">
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-400"></div>
            <span className="text-gray-600 dark:text-gray-400">Open (AM)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <span className="text-gray-600 dark:text-gray-400">Close (PM)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-teal-400"></div>
            <span className="text-gray-600 dark:text-gray-400">Part-time</span>
          </div>
        </div>
      </div>
    </div>
  );
}
