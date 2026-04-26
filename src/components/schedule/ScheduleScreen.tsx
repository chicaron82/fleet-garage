import { useState, useMemo } from 'react';
import { useSchedule, getWeekBounds, toISO } from '../../context/ScheduleContext';
import { useAuth } from '../../context/AuthContext';
import { USERS } from '../../data/mock';
import { SCHEDULE_GROUPS } from '../../lib/scheduleGroups';
import type { ScheduleGroup } from '../../lib/scheduleGroups';
import { WeekView } from './WeekView';
import { CalendarView } from './CalendarView';
import { FillScheduleModal } from './FillScheduleModal';
import { LogSickDaySheet } from './LogSickDaySheet';

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
  const { viewMode, setViewMode, currentDate, goToPrev, goToNext, goToToday, isPeakSeason, togglePeakSeason, ptoEntitlement, ptoUsed, sickDaysUsed, updatePtoEntitlement } = useSchedule();
  const { user, activeBranch } = useAuth();
  const [showFill,    setShowFill]    = useState(false);
  const [showLogSick, setShowLogSick] = useState(false);
  const [togglingPeak, setTogglingPeak] = useState(false);
  const [editingPto,   setEditingPto]   = useState(false);
  const [ptoInput,     setPtoInput]     = useState('');
  const [activeGroups, setActiveGroups] = useState<Set<ScheduleGroup>>(new Set());
  const isManager = user?.role === 'Branch Manager' || user?.role === 'Operations Manager';
  const today = toISO(new Date());

  const toggleGroup = (g: ScheduleGroup) => {
    setActiveGroups(prev => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  };

  const visibleUserIds = useMemo(() => {
    const ids = new Set<string>(user ? [user.id] : []);
    for (const g of activeGroups) {
      const group = SCHEDULE_GROUPS.find(sg => sg.id === g);
      if (!group) continue;
      for (const u of USERS) {
        if (group.roles.includes(u.role) && u.id !== user?.id) {
          if (activeBranch === 'ALL' || u.branchId === activeBranch) {
            ids.add(u.id);
          }
        }
      }
    }
    return ids;
  }, [activeGroups, user, activeBranch]);
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

      {/* PTO + Sick stats */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* PTO chip */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/40 text-xs">
          <span className="text-violet-700 dark:text-violet-300 font-semibold">PTO</span>
          <span className="text-violet-600 dark:text-violet-400">{ptoUsed} /</span>
          {editingPto ? (
            <input
              autoFocus
              type="number"
              min={1}
              max={365}
              value={ptoInput}
              onChange={e => setPtoInput(e.target.value)}
              onBlur={async () => {
                const v = parseInt(ptoInput, 10);
                if (!isNaN(v) && v > 0) await updatePtoEntitlement(v);
                setEditingPto(false);
              }}
              onKeyDown={async e => {
                if (e.key === 'Enter') {
                  const v = parseInt(ptoInput, 10);
                  if (!isNaN(v) && v > 0) await updatePtoEntitlement(v);
                  setEditingPto(false);
                } else if (e.key === 'Escape') {
                  setEditingPto(false);
                }
              }}
              className="w-10 text-center font-bold text-violet-700 dark:text-violet-300 bg-transparent border-b border-violet-400 focus:outline-none"
            />
          ) : (
            <button
              onClick={() => { setPtoInput(String(ptoEntitlement)); setEditingPto(true); }}
              className="font-bold text-violet-700 dark:text-violet-300 hover:underline cursor-pointer"
              title="Tap to set your PTO entitlement"
            >
              {ptoEntitlement}
            </button>
          )}
          <span className="text-violet-500 dark:text-violet-500">· {Math.max(0, ptoEntitlement - ptoUsed)} left</span>
        </div>

        {/* Sick chip */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40 text-xs">
          <span className="text-rose-700 dark:text-rose-300 font-semibold">Sick</span>
          <span className="text-rose-600 dark:text-rose-400">{sickDaysUsed} {sickDaysUsed === 1 ? 'day' : 'days'}</span>
        </div>

        {/* Log sick day */}
        <button
          onClick={() => setShowLogSick(true)}
          className="ml-auto text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer whitespace-nowrap"
        >
          Log sick day ↓
        </button>
      </div>

      {/* Group view filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-400 dark:text-gray-500 font-medium shrink-0">Showing:</span>
        {SCHEDULE_GROUPS.map(g => {
          const isActive = activeGroups.has(g.id);
          return (
            <button
              key={g.id}
              onClick={() => toggleGroup(g.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                isActive
                  ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
                  : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              {g.label}
            </button>
          );
        })}
      </div>

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
      {viewMode === 'week'
        ? <WeekView today={today} visibleUserIds={visibleUserIds} />
        : <CalendarView today={today} visibleUserIds={visibleUserIds} />
      }

      {showFill    && <FillScheduleModal onClose={() => setShowFill(false)} />}
      {showLogSick && <LogSickDaySheet   onClose={() => setShowLogSick(false)} />}
    </div>
  );
}
