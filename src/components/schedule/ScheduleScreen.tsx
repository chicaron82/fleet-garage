import { useState } from 'react';
import { useSchedule, getWeekBounds, toISO } from '../../context/ScheduleContext';
import { useAuth } from '../../context/AuthContext';
import { WeekView } from './WeekView';
import { CalendarView } from './CalendarView';
import { FillScheduleModal } from './FillScheduleModal';

function weekLabel(date: Date): string {
  const { start, end } = getWeekBounds(date);
  const s = start.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  const e = end.toLocaleDateString('en-CA',   { month: 'short', day: 'numeric', year: 'numeric' });
  return `${s} – ${e}`;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
}

export function ScheduleScreen() {
  const { viewMode, setViewMode, currentDate, goToPrev, goToNext, goToToday, isPeakSeason, togglePeakSeason } = useSchedule();
  const { user } = useAuth();
  const [showFill, setShowFill] = useState(false);
  const [togglingPeak, setTogglingPeak] = useState(false);
  const isManager = user?.role === 'Branch Manager' || user?.role === 'Operations Manager';
  const today = toISO(new Date());
  const isCurrentPeriod = viewMode === 'week'
    ? (() => { const { start, end } = getWeekBounds(new Date()); return toISO(currentDate) >= toISO(start) && toISO(currentDate) <= toISO(end); })()
    : currentDate.getFullYear() === new Date().getFullYear() && currentDate.getMonth() === new Date().getMonth();

  const label = viewMode === 'week' ? weekLabel(currentDate) : monthLabel(currentDate);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Schedule</h1>
        <div className="flex items-center gap-2 ml-auto">
          {/* Fill schedule */}
          <button
            onClick={() => setShowFill(true)}
            className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 hover:underline cursor-pointer whitespace-nowrap"
          >
            Fill range ↓
          </button>
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs font-semibold">
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 transition cursor-pointer ${
              viewMode === 'week'
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 transition cursor-pointer border-l border-gray-200 dark:border-gray-700 ${
              viewMode === 'calendar'
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            Calendar
          </button>
        </div>
        </div>
      </div>

      {/* Peak season banner — managers only */}
      {isManager && (
        <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
          isPeakSeason
            ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
            : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
        }`}>
          <span>
            {isPeakSeason ? '☀️ Peak season active' : 'Peak season off'}
            <span className="ml-1.5 font-normal opacity-70">
              {isPeakSeason ? '— closing defaults 14:30–23:00' : '— closing defaults 13:30–22:00'}
            </span>
          </span>
          <button
            onClick={async () => {
              setTogglingPeak(true);
              try { await togglePeakSeason(); } finally { setTogglingPeak(false); }
            }}
            disabled={togglingPeak}
            className="ml-3 px-2.5 py-1 rounded-md bg-white dark:bg-gray-800 border border-current text-current font-semibold hover:opacity-80 disabled:opacity-40 transition cursor-pointer"
          >
            {togglingPeak ? '…' : isPeakSeason ? 'Turn off' : 'Turn on'}
          </button>
        </div>
      )}

      {/* Date navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={goToPrev}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer text-sm"
        >
          ‹
        </button>
        <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300 text-center">{label}</span>
        <button
          onClick={goToNext}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer text-sm"
        >
          ›
        </button>
        {!isCurrentPeriod && (
          <button
            onClick={goToToday}
            className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 hover:underline cursor-pointer"
          >
            Today
          </button>
        )}
      </div>

      {/* Content */}
      {viewMode === 'week' ? <WeekView today={today} /> : <CalendarView today={today} />}

      {showFill && <FillScheduleModal onClose={() => setShowFill(false)} />}
    </div>
  );
}
