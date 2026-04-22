import type { ShiftEntry } from '../data/schedule';

interface Props {
  vsaSchedule: ShiftEntry[];
  driverSchedule: ShiftEntry[];
}

function formatTimeAbbr(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  return `${h}:${m}`;
}

function getShiftTypeColor(start: string, off: boolean): string {
  if (off) return 'text-gray-400 dark:text-gray-600';

  const hour = parseInt(start.split(':')[0], 10);

  // Open shift (before 12pm)
  if (hour < 12) return 'text-blue-600 dark:text-blue-400';

  // Close shift (after 12pm)
  if (hour >= 13) return 'text-yellow-600 dark:text-yellow-400';

  // PT (scattered/flexible)
  return 'text-teal-600 dark:text-teal-400';
}

export function ManagementScheduleView({ vsaSchedule, driverSchedule }: Props) {
  const today = new Date().toISOString().split('T')[0];

  // Calculate week range from first schedule
  const firstDay = new Date(vsaSchedule[0].shifts[0].date);
  const lastDay = new Date(vsaSchedule[0].shifts[vsaSchedule[0].shifts.length - 1].date);
  const weekRange = `${firstDay.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} – ${lastDay.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const days = vsaSchedule[0].shifts.map(s => s.day);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 transition-colors">
          Team Schedule
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 transition-colors">
          Week of {weekRange}
        </p>
      </div>

      {/* VSA Crew Section */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto transition-colors">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            VSA Crew
          </h2>
        </div>
        <div className="p-4">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left pb-2 pr-4 text-gray-500 dark:text-gray-400 font-semibold">Name</th>
                {days.map((day, idx) => {
                  const shift = vsaSchedule[0].shifts[idx];
                  const isToday = shift.date === today;
                  return (
                    <th
                      key={day}
                      className={`text-center pb-2 px-2 font-semibold ${
                        isToday
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {day}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {vsaSchedule.map(person => (
                <tr key={person.userId} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                    {person.name}
                  </td>
                  {person.shifts.map((shift, idx) => {
                    const isToday = shift.date === today;
                    const colorClass = getShiftTypeColor(shift.start, shift.off);
                    return (
                      <td
                        key={idx}
                        className={`text-center px-2 py-2 ${
                          isToday ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''
                        }`}
                      >
                        {shift.off ? (
                          <span className="text-gray-400 dark:text-gray-600">OFF</span>
                        ) : (
                          <span className={`font-mono ${colorClass}`}>
                            {formatTimeAbbr(shift.start)}–{formatTimeAbbr(shift.end)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Coverage Gap Callout */}
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-800 dark:text-red-300 transition-colors">
        ⚠️ <strong>3:00–4:00 PM coverage gap visible Mon–Fri</strong>
        <br />
        <span className="text-xs text-red-700 dark:text-red-400 mt-1 block">
          Morning crew clocks out 15:15 · Close crew starts 13:30 but ramps at 16:00
        </span>
      </div>

      {/* Drivers Section */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto transition-colors">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            Drivers
          </h2>
        </div>
        <div className="p-4">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left pb-2 pr-4 text-gray-500 dark:text-gray-400 font-semibold">Name</th>
                {days.map((day, idx) => {
                  const shift = driverSchedule[0].shifts[idx];
                  const isToday = shift.date === today;
                  return (
                    <th
                      key={day}
                      className={`text-center pb-2 px-2 font-semibold ${
                        isToday
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {day}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {driverSchedule.map(person => (
                <tr key={person.userId} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                    {person.name}
                  </td>
                  {person.shifts.map((shift, idx) => {
                    const isToday = shift.date === today;
                    const colorClass = getShiftTypeColor(shift.start, shift.off);
                    return (
                      <td
                        key={idx}
                        className={`text-center px-2 py-2 ${
                          isToday ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''
                        }`}
                      >
                        {shift.off ? (
                          <span className="text-gray-400 dark:text-gray-600">OFF</span>
                        ) : (
                          <span className={`font-mono ${colorClass}`}>
                            {formatTimeAbbr(shift.start)}–{formatTimeAbbr(shift.end)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
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
